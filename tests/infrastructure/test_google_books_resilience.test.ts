import { describe, it, expect, vi } from 'vitest'
import { GoogleBooksService } from '../../src/shared/infrastructure/api/GoogleBooksService.js'
import {
  backoffDelay,
  fetchWithRetry,
  parseRetryAfter,
  resolveRetryOptions
} from '../../src/shared/infrastructure/api/fetchWithRetry.js'
import type { RetryOptions } from '../../src/shared/infrastructure/api/fetchWithRetry.js'
import {
  classifyGoogleBooksError,
  pickMostRelevantError
} from '../../src/shared/infrastructure/api/classifyGoogleBooksError.js'
import { CachedBookSearchService } from '../../src/shared/infrastructure/api/CachedBookSearchService.js'
import {
  SearchApiKeyInvalidError,
  SearchQuotaExceededError,
  SearchRequestFailedError,
  SearchServiceUnavailableError
} from '../../src/shared/domain/errors/BookSearchErrors.js'
import type {
  BookSearchResult,
  BookSearchService
} from '../../src/shared/domain/ports/BookSearchService.js'

interface FakeResponse {
  ok: boolean
  status: number
  statusText?: string
  headers?: { get: (name: string) => string | null }
  json: () => Promise<unknown>
}

function ok(body: unknown = { items: [] }): FakeResponse {
  return { ok: true, status: 200, json: async () => body }
}

function fail(status: number, body: unknown = {}, retryAfter?: string): FakeResponse {
  return {
    ok: false,
    status,
    headers: {
      get: (name: string) => (name.toLowerCase() === 'retry-after' ? (retryAfter ?? null) : null)
    },
    json: async () => body
  }
}

/** fetch falso que devuelve (o lanza) cada elemento de la secuencia, y repite el último. */
function sequenceFetch(...steps: Array<FakeResponse | Error>) {
  let index = 0
  return vi.fn(async () => {
    const step = steps[Math.min(index, steps.length - 1)]
    index++
    if (step instanceof Error) throw step
    return step as FakeResponse
  })
}

function testOptions(overrides: Partial<RetryOptions> = {}): RetryOptions & {
  sleep: ReturnType<typeof vi.fn>
} {
  const sleep = vi.fn(async () => {})
  return {
    ...resolveRetryOptions({ random: () => 0.5, now: () => 0, ...overrides }),
    sleep
  } as RetryOptions & { sleep: ReturnType<typeof vi.fn> }
}

function asFetch(mock: ReturnType<typeof vi.fn>): typeof fetch {
  return mock as unknown as typeof fetch
}

const KEY_INVALID_BODY = {
  error: {
    code: 400,
    message: 'API key not valid. Please pass a valid API key.',
    status: 'INVALID_ARGUMENT',
    details: [{ reason: 'API_KEY_INVALID' }]
  }
}

const DAILY_QUOTA_BODY = {
  error: {
    code: 403,
    message: 'Quota exceeded for quota metric.',
    errors: [{ reason: 'dailyLimitExceeded', message: 'Daily Limit Exceeded' }]
  }
}

describe('Feature #27 — fetchWithRetry', () => {
  it('uses exponential backoff of ~0.5 s and ~1.5 s with jitter', () => {
    const centered = testOptions({ random: () => 0.5 })
    expect(backoffDelay(0, centered)).toBe(500)
    expect(backoffDelay(1, centered)).toBe(1500)

    const low = testOptions({ random: () => 0 })
    const high = testOptions({ random: () => 1 })
    expect(backoffDelay(0, low)).toBe(400)
    expect(backoffDelay(0, high)).toBe(600)
    expect(backoffDelay(1, low)).toBe(1200)
    expect(backoffDelay(1, high)).toBe(1800)
  })

  it.each([503, 500, 502, 504, 429])(
    'retries %i up to 2 times and returns the last response',
    async (status) => {
      const fetchMock = sequenceFetch(fail(status))
      const options = testOptions()

      const res = await fetchWithRetry(asFetch(fetchMock), 'https://x', options)

      expect(res.status).toBe(status)
      expect(fetchMock).toHaveBeenCalledTimes(3)
      expect(options.sleep.mock.calls.map((c) => c[0])).toEqual([500, 1500])
    }
  )

  it('stops retrying as soon as a response succeeds', async () => {
    const fetchMock = sequenceFetch(fail(503), ok())
    const options = testOptions()

    const res = await fetchWithRetry(asFetch(fetchMock), 'https://x', options)

    expect(res.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(options.sleep).toHaveBeenCalledTimes(1)
  })

  it.each([400, 401, 403, 404])('does not retry client error %i', async (status) => {
    const fetchMock = sequenceFetch(fail(status))
    const options = testOptions()

    const res = await fetchWithRetry(asFetch(fetchMock), 'https://x', options)

    expect(res.status).toBe(status)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(options.sleep).not.toHaveBeenCalled()
  })

  it('retries network errors and rethrows the last one when retries run out', async () => {
    const fetchMock = sequenceFetch(new TypeError('fetch failed'))
    const options = testOptions()

    await expect(fetchWithRetry(asFetch(fetchMock), 'https://x', options)).rejects.toThrow(
      'fetch failed'
    )
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('waits for Retry-After in seconds instead of the backoff', async () => {
    const fetchMock = sequenceFetch(fail(429, {}, '2'), ok())
    const options = testOptions()

    await fetchWithRetry(asFetch(fetchMock), 'https://x', options)

    expect(options.sleep).toHaveBeenCalledWith(2000)
  })

  it('caps a long Retry-After at maxRetryAfterMs', async () => {
    const fetchMock = sequenceFetch(fail(503, {}, '120'), ok())
    const options = testOptions()

    await fetchWithRetry(asFetch(fetchMock), 'https://x', options)

    expect(options.sleep).toHaveBeenCalledWith(5000)
  })

  it('understands Retry-After as an HTTP date relative to the injected clock', () => {
    const now = Date.parse('2026-10-19T12:00:00Z')
    const options = testOptions({ now: () => now })

    expect(parseRetryAfter('Mon, 19 Oct 2026 12:00:03 GMT', options)).toBe(3000)
    expect(parseRetryAfter('Mon, 19 Oct 2026 11:59:00 GMT', options)).toBe(0)
    expect(parseRetryAfter('not a date', options)).toBeNull()
    expect(parseRetryAfter(null, options)).toBeNull()
  })

  it('falls back to the backoff when the response has no headers', async () => {
    const fetchMock = sequenceFetch({ ok: false, status: 503, json: async () => ({}) }, ok())
    const options = testOptions()

    await fetchWithRetry(asFetch(fetchMock), 'https://x', options)

    expect(options.sleep).toHaveBeenCalledWith(500)
  })
})

describe('Feature #27 — classifyGoogleBooksError', () => {
  it('maps 5xx to unavailable and 429 to quota exceeded', () => {
    expect(classifyGoogleBooksError(503, null)).toBeInstanceOf(SearchServiceUnavailableError)
    expect(classifyGoogleBooksError(500, {})).toBeInstanceOf(SearchServiceUnavailableError)
    expect(classifyGoogleBooksError(429, {})).toBeInstanceOf(SearchQuotaExceededError)
  })

  it('maps 400/403 with a key reason or message to invalid key', () => {
    expect(classifyGoogleBooksError(400, KEY_INVALID_BODY)).toBeInstanceOf(
      SearchApiKeyInvalidError
    )
    expect(
      classifyGoogleBooksError(403, { error: { message: 'The provided API key is expired.' } })
    ).toBeInstanceOf(SearchApiKeyInvalidError)
  })

  it('maps 403 with a quota reason to quota exceeded', () => {
    expect(classifyGoogleBooksError(403, DAILY_QUOTA_BODY)).toBeInstanceOf(
      SearchQuotaExceededError
    )
  })

  it('maps other client errors to a generic request failure', () => {
    expect(classifyGoogleBooksError(400, { error: { message: 'Bad query' } })).toBeInstanceOf(
      SearchRequestFailedError
    )
    expect(classifyGoogleBooksError(404, null)).toBeInstanceOf(SearchRequestFailedError)
  })

  it('prefers invalid key over quota over unavailable when picking between two errors', () => {
    const unavailable = new SearchServiceUnavailableError(503)
    const quota = new SearchQuotaExceededError(429)
    const key = new SearchApiKeyInvalidError(400)
    expect(pickMostRelevantError([unavailable, key])).toBe(key)
    expect(pickMostRelevantError([unavailable, quota])).toBe(quota)
    const plain = new Error('x')
    expect(pickMostRelevantError([plain, unavailable])).toBe(unavailable)
    expect(pickMostRelevantError([plain, new Error('y')])).toBe(plain)
  })
})

describe('Feature #27 — GoogleBooksService with retries', () => {
  function serviceWith(fetchMock: ReturnType<typeof vi.fn>, sleep = vi.fn(async () => {})) {
    return new GoogleBooksService(asFetch(fetchMock), 'test-key', {
      retry: { sleep, random: () => 0.5 }
    })
  }

  const VOLUME = { items: [{ id: 'v1', volumeInfo: { title: 'Carrie', authors: ['Stephen King'] } }] }

  it('recovers from a transient 503 on each parallel query', async () => {
    const responses = new Map<string, number>()
    const fetchMock = vi.fn(async (url: string) => {
      const count = (responses.get(url) ?? 0) + 1
      responses.set(url, count)
      return count === 1 ? fail(503) : ok(VOLUME)
    })

    const results = await serviceWith(fetchMock).searchByQuery('carrie')

    expect(results.map((r) => r.googleBooksId)).toEqual(['v1'])
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('throws SearchServiceUnavailableError when 503 persists on both queries', async () => {
    const sleep = vi.fn(async () => {})
    const fetchMock = sequenceFetch(fail(503))

    await expect(serviceWith(fetchMock, sleep).searchByQuery('carrie')).rejects.toBeInstanceOf(
      SearchServiceUnavailableError
    )
    expect(fetchMock).toHaveBeenCalledTimes(6)
    expect(sleep).toHaveBeenCalledTimes(4)
  })

  it('throws SearchServiceUnavailableError when the network keeps failing', async () => {
    const fetchMock = sequenceFetch(new TypeError('fetch failed'))

    await expect(serviceWith(fetchMock).searchByQuery('carrie')).rejects.toBeInstanceOf(
      SearchServiceUnavailableError
    )
  })

  it('throws SearchApiKeyInvalidError on 400 with key reason without retrying', async () => {
    const sleep = vi.fn(async () => {})
    const fetchMock = sequenceFetch(fail(400, KEY_INVALID_BODY))

    await expect(serviceWith(fetchMock, sleep).searchByQuery('carrie')).rejects.toBeInstanceOf(
      SearchApiKeyInvalidError
    )
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(sleep).not.toHaveBeenCalled()
  })

  it('throws SearchQuotaExceededError on 403 dailyLimitExceeded without retrying', async () => {
    const fetchMock = sequenceFetch(fail(403, DAILY_QUOTA_BODY))

    await expect(serviceWith(fetchMock).searchByQuery('carrie')).rejects.toBeInstanceOf(
      SearchQuotaExceededError
    )
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('classifies by status when the error body cannot be read', async () => {
    const fetchMock = sequenceFetch({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError('Unexpected token <')
      }
    })

    await expect(serviceWith(fetchMock).searchByQuery('carrie')).rejects.toBeInstanceOf(
      SearchServiceUnavailableError
    )
  })
})

describe('Feature #27 — CachedBookSearchService', () => {
  const CARRIE: BookSearchResult = { googleBooksId: 'c', title: 'Carrie', authors: ['King'] }

  function innerService(results: BookSearchResult[] = [CARRIE]) {
    const searchByQuery = vi.fn(async () => results)
    return { service: { searchByQuery } as BookSearchService, searchByQuery }
  }

  it('returns cached results for the same normalized query and author', async () => {
    const { service, searchByQuery } = innerService()
    const cached = new CachedBookSearchService(service, { now: () => 0 })

    const first = await cached.searchByQuery('Carrie', 'Stephen King')
    const second = await cached.searchByQuery('  carrie ', 'stephen   KING ')

    expect(first).toEqual([CARRIE])
    expect(second).toBe(first)
    expect(searchByQuery).toHaveBeenCalledTimes(1)
    expect(searchByQuery).toHaveBeenCalledWith('Carrie', 'Stephen King')
  })

  it('keeps query and author apart in the key', async () => {
    const { service, searchByQuery } = innerService()
    const cached = new CachedBookSearchService(service, { now: () => 0 })

    await cached.searchByQuery('carrie')
    await cached.searchByQuery('', 'carrie')
    await cached.searchByQuery('carrie', 'king')

    expect(searchByQuery).toHaveBeenCalledTimes(3)
    expect(searchByQuery).toHaveBeenNthCalledWith(1, 'carrie')
  })

  it('searches again once the TTL expires', async () => {
    let now = 0
    const { service, searchByQuery } = innerService()
    const cached = new CachedBookSearchService(service, { ttlMs: 1000, now: () => now })

    await cached.searchByQuery('carrie')
    now = 999
    await cached.searchByQuery('carrie')
    expect(searchByQuery).toHaveBeenCalledTimes(1)

    now = 1000
    await cached.searchByQuery('carrie')
    expect(searchByQuery).toHaveBeenCalledTimes(2)
  })

  it('evicts the least recently used entry when maxEntries is exceeded', async () => {
    const { service, searchByQuery } = innerService()
    const cached = new CachedBookSearchService(service, { maxEntries: 2, now: () => 0 })

    await cached.searchByQuery('a1a')
    await cached.searchByQuery('b2b')
    await cached.searchByQuery('a1a')
    await cached.searchByQuery('c3c')
    expect(cached.size).toBe(2)
    expect(searchByQuery).toHaveBeenCalledTimes(3)

    await cached.searchByQuery('a1a')
    expect(searchByQuery).toHaveBeenCalledTimes(3)
    await cached.searchByQuery('b2b')
    expect(searchByQuery).toHaveBeenCalledTimes(4)
  })

  it('does not cache failures', async () => {
    const searchByQuery = vi
      .fn()
      .mockRejectedValueOnce(new SearchServiceUnavailableError(503))
      .mockResolvedValueOnce([CARRIE])
    const cached = new CachedBookSearchService({ searchByQuery }, { now: () => 0 })

    await expect(cached.searchByQuery('carrie')).rejects.toBeInstanceOf(
      SearchServiceUnavailableError
    )
    expect(cached.size).toBe(0)
    expect(await cached.searchByQuery('carrie')).toEqual([CARRIE])
    expect(searchByQuery).toHaveBeenCalledTimes(2)
  })
})

import { describe, it, expect, vi } from 'vitest'
import { GoogleBooksService } from '../../src/shared/infrastructure/api/GoogleBooksService.js'
import { SearchQuotaExceededError } from '../../src/shared/domain/errors/BookSearchErrors.js'
import {
  KING_EDITION_ID,
  KING_PLAIN_EDITION_ID,
  PET_SEMATARY_FREE_RESPONSE,
  PET_SEMATARY_INTITLE_RESPONSE,
  PET_SEMATARY_UNIQUE_IDS
} from '../fixtures/googleBooksPetSematary.js'

interface RecordedResponse {
  ok: boolean
  status?: number
  statusText?: string
  json: () => Promise<unknown>
}

function decodedQuery(url: string): string {
  return new URL(url).searchParams.get('q') ?? ''
}

function isFieldedQuery(url: string): boolean {
  const q = decodedQuery(url)
  return q.includes('intitle:') || q.includes('inauthor:')
}

function ok(body: unknown): RecordedResponse {
  return { ok: true, json: async () => body }
}

function httpError(status: number, statusText: string): RecordedResponse {
  return { ok: false, status, statusText, json: async () => ({}) }
}

/** fetch falso que responde según si la consulta usa operadores de campo o no. */
function recordedFetch(free: RecordedResponse | Error, fielded: RecordedResponse | Error) {
  return vi.fn(async (url: string) => {
    const response = isFieldedQuery(url) ? fielded : free
    if (response instanceof Error) throw response
    return response
  })
}

function serviceWith(fetchMock: ReturnType<typeof vi.fn>): GoogleBooksService {
  // Sin esperas reales: los reintentos de #27 usan un sleep inmediato.
  return new GoogleBooksService(fetchMock as unknown as typeof fetch, null, {
    retry: { sleep: async () => {} }
  })
}

function calledQueries(fetchMock: ReturnType<typeof vi.fn>): string[] {
  return fetchMock.mock.calls.map((call) => decodedQuery(call[0] as string))
}

describe('GoogleBooksService - combined queries and local ranking (feature #21)', () => {
  it('launches the free query and an intitle: query, both with printType=books and maxResults=40', async () => {
    const fetchMock = recordedFetch(ok({ items: [] }), ok({ items: [] }))

    await serviceWith(fetchMock).searchByQuery('pet sematary')

    expect(calledQueries(fetchMock)).toEqual(['pet sematary', 'intitle:"pet sematary"'])
    for (const call of fetchMock.mock.calls) {
      const params = new URL(call[0] as string).searchParams
      expect(params.get('printType')).toBe('books')
      expect(params.get('maxResults')).toBe('40')
    }
  })

  it('starts both requests before either of them resolves (parallel, not sequential)', async () => {
    const resolvers: Array<(value: RecordedResponse) => void> = []
    const fetchMock = vi.fn(
      () => new Promise<RecordedResponse>((resolve) => resolvers.push(resolve))
    )

    const pending = serviceWith(fetchMock).searchByQuery('pet sematary')
    await Promise.resolve()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    resolvers.forEach((resolve) => resolve(ok({ items: [] })))
    await expect(pending).resolves.toEqual([])
  })

  it('adds inauthor: to the fielded query and the author words to the free query', async () => {
    const fetchMock = recordedFetch(ok({ items: [] }), ok({ items: [] }))

    await serviceWith(fetchMock).searchByQuery('pet sematary', 'Stephen King')

    expect(calledQueries(fetchMock)).toEqual([
      'pet sematary Stephen King',
      'intitle:"pet sematary" inauthor:"Stephen King"'
    ])
  })

  it('searches by author alone with inauthor: when the text is empty', async () => {
    const fetchMock = recordedFetch(ok({ items: [] }), ok({ items: [] }))

    await serviceWith(fetchMock).searchByQuery('', 'Stephen King')

    expect(calledQueries(fetchMock)).toEqual(['Stephen King', 'inauthor:"Stephen King"'])
  })

  it('strips inner double quotes so the fielded phrase stays well formed', async () => {
    const fetchMock = recordedFetch(ok({ items: [] }), ok({ items: [] }))

    await serviceWith(fetchMock).searchByQuery('"It"')

    expect(calledQueries(fetchMock)[1]).toBe('intitle:"It"')
  })

  it('does not call fetch when both text and author are blank', async () => {
    const fetchMock = vi.fn()

    expect(await serviceWith(fetchMock).searchByQuery('  ', '  ')).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('ranks the Stephen King edition first for "pet sematary" and keeps every edition once', async () => {
    const fetchMock = recordedFetch(
      ok(PET_SEMATARY_FREE_RESPONSE),
      ok(PET_SEMATARY_INTITLE_RESPONSE)
    )

    const results = await serviceWith(fetchMock).searchByQuery('pet sematary')

    expect(results[0]?.googleBooksId).toBe(KING_EDITION_ID)
    expect(results[0]?.authors).toEqual(['Stephen King'])
    expect(results[1]?.googleBooksId).toBe(KING_PLAIN_EDITION_ID)
    const ids = results.map((r) => r.googleBooksId)
    expect(ids).toHaveLength(PET_SEMATARY_UNIQUE_IDS.length)
    expect(new Set(ids)).toEqual(new Set(PET_SEMATARY_UNIQUE_IDS))
  })

  it('also ranks the Stephen King edition first when the author field is filled', async () => {
    const fetchMock = recordedFetch(
      ok(PET_SEMATARY_FREE_RESPONSE),
      ok(PET_SEMATARY_INTITLE_RESPONSE)
    )

    const results = await serviceWith(fetchMock).searchByQuery('Pet Sematary', 'stephen king')

    expect(results[0]?.googleBooksId).toBe(KING_EDITION_ID)
  })

  it('uses the free query results when the fielded query fails', async () => {
    const fetchMock = recordedFetch(ok(PET_SEMATARY_FREE_RESPONSE), new Error('socket hang up'))

    const results = await serviceWith(fetchMock).searchByQuery('pet sematary')

    expect(results).toHaveLength(PET_SEMATARY_FREE_RESPONSE.items.length)
    expect(results[0]?.googleBooksId).toBe(KING_EDITION_ID)
  })

  it('uses the fielded query results when the free query returns an HTTP error', async () => {
    const fetchMock = recordedFetch(
      httpError(503, 'Service Unavailable'),
      ok(PET_SEMATARY_INTITLE_RESPONSE)
    )

    const results = await serviceWith(fetchMock).searchByQuery('pet sematary')

    expect(results.map((r) => r.googleBooksId)).toEqual([
      KING_EDITION_ID,
      'bookrags_pet_sematary',
      'supersummary_pet_sematary'
    ])
  })

  it('throws a typed quota error when both queries keep failing with 429 (feature #27)', async () => {
    const fetchMock = recordedFetch(
      httpError(429, 'Too Many Requests'),
      httpError(429, 'Too Many Requests')
    )

    await expect(serviceWith(fetchMock).searchByQuery('pet sematary')).rejects.toBeInstanceOf(
      SearchQuotaExceededError
    )
  })
})

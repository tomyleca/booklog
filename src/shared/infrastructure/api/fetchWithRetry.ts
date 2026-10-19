/**
 * Reintentos de transporte HTTP (feature #27, ADR 027). Reintenta sólo fallos transitorios
 * (5xx de gateway/servidor, 429 y errores de red) con backoff exponencial y jitter. El reloj,
 * la espera y el azar se inyectan para que los tests no esperen de verdad.
 */
export interface RetryOptions {
  /** Reintentos después del primer intento (2 → hasta 3 llamadas). */
  maxRetries: number
  /** Espera antes del primer reintento; cada reintento la multiplica por `backoffFactor`. */
  baseDelayMs: number
  backoffFactor: number
  /** Variación aleatoria relativa (0.2 → ±20 %). */
  jitterRatio: number
  /** Tope para `Retry-After`: un valor mayor no se espera entero. */
  maxRetryAfterMs: number
  retryableStatuses: readonly number[]
  retryOnNetworkError: boolean
  sleep: (ms: number) => Promise<void>
  random: () => number
  now: () => number
}

export const RETRYABLE_STATUSES: readonly number[] = [429, 500, 502, 503, 504]

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 2,
  baseDelayMs: 500,
  backoffFactor: 3,
  jitterRatio: 0.2,
  maxRetryAfterMs: 5000,
  retryableStatuses: RETRYABLE_STATUSES,
  retryOnNetworkError: true,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  random: Math.random,
  now: Date.now
}

export function resolveRetryOptions(overrides: Partial<RetryOptions> = {}): RetryOptions {
  return { ...DEFAULT_RETRY_OPTIONS, ...overrides }
}

/** Espera del reintento `retryIndex` (0 = primero): base·factor^n con jitter, nunca negativa. */
export function backoffDelay(retryIndex: number, options: RetryOptions): number {
  const nominal = options.baseDelayMs * Math.pow(options.backoffFactor, retryIndex)
  const jitter = (options.random() * 2 - 1) * options.jitterRatio
  return Math.max(0, Math.round(nominal * (1 + jitter)))
}

/**
 * Interpreta `Retry-After` (segundos o fecha HTTP) y lo acota a `maxRetryAfterMs`.
 * Devuelve `null` si no viene o no se entiende.
 */
export function parseRetryAfter(value: string | null | undefined, options: RetryOptions): number | null {
  if (!value) return null
  const trimmed = value.trim()
  let ms: number
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    ms = Number(trimmed) * 1000
  } else {
    const date = Date.parse(trimmed)
    if (Number.isNaN(date)) return null
    ms = date - options.now()
  }
  return Math.min(Math.max(0, Math.round(ms)), options.maxRetryAfterMs)
}

function readRetryAfterHeader(res: Response): string | null {
  // Los dobles de test (y algunos polyfills) no traen `headers`.
  const headers = (res as Partial<Response>).headers
  return headers && typeof headers.get === 'function' ? headers.get('retry-after') : null
}

/**
 * Hace la llamada y reintenta mientras el fallo sea transitorio y queden reintentos.
 * Devuelve la última respuesta (aunque no sea `ok`) para que el llamador la clasifique;
 * si el último intento falló por red, relanza ese error.
 */
export async function fetchWithRetry(
  fetchFn: typeof fetch,
  url: string,
  options: RetryOptions = DEFAULT_RETRY_OPTIONS
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const canRetry = attempt < options.maxRetries
    let res: Response
    try {
      res = await fetchFn(url)
    } catch (error) {
      if (!canRetry || !options.retryOnNetworkError) throw error
      await options.sleep(backoffDelay(attempt, options))
      continue
    }

    if (res.ok || !canRetry || !options.retryableStatuses.includes(res.status)) {
      return res
    }

    const retryAfter = parseRetryAfter(readRetryAfterHeader(res), options)
    await options.sleep(retryAfter ?? backoffDelay(attempt, options))
  }
}

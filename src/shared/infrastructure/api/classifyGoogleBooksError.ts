import {
  BookSearchError,
  SearchApiKeyInvalidError,
  SearchQuotaExceededError,
  SearchRequestFailedError,
  SearchServiceUnavailableError
} from '../../domain/errors/BookSearchErrors.js'

/** Forma del cuerpo de error de las APIs de Google (`{ error: { ... } }`). */
interface GoogleApiErrorBody {
  error?: {
    message?: string
    status?: string
    errors?: Array<{ reason?: string; message?: string }>
    details?: Array<{ reason?: string }>
  }
}

const QUOTA_REASONS = new Set([
  'ratelimitexceeded',
  'userratelimitexceeded',
  'dailylimitexceeded',
  'quotaexceeded',
  'rate_limit_exceeded',
  'resource_exhausted'
])

const KEY_REASONS = new Set([
  'keyinvalid',
  'keyexpired',
  'api_key_invalid',
  'api_key_expired',
  'accessnotconfigured',
  'service_disabled'
])

function collectReasons(body: GoogleApiErrorBody | null): string[] {
  const error = body?.error
  if (!error) return []
  return [
    error.status,
    ...(error.errors ?? []).map((e) => e.reason),
    ...(error.details ?? []).map((d) => d.reason)
  ]
    .filter((r): r is string => typeof r === 'string')
    .map((r) => r.toLowerCase())
}

function mentionsApiKey(body: GoogleApiErrorBody | null): boolean {
  const messages = [body?.error?.message, ...(body?.error?.errors ?? []).map((e) => e.message)]
  return messages.some((m) => typeof m === 'string' && /api key/i.test(m))
}

/**
 * Traduce una respuesta HTTP no exitosa de Google Books (ya sin reintentos pendientes) al
 * error tipado del port. El cuerpo es opcional: si no se pudo leer se decide sólo por status.
 */
export function classifyGoogleBooksError(status: number, body: unknown): BookSearchError {
  const parsed = body && typeof body === 'object' ? (body as GoogleApiErrorBody) : null
  const reasons = collectReasons(parsed)

  if (status === 429) return new SearchQuotaExceededError(status)
  if (status >= 500) return new SearchServiceUnavailableError(status)
  if (status === 400 || status === 403) {
    if (reasons.some((r) => QUOTA_REASONS.has(r))) return new SearchQuotaExceededError(status)
    if (reasons.some((r) => KEY_REASONS.has(r)) || mentionsApiKey(parsed)) {
      return new SearchApiKeyInvalidError(status)
    }
  }
  return new SearchRequestFailedError(status)
}

const SEVERITY: Array<new (...args: never[]) => BookSearchError> = [
  SearchApiKeyInvalidError,
  SearchQuotaExceededError,
  SearchServiceUnavailableError,
  SearchRequestFailedError
]

/**
 * Cuando fallan las dos consultas paralelas, elige el error más útil para el usuario: una key
 * inválida o la cuota explican el problema mejor que un 503 suelto. Ante empate, el primero.
 */
export function pickMostRelevantError(errors: unknown[]): unknown {
  for (const type of SEVERITY) {
    const match = errors.find((e) => e instanceof type)
    if (match) return match
  }
  return errors[0]
}

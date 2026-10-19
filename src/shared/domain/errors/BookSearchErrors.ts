/**
 * Fallos posibles del port `BookSearchService` (feature #27). Forman parte del contrato del
 * port, no de una fuente concreta: cualquier adaptador los lanza y la capa IPC los traduce a
 * códigos. No extienden `DomainError` porque no son errores de validación del usuario.
 */
export class BookSearchError extends Error {
  constructor(
    message: string,
    public readonly status: number | null = null
  ) {
    super(message)
    this.name = this.constructor.name
  }
}

/** La fuente no responde: 5xx o error de red, después de agotar los reintentos. */
export class SearchServiceUnavailableError extends BookSearchError {
  constructor(status: number | null = null) {
    super(
      status === null
        ? 'No se pudo conectar con el servicio de búsqueda de libros'
        : `El servicio de búsqueda de libros no está disponible (HTTP ${status})`,
      status
    )
  }
}

/** Límite de consultas alcanzado (429 tras los reintentos, o 403 por cuota). */
export class SearchQuotaExceededError extends BookSearchError {
  constructor(status: number) {
    super(`Se alcanzó el límite de consultas del servicio de búsqueda (HTTP ${status})`, status)
  }
}

/** La API key configurada fue rechazada (400/403 con motivo de key). */
export class SearchApiKeyInvalidError extends BookSearchError {
  constructor(status: number) {
    super(`La API key del servicio de búsqueda no es válida (HTTP ${status})`, status)
  }
}

/** Cualquier otro rechazo no recuperable de la fuente (4xx sin motivo reconocido). */
export class SearchRequestFailedError extends BookSearchError {
  constructor(status: number) {
    super(`El servicio de búsqueda rechazó la consulta (HTTP ${status})`, status)
  }
}

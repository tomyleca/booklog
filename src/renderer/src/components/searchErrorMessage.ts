import type { IpcErrorCode } from '../../../shared/infrastructure/ipc/contracts.js'

export const SEARCH_ERROR_MESSAGES: Partial<Record<IpcErrorCode, string>> = {
  SEARCH_UNAVAILABLE:
    'Google Books no está respondiendo en este momento. Intenta de nuevo en unos segundos.',
  SEARCH_QUOTA_EXCEEDED:
    'Se alcanzó el límite de consultas a Google Books. Espera unos minutos y vuelve a intentar.',
  SEARCH_INVALID_API_KEY:
    'Google Books rechazó la API key configurada. Revísala en Configuración y vuelve a intentar.',
  SEARCH_FAILED: 'Google Books no pudo procesar la búsqueda. Prueba con otro término.'
}

export const SEARCH_ERROR_FALLBACK = 'Error al buscar libros en Google Books.'

/** Mensaje para el usuario según el código IPC de la búsqueda (feature #27). */
export function searchErrorMessage(code: string | undefined, fallback?: string): string {
  const known = code ? SEARCH_ERROR_MESSAGES[code as IpcErrorCode] : undefined
  return known ?? (fallback || SEARCH_ERROR_FALLBACK)
}

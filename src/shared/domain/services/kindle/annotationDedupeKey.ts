import type { AnnotationLocationInput } from '../../entities/AnnotationLocation.js'

/** Texto normalizado para comparar anotaciones: NFC, espacios colapsados y sin bordes. */
export function normalizeAnnotationText(value: string): string {
  return value.normalize('NFC').replace(/\s+/gu, ' ').trim()
}

/**
 * Inicio de la ubicación para comparar entre fuentes: la posición si existe, si no la página.
 * Solo el inicio: `My Clippings.txt` guarda rangos (`1265-1268`) y la exportación del
 * Cuaderno solo el inicio (`1265`).
 */
export function annotationStartKey(location: AnnotationLocationInput): string | null {
  if (location.position) return `pos:${location.position.start}`
  if (location.page) return `page:${location.page.start}`
  return null
}

/**
 * Clave de contenido de un subrayado o una nota del Kindle (feature #26, decisión del
 * usuario): misma ubicación de inicio + mismo texto normalizado = la misma anotación, venga
 * de `My Clippings.txt` o de la exportación de la app. Al importar, si el libro ya tiene una
 * anotación del mismo tipo con la misma clave, no se crea otra (gana la existente). Las
 * anotaciones sin ubicación no tienen clave.
 */
export function annotationDedupeKey(
  location: AnnotationLocationInput | null | undefined,
  content: string
): string | null {
  const start = location ? annotationStartKey(location) : null
  if (!start) return null
  return `${start}|${normalizeAnnotationText(content)}`
}

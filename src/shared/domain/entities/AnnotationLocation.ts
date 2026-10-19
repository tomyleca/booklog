import { InvalidAnnotationLocationError } from '../errors/DomainErrors.js'

/**
 * Ubicación de un subrayado o de una nota importada dentro del libro (features #22 y #23).
 * El Kindle referencia por número de **página** (libros con paginación real), por
 * **posición** (unidad propia del Kindle) o por ambas a la vez
 * (`en la página 12 | posición 180-183`), cada una con un número suelto o un rango.
 * Se guardan las dos: la página es la que entiende el lector y la posición es más fina
 * para comparar entradas (vínculo nota → subrayado, huella).
 */
export interface LocationRange {
  readonly start: number
  /** `null` cuando la referencia es un número suelto. */
  readonly end: number | null
}

export interface LocationRangeInput {
  start: number
  end?: number | null
}

export interface AnnotationLocation {
  readonly page: LocationRange | null
  readonly position: LocationRange | null
}

export interface AnnotationLocationInput {
  page?: LocationRangeInput | null
  position?: LocationRangeInput | null
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

/**
 * Valida y normaliza un rango. Un rango con inicio y fin iguales (`12-12`) se guarda como
 * número suelto, para que dos referencias equivalentes queden idénticas.
 */
export function createLocationRange(input: LocationRangeInput, label: string): LocationRange {
  if (!isPositiveInteger(input?.start)) {
    throw new InvalidAnnotationLocationError(
      `El inicio de la ${label} debe ser un número entero positivo.`
    )
  }

  const end = input.end ?? null
  if (end !== null) {
    if (!isPositiveInteger(end)) {
      throw new InvalidAnnotationLocationError(
        `El fin de la ${label} debe ser un número entero positivo.`
      )
    }
    if (end < input.start) {
      throw new InvalidAnnotationLocationError(
        `El fin de la ${label} no puede ser anterior a su inicio.`
      )
    }
  }

  return Object.freeze({ start: input.start, end: end === input.start ? null : end })
}

/** Valida una ubicación: página y posición son opcionales, pero al menos una es obligatoria. */
export function createAnnotationLocation(input: AnnotationLocationInput): AnnotationLocation {
  const page = input?.page ? createLocationRange(input.page, 'página') : null
  const position = input?.position ? createLocationRange(input.position, 'posición') : null
  if (page === null && position === null) {
    throw new InvalidAnnotationLocationError(
      'La ubicación necesita al menos una página o una posición.'
    )
  }
  return Object.freeze({ page, position })
}

/** Último número que abarca el rango (el fin o, si no hay rango, el inicio). */
export function locationLastPoint(range: LocationRange): number {
  return range.end ?? range.start
}

/** `true` si `point` cae dentro de `[inicio, fin]`, ambos inclusive. */
export function rangeContains(range: LocationRange, point: number): boolean {
  return point >= range.start && point <= locationLastPoint(range)
}

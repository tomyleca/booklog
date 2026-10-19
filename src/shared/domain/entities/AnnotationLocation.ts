import { InvalidAnnotationLocationError } from '../errors/DomainErrors.js'

/**
 * Ubicación de un subrayado o de una nota importada dentro del libro (feature #22).
 * El Kindle referencia por número de página (libros con paginación real) o por
 * "posición" (unidad propia del Kindle), con un número suelto o un rango `inicio-fin`.
 */
export const LocationKind = {
  PAGE: 'PAGE',
  LOCATION: 'LOCATION'
} as const

export type LocationKind = (typeof LocationKind)[keyof typeof LocationKind]

export const ALL_LOCATION_KINDS: readonly LocationKind[] = Object.values(LocationKind)

export function isLocationKind(value: unknown): value is LocationKind {
  return typeof value === 'string' && ALL_LOCATION_KINDS.includes(value as LocationKind)
}

export interface AnnotationLocation {
  readonly kind: LocationKind
  readonly start: number
  /** `null` cuando la referencia es un número suelto. */
  readonly end: number | null
}

export interface AnnotationLocationInput {
  kind: LocationKind
  start: number
  end?: number | null
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

/**
 * Valida y normaliza una ubicación. Un rango con inicio y fin iguales (`12-12`) se guarda
 * como número suelto, para que dos referencias equivalentes queden idénticas.
 */
export function createAnnotationLocation(input: AnnotationLocationInput): AnnotationLocation {
  if (!isLocationKind(input.kind)) {
    throw new InvalidAnnotationLocationError(
      `El tipo de ubicación debe ser PAGE o LOCATION, se recibió ${String(input.kind)}.`
    )
  }
  if (!isPositiveInteger(input.start)) {
    throw new InvalidAnnotationLocationError(
      'El inicio de la ubicación debe ser un número entero positivo.'
    )
  }

  const end = input.end ?? null
  if (end !== null) {
    if (!isPositiveInteger(end)) {
      throw new InvalidAnnotationLocationError(
        'El fin de la ubicación debe ser un número entero positivo.'
      )
    }
    if (end < input.start) {
      throw new InvalidAnnotationLocationError(
        'El fin de la ubicación no puede ser anterior a su inicio.'
      )
    }
  }

  return Object.freeze({
    kind: input.kind,
    start: input.start,
    end: end === input.start ? null : end
  })
}

/** Último número que abarca la ubicación (el fin del rango o, si no hay rango, el inicio). */
export function locationLastPoint(location: AnnotationLocation): number {
  return location.end ?? location.start
}

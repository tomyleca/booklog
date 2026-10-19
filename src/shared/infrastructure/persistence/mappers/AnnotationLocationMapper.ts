import type {
  AnnotationLocation,
  LocationRange
} from '../../../domain/entities/AnnotationLocation.js'

export interface AnnotationLocationColumns {
  pageStart: number | null
  pageEnd: number | null
  positionStart: number | null
  positionEnd: number | null
}

function toRange(start: number | null, end: number | null): LocationRange | null {
  return typeof start === 'number' ? { start, end: end ?? null } : null
}

/**
 * La ubicación es un value object en el dominio (página y posición, ambas opcionales) y
 * cuatro columnas planas en la tabla.
 */
export class AnnotationLocationMapper {
  public static toDomain(columns: AnnotationLocationColumns): AnnotationLocation | null {
    const page = toRange(columns.pageStart, columns.pageEnd)
    const position = toRange(columns.positionStart, columns.positionEnd)
    if (!page && !position) return null
    return { page, position }
  }

  public static toColumns(location: AnnotationLocation | null): AnnotationLocationColumns {
    return {
      pageStart: location?.page?.start ?? null,
      pageEnd: location?.page?.end ?? null,
      positionStart: location?.position?.start ?? null,
      positionEnd: location?.position?.end ?? null
    }
  }
}

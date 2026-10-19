import type { LocationKind as PrismaLocationKind } from '@prisma/client'
import type { AnnotationLocation } from '../../../domain/entities/AnnotationLocation.js'

export interface AnnotationLocationColumns {
  locationKind: PrismaLocationKind
  locationStart: number
  locationEnd: number | null
}

/** La ubicación es un value object en el dominio y tres columnas planas en la tabla. */
export class AnnotationLocationMapper {
  public static toDomain(columns: {
    locationKind: PrismaLocationKind | null
    locationStart: number | null
    locationEnd: number | null
  }): AnnotationLocation | null {
    if (!columns.locationKind || typeof columns.locationStart !== 'number') {
      return null
    }
    return {
      kind: columns.locationKind,
      start: columns.locationStart,
      end: columns.locationEnd ?? null
    }
  }

  public static toColumns(location: AnnotationLocation): AnnotationLocationColumns {
    return {
      locationKind: location.kind,
      locationStart: location.start,
      locationEnd: location.end
    }
  }
}

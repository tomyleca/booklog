import type { Highlight as PrismaHighlight, Prisma } from '@prisma/client'
import { Highlight } from '../../../domain/entities/Highlight.js'
import { isHighlightColor } from '../../../domain/entities/HighlightColor.js'
import { AnnotationLocationMapper } from './AnnotationLocationMapper.js'

export class HighlightMapper {
  public static toDomain(raw: PrismaHighlight): Highlight {
    return new Highlight({
      id: raw.id,
      bookId: raw.bookId,
      content: raw.content,
      location: AnnotationLocationMapper.toDomain(raw) ?? {},
      capturedAt: raw.capturedAt,
      fingerprint: raw.fingerprint,
      color: isHighlightColor(raw.color) ? raw.color : null,
      createdAt: raw.createdAt
    })
  }

  public static toPersistence(highlight: Highlight): Prisma.HighlightUncheckedCreateInput {
    return {
      ...(highlight.id !== undefined ? { id: highlight.id } : {}),
      bookId: highlight.bookId,
      content: highlight.content,
      ...AnnotationLocationMapper.toColumns(highlight.location),
      capturedAt: highlight.capturedAt,
      fingerprint: highlight.fingerprint,
      color: highlight.color,
      createdAt: highlight.createdAt
    }
  }
}

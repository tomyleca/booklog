import type { Note as PrismaNote, Prisma } from '@prisma/client'
import { Note } from '../../../domain/entities/Note.js'
import { AnnotationLocationMapper } from './AnnotationLocationMapper.js'

export class NoteMapper {
  public static toDomain(raw: PrismaNote): Note {
    return new Note({
      id: raw.id,
      bookId: raw.bookId,
      content: raw.content,
      origin: raw.origin,
      highlightId: raw.highlightId,
      location: AnnotationLocationMapper.toDomain(raw),
      capturedAt: raw.capturedAt,
      fingerprint: raw.fingerprint,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt
    })
  }

  public static toPersistence(note: Note): Prisma.NoteUncheckedCreateInput {
    const location = AnnotationLocationMapper.toColumns(note.location)

    return {
      ...(note.id !== undefined ? { id: note.id } : {}),
      bookId: note.bookId,
      content: note.content,
      origin: note.origin,
      highlightId: note.highlightId,
      ...location,
      capturedAt: note.capturedAt,
      fingerprint: note.fingerprint,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt
    }
  }
}

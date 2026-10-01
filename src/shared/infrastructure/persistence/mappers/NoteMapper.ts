import type { Note as PrismaNote, Prisma } from '@prisma/client'
import { Note } from '../../../domain/entities/Note.js'

export class NoteMapper {
  public static toDomain(raw: PrismaNote): Note {
    return new Note({
      id: raw.id,
      bookId: raw.bookId,
      content: raw.content,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt
    })
  }

  public static toPersistence(note: Note): Prisma.NoteUncheckedCreateInput {
    return {
      ...(note.id !== undefined ? { id: note.id } : {}),
      bookId: note.bookId,
      content: note.content,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt
    }
  }
}

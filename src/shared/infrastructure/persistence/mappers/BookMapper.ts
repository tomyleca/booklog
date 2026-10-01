import type {
  Book as PrismaBook,
  Note as PrismaNote,
  Prisma,
  BookStatus as PrismaBookStatus
} from '@prisma/client'
import { Book } from '../../../domain/entities/Book.js'
import { BookStatus } from '../../../domain/entities/BookStatus.js'
import { NoteMapper } from './NoteMapper.js'

export class BookMapper {
  /**
   * Safely deserializes authors from a JSON string or falls back to raw string.
   */
  public static deserializeAuthors(authorsRaw: string): string {
    if (!authorsRaw || typeof authorsRaw !== 'string') {
      return ''
    }

    try {
      const parsed = JSON.parse(authorsRaw)
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => String(item).trim())
          .filter(Boolean)
          .join(', ')
      }
      if (typeof parsed === 'string') {
        return parsed.trim()
      }
    } catch {
      // Safe fallback if raw string is not JSON
    }

    return authorsRaw.trim()
  }

  /**
   * Serializes domain authors string to JSON array string for relational storage.
   */
  public static serializeAuthors(authors: string): string {
    if (!authors || typeof authors !== 'string') {
      return JSON.stringify([])
    }

    try {
      const parsed = JSON.parse(authors)
      if (Array.isArray(parsed)) {
        return JSON.stringify(parsed.map((item) => String(item).trim()).filter(Boolean))
      }
    } catch {
      // Not a JSON string
    }

    const authorsList = authors
      .split(',')
      .map((a) => a.trim())
      .filter((a) => a.length > 0)

    return JSON.stringify(authorsList.length > 0 ? authorsList : [authors.trim()])
  }

  /**
   * Converts a Prisma Book record into a domain Book entity.
   */
  public static toDomain(raw: PrismaBook & { notes?: PrismaNote[] }): Book {
    const authors = BookMapper.deserializeAuthors(raw.authors)

    return new Book({
      id: raw.id,
      googleBooksId: raw.googleBooksId,
      title: raw.title,
      authors: authors.length > 0 ? authors : raw.authors,
      coverUrl: raw.coverUrl,
      coverPath: raw.coverPath,
      pageCount: raw.pageCount,
      currentPage: raw.currentPage,
      progressPercentage: raw.progressPercentage,
      isbn: raw.isbn,
      status: raw.status as BookStatus,
      rating: raw.rating,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      notes: raw.notes ? raw.notes.map((n) => NoteMapper.toDomain(n)) : []
    })
  }

  /**
   * Converts a domain Book entity into a Prisma create/update input payload.
   */
  public static toPersistence(book: Book): Prisma.BookUncheckedCreateInput {
    return {
      ...(book.id !== undefined ? { id: book.id } : {}),
      googleBooksId: book.googleBooksId ?? null,
      title: book.title,
      authors: BookMapper.serializeAuthors(book.authors),
      coverUrl: book.coverUrl ?? null,
      coverPath: book.coverPath ?? null,
      pageCount: book.pageCount ?? null,
      currentPage: book.currentPage ?? null,
      progressPercentage: book.progressPercentage ?? null,
      isbn: book.isbn ?? null,
      status: book.status as unknown as PrismaBookStatus,
      rating: book.rating ?? null,
      createdAt: book.createdAt,
      updatedAt: book.updatedAt
    }
  }
}

import type { BookPrimitives } from '../../domain/entities/Book.js'
import type { NotePrimitives } from '../../domain/entities/Note.js'
import { BookStatus } from '../../domain/entities/BookStatus.js'
import { DomainError } from '../../domain/errors/DomainErrors.js'
import { BookNotFoundError } from '../../application/errors/BookNotFoundError.js'
import { NoteNotFoundError } from '../../application/errors/NoteNotFoundError.js'

import type { AddBookDTO } from '../../application/use-cases/AddBook.js'
import type { ListBooksDTO } from '../../application/use-cases/ListBooks.js'
import type { UpdateBookStatusDTO } from '../../application/use-cases/UpdateBookStatus.js'
import type { UpdateBookProgressDTO } from '../../application/use-cases/UpdateBookProgress.js'
import type { RateBookDTO } from '../../application/use-cases/RateBook.js'
import type { DeleteBookDTO } from '../../application/use-cases/DeleteBook.js'
import type { GetBookByIdDTO } from '../../application/use-cases/GetBookById.js'
import type { AddNoteDTO } from '../../application/use-cases/AddNote.js'
import type { GetBookNotesDTO } from '../../application/use-cases/GetBookNotes.js'
import type { UpdateNoteDTO } from '../../application/use-cases/UpdateNote.js'
import type { DeleteNoteDTO } from '../../application/use-cases/DeleteNote.js'
import type { BookSearchResult } from '../../domain/ports/BookSearchService.js'

export interface SearchBooksDTO {
  query: string
}

export type IpcResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string }

export function ipcSuccess<T>(data: T): IpcResult<T> {
  return { success: true, data }
}

export function ipcError<T = never>(error: string, code?: string): IpcResult<T> {
  return { success: false, error, code }
}

export const IPC_ERROR_CODES = {
  BOOK_NOT_FOUND: 'BOOK_NOT_FOUND',
  NOTE_NOT_FOUND: 'NOTE_NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  COVER_STORAGE_ERROR: 'COVER_STORAGE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const

export type IpcErrorCode = (typeof IPC_ERROR_CODES)[keyof typeof IPC_ERROR_CODES]

export function formatIpcError(err: unknown): { success: false; error: string; code: string } {
  if (err instanceof BookNotFoundError) {
    return { success: false, error: err.message, code: IPC_ERROR_CODES.BOOK_NOT_FOUND }
  }
  if (err instanceof NoteNotFoundError) {
    return { success: false, error: err.message, code: IPC_ERROR_CODES.NOTE_NOT_FOUND }
  }
  if (err instanceof DomainError) {
    return { success: false, error: err.message, code: IPC_ERROR_CODES.VALIDATION_ERROR }
  }
  if (err instanceof Error) {
    return { success: false, error: err.message, code: IPC_ERROR_CODES.INTERNAL_ERROR }
  }
  return { success: false, error: String(err), code: IPC_ERROR_CODES.INTERNAL_ERROR }
}

export interface SaveCoverFromUrlDTO {
  url: string
}

export interface SaveCoverFromLocalDTO {
  filePath: string
}

export {
  BookPrimitives,
  NotePrimitives,
  BookStatus,
  AddBookDTO,
  ListBooksDTO,
  UpdateBookStatusDTO,
  UpdateBookProgressDTO,
  RateBookDTO,
  DeleteBookDTO,
  GetBookByIdDTO,
  AddNoteDTO,
  GetBookNotesDTO,
  UpdateNoteDTO,
  DeleteNoteDTO,
  BookSearchResult
}

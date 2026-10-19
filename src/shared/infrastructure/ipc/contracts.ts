import type { BookPrimitives } from '../../domain/entities/Book.js'
import type { NotePrimitives } from '../../domain/entities/Note.js'
import type { HighlightPrimitives } from '../../domain/entities/Highlight.js'
import type {
  AnnotationLocation,
  LocationRange
} from '../../domain/entities/AnnotationLocation.js'
import { NoteOrigin } from '../../domain/entities/NoteOrigin.js'
import { BookStatus } from '../../domain/entities/BookStatus.js'
import { DomainError } from '../../domain/errors/DomainErrors.js'
import { BookNotFoundError } from '../../application/errors/BookNotFoundError.js'
import { NoteNotFoundError } from '../../application/errors/NoteNotFoundError.js'
import { HighlightNotFoundError } from '../../application/errors/HighlightNotFoundError.js'

import type { AddBookDTO } from '../../application/use-cases/AddBook.js'
import type { ListBooksDTO } from '../../application/use-cases/ListBooks.js'
import type { UpdateBookStatusDTO } from '../../application/use-cases/UpdateBookStatus.js'
import type { UpdateBookProgressDTO } from '../../application/use-cases/UpdateBookProgress.js'
import type { RateBookDTO } from '../../application/use-cases/RateBook.js'
import type { SetFinishedDateDTO } from '../../application/use-cases/SetFinishedDate.js'
import type { DeleteBookDTO } from '../../application/use-cases/DeleteBook.js'
import type { GetBookByIdDTO } from '../../application/use-cases/GetBookById.js'
import type { AddNoteDTO } from '../../application/use-cases/AddNote.js'
import type { GetBookNotesDTO } from '../../application/use-cases/GetBookNotes.js'
import type { UpdateNoteDTO } from '../../application/use-cases/UpdateNote.js'
import type { DeleteNoteDTO } from '../../application/use-cases/DeleteNote.js'
import type { GetBookHighlightsDTO } from '../../application/use-cases/GetBookHighlights.js'
import type { DeleteHighlightDTO } from '../../application/use-cases/DeleteHighlight.js'
import type { BookSearchResult } from '../../domain/ports/BookSearchService.js'
import type {
  KindleImportGroupPreview,
  KindleImportPreview
} from '../../application/use-cases/PreviewKindleImport.js'
import type {
  KindleImportAssignment,
  KindleImportBookReport,
  KindleImportReport
} from '../../application/use-cases/CommitKindleImport.js'
import type {
  KindleBookMatch,
  KindleMatchConfidence,
  KindleMatchMethod
} from '../../domain/services/kindle/matchKindleBook.js'

/**
 * Contrato de `search:books`. `author` es opcional (feature #21); el canal también acepta
 * un string suelto con el texto libre, por compatibilidad con la versión anterior.
 */
export interface SearchBooksDTO {
  query: string
  author?: string | null
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
  HIGHLIGHT_NOT_FOUND: 'HIGHLIGHT_NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  COVER_STORAGE_ERROR: 'COVER_STORAGE_ERROR',
  SETTINGS_ERROR: 'SETTINGS_ERROR',
  KINDLE_NOT_FOUND: 'KINDLE_NOT_FOUND',
  KINDLE_COPY_TIMEOUT: 'KINDLE_COPY_TIMEOUT',
  KINDLE_UNSUPPORTED: 'KINDLE_UNSUPPORTED',
  KINDLE_DEVICE_ERROR: 'KINDLE_DEVICE_ERROR',
  KINDLE_FILE_ERROR: 'KINDLE_FILE_ERROR',
  KINDLE_SESSION_EXPIRED: 'KINDLE_SESSION_EXPIRED',
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
  if (err instanceof HighlightNotFoundError) {
    return { success: false, error: err.message, code: IPC_ERROR_CODES.HIGHLIGHT_NOT_FOUND }
  }
  if (err instanceof DomainError) {
    return { success: false, error: err.message, code: IPC_ERROR_CODES.VALIDATION_ERROR }
  }
  if (err instanceof Error) {
    return { success: false, error: err.message, code: IPC_ERROR_CODES.INTERNAL_ERROR }
  }
  return { success: false, error: String(err), code: IPC_ERROR_CODES.INTERNAL_ERROR }
}

/** De dónde salió el archivo que se está importando (feature #23). */
export type KindleImportSource = 'DEVICE' | 'FILE'

export interface KindlePreviewResultDTO {
  /** Identifica el texto guardado en el main process; se devuelve en el commit. */
  sourceId: string
  source: KindleImportSource
  /** Nombre del Kindle o del archivo elegido. */
  sourceLabel: string
  preview: KindleImportPreview
}

export interface CommitKindleImportRequestDTO {
  sourceId: string
  assignments: KindleImportAssignment[]
}

export interface SaveCoverFromUrlDTO {
  url: string
}

export interface SaveCoverFromLocalDTO {
  filePath: string
}

export type AppTheme = 'dark' | 'light' | 'system'

export interface AppSettingsDTO {
  googleBooksApiKey: string
  theme: AppTheme
}

export interface SaveSettingsDTO {
  googleBooksApiKey?: string
  theme?: AppTheme
}

export interface TestApiKeyDTO {
  apiKey: string
}

export interface TestApiKeyResultDTO {
  valid: boolean
}

export interface AppInfoDTO {
  name: string
  version: string
  electronVersion: string
  nodeVersion: string
  chromeVersion: string
  repositoryUrl: string
  license: string
}

export {
  BookPrimitives,
  NotePrimitives,
  HighlightPrimitives,
  AnnotationLocation,
  LocationRange,
  NoteOrigin,
  BookStatus,
  AddBookDTO,
  ListBooksDTO,
  UpdateBookStatusDTO,
  UpdateBookProgressDTO,
  RateBookDTO,
  SetFinishedDateDTO,
  DeleteBookDTO,
  GetBookByIdDTO,
  AddNoteDTO,
  GetBookNotesDTO,
  UpdateNoteDTO,
  DeleteNoteDTO,
  GetBookHighlightsDTO,
  DeleteHighlightDTO,
  BookSearchResult,
  KindleImportGroupPreview,
  KindleImportPreview,
  KindleImportAssignment,
  KindleImportBookReport,
  KindleImportReport,
  KindleBookMatch,
  KindleMatchConfidence,
  KindleMatchMethod
}

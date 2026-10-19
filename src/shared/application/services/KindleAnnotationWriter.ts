import type { BookRepository } from '../../domain/ports/BookRepository.js'
import type { HighlightRepository } from '../../domain/ports/HighlightRepository.js'
import type { NoteRepository } from '../../domain/ports/NoteRepository.js'
import { Highlight } from '../../domain/entities/Highlight.js'
import { Note } from '../../domain/entities/Note.js'
import { annotationDedupeKey } from '../../domain/services/kindle/annotationDedupeKey.js'
import type { ResolvedKindleAnnotations } from '../../domain/services/kindle/resolveKindleAnnotations.js'
import { BookNotFoundError } from '../errors/BookNotFoundError.js'

export interface KindleImportBookReport {
  bookId: number
  title: string
  highlightsImported: number
  notesImported: number
  highlightsSkipped: number
  notesSkipped: number
}

export interface KindleImportReport {
  highlightsImported: number
  notesImported: number
  /** Ya existían en el libro (misma huella o misma clave de contenido): no se duplican. */
  highlightsSkipped: number
  notesSkipped: number
  /** Grupos (títulos o archivos) que el usuario decidió no importar. */
  groupsNotImported: number
  books: KindleImportBookReport[]
}

export function emptyKindleImportReport(groupsNotImported: number): KindleImportReport {
  return {
    highlightsImported: 0,
    notesImported: 0,
    highlightsSkipped: 0,
    notesSkipped: 0,
    groupsNotImported,
    books: []
  }
}

export function addBookReport(report: KindleImportReport, book: KindleImportBookReport): void {
  report.books.push(book)
  report.highlightsImported += book.highlightsImported
  report.notesImported += book.notesImported
  report.highlightsSkipped += book.highlightsSkipped
  report.notesSkipped += book.notesSkipped
}

/**
 * Escritura común de las dos importaciones del Kindle (`My Clippings.txt`, #23, y la
 * exportación del Cuaderno de la app, #26). Recibe anotaciones ya resueltas y las crea en un
 * libro sin duplicar:
 * - **misma huella** que una anotación del libro → se omite (reimportar la misma fuente);
 * - **misma clave de contenido** (`annotationDedupeKey`: ubicación de inicio + texto
 *   normalizado) que una anotación del mismo tipo → se omite y gana la existente (la misma
 *   anotación llegada por la otra fuente). Si era un subrayado, las notas que lo comentan se
 *   vinculan al existente.
 */
export class KindleAnnotationWriter {
  constructor(
    private readonly highlightRepository: HighlightRepository,
    private readonly noteRepository: NoteRepository
  ) {}

  /** Valida que existan todos los libros antes de escribir nada; devuelve sus títulos. */
  public static async loadBookTitles(
    bookRepository: BookRepository,
    bookIds: Iterable<number>
  ): Promise<Map<number, string>> {
    const titles = new Map<number, string>()
    for (const bookId of bookIds) {
      const book = await bookRepository.findById(bookId)
      if (!book) {
        throw new BookNotFoundError(bookId)
      }
      titles.set(bookId, book.title)
    }
    return titles
  }

  public async importIntoBook(
    bookId: number,
    title: string,
    batches: ResolvedKindleAnnotations[]
  ): Promise<KindleImportBookReport> {
    const report: KindleImportBookReport = {
      bookId,
      title,
      highlightsImported: 0,
      notesImported: 0,
      highlightsSkipped: 0,
      notesSkipped: 0
    }

    const highlightIds = new Map<string, number>()
    const highlightKeys = new Map<string, number>()
    for (const existing of await this.highlightRepository.findByBookId(bookId)) {
      if (existing.id === undefined) continue
      highlightIds.set(existing.fingerprint, existing.id)
      const key = annotationDedupeKey(existing.location, existing.content)
      if (key && !highlightKeys.has(key)) highlightKeys.set(key, existing.id)
    }
    const noteFingerprints = new Set<string>()
    const noteKeys = new Set<string>()
    for (const existing of await this.noteRepository.findByBookId(bookId)) {
      if (existing.fingerprint) noteFingerprints.add(existing.fingerprint)
      const key = annotationDedupeKey(existing.location, existing.content)
      if (key) noteKeys.add(key)
    }

    for (const resolved of batches) {
      for (const highlight of resolved.highlights) {
        if (highlightIds.has(highlight.fingerprint)) {
          report.highlightsSkipped++
          continue
        }
        const key = annotationDedupeKey(highlight.location, highlight.content)
        const sameContentId = key ? highlightKeys.get(key) : undefined
        if (sameContentId !== undefined) {
          highlightIds.set(highlight.fingerprint, sameContentId)
          report.highlightsSkipped++
          continue
        }
        const created = await this.highlightRepository.create(
          Highlight.create({ bookId, ...highlight })
        )
        if (created.id !== undefined) {
          highlightIds.set(created.fingerprint, created.id)
          if (key) highlightKeys.set(key, created.id)
        }
        report.highlightsImported++
      }

      for (const note of resolved.notes) {
        const key = annotationDedupeKey(note.location, note.content)
        if (noteFingerprints.has(note.fingerprint) || (key && noteKeys.has(key))) {
          report.notesSkipped++
          continue
        }
        const highlightId = note.highlightFingerprint
          ? (highlightIds.get(note.highlightFingerprint) ?? null)
          : null
        await this.noteRepository.create(
          Note.createImported({
            bookId,
            content: note.content,
            location: note.location,
            capturedAt: note.capturedAt,
            fingerprint: note.fingerprint,
            highlightId
          })
        )
        noteFingerprints.add(note.fingerprint)
        if (key) noteKeys.add(key)
        report.notesImported++
      }
    }

    return report
  }
}

import type { BookRepository } from '../../domain/ports/BookRepository.js'
import type { HighlightRepository } from '../../domain/ports/HighlightRepository.js'
import type { NoteRepository } from '../../domain/ports/NoteRepository.js'
import { Highlight } from '../../domain/entities/Highlight.js'
import { Note } from '../../domain/entities/Note.js'
import { InvalidKindleImportError } from '../../domain/errors/DomainErrors.js'
import { parseKindleClippings } from '../../domain/services/kindle/parseKindleClippings.js'
import { groupKindleClippings } from '../../domain/services/kindle/groupKindleClippings.js'
import type { KindleTitleGroup } from '../../domain/services/kindle/groupKindleClippings.js'
import { resolveKindleAnnotations } from '../../domain/services/kindle/resolveKindleAnnotations.js'
import { BookNotFoundError } from '../errors/BookNotFoundError.js'

export interface KindleImportAssignment {
  groupKey: string
  bookId: number
}

export interface CommitKindleImportDTO {
  text: string
  /** Grupos a importar y el libro de destino. Los grupos que no figuran no se importan. */
  assignments: KindleImportAssignment[]
}

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
  /** Ya existían (misma huella en el libro): no se duplican. */
  highlightsSkipped: number
  notesSkipped: number
  /** Grupos del archivo que el usuario decidió no importar. */
  groupsNotImported: number
  books: KindleImportBookReport[]
}

/**
 * Paso 2 de la importación: con las asignaciones finales grupo → libro, crea subrayados y
 * notas `KINDLE`. Antes de crear consulta las huellas que el libro ya tiene, así reimportar
 * el mismo archivo no duplica nada. Las notas se vinculan al subrayado que comentan, sea
 * nuevo o importado antes.
 */
export class CommitKindleImport {
  constructor(
    private readonly bookRepository: BookRepository,
    private readonly highlightRepository: HighlightRepository,
    private readonly noteRepository: NoteRepository
  ) {}

  public async execute(dto: CommitKindleImportDTO): Promise<KindleImportReport> {
    const groups = groupKindleClippings(parseKindleClippings(dto.text).clippings)
    const groupsByKey = new Map(groups.map((group) => [group.key, group]))
    const groupsByBook = this.groupAssignments(dto.assignments, groupsByKey)

    const report: KindleImportReport = {
      highlightsImported: 0,
      notesImported: 0,
      highlightsSkipped: 0,
      notesSkipped: 0,
      groupsNotImported: groups.length - [...groupsByBook.values()].flat().length,
      books: []
    }

    // Se validan todos los libros antes de escribir, para no dejar una importación a medias
    // por un libro inexistente.
    const titles = new Map<number, string>()
    for (const bookId of groupsByBook.keys()) {
      const book = await this.bookRepository.findById(bookId)
      if (!book) {
        throw new BookNotFoundError(bookId)
      }
      titles.set(bookId, book.title)
    }

    for (const [bookId, bookGroups] of groupsByBook) {
      const bookReport = await this.importIntoBook(bookId, titles.get(bookId) ?? '', bookGroups)
      report.books.push(bookReport)
      report.highlightsImported += bookReport.highlightsImported
      report.notesImported += bookReport.notesImported
      report.highlightsSkipped += bookReport.highlightsSkipped
      report.notesSkipped += bookReport.notesSkipped
    }

    return report
  }

  private groupAssignments(
    assignments: KindleImportAssignment[],
    groupsByKey: Map<string, KindleTitleGroup>
  ): Map<number, KindleTitleGroup[]> {
    if (!Array.isArray(assignments)) {
      throw new InvalidKindleImportError('Las asignaciones de la importación no son válidas.')
    }
    const assignedKeys = new Set<string>()
    const byBook = new Map<number, KindleTitleGroup[]>()
    for (const assignment of assignments) {
      if (!Number.isInteger(assignment?.bookId) || assignment.bookId <= 0) {
        throw new InvalidKindleImportError('Cada grupo a importar necesita un libro válido.')
      }
      const group = groupsByKey.get(assignment.groupKey)
      if (!group) {
        throw new InvalidKindleImportError(
          `El título "${String(assignment.groupKey)}" no está en el archivo importado.`
        )
      }
      if (assignedKeys.has(group.key)) {
        throw new InvalidKindleImportError(`El título "${group.key}" se asignó más de una vez.`)
      }
      assignedKeys.add(group.key)
      byBook.set(assignment.bookId, [...(byBook.get(assignment.bookId) ?? []), group])
    }
    return byBook
  }

  private async importIntoBook(
    bookId: number,
    title: string,
    groups: KindleTitleGroup[]
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
    for (const existing of await this.highlightRepository.findByBookId(bookId)) {
      if (existing.id !== undefined) highlightIds.set(existing.fingerprint, existing.id)
    }
    const noteFingerprints = new Set<string>()
    for (const existing of await this.noteRepository.findByBookId(bookId)) {
      if (existing.fingerprint) noteFingerprints.add(existing.fingerprint)
    }

    for (const group of groups) {
      const resolved = resolveKindleAnnotations(group.clippings)

      for (const highlight of resolved.highlights) {
        if (highlightIds.has(highlight.fingerprint)) {
          report.highlightsSkipped++
          continue
        }
        const created = await this.highlightRepository.create(
          Highlight.create({ bookId, ...highlight })
        )
        if (created.id !== undefined) highlightIds.set(created.fingerprint, created.id)
        report.highlightsImported++
      }

      for (const note of resolved.notes) {
        if (noteFingerprints.has(note.fingerprint)) {
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
        report.notesImported++
      }
    }

    return report
  }
}

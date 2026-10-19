import type { BookRepository } from '../../domain/ports/BookRepository.js'
import type { HighlightRepository } from '../../domain/ports/HighlightRepository.js'
import type { NoteRepository } from '../../domain/ports/NoteRepository.js'
import { parseKindleClippings } from '../../domain/services/kindle/parseKindleClippings.js'
import { groupKindleClippings } from '../../domain/services/kindle/groupKindleClippings.js'
import { resolveKindleAnnotations } from '../../domain/services/kindle/resolveKindleAnnotations.js'
import {
  addBookReport,
  emptyKindleImportReport,
  KindleAnnotationWriter
} from '../services/KindleAnnotationWriter.js'
import type { KindleImportReport } from '../services/KindleAnnotationWriter.js'
import { groupAssignmentsByBook } from '../services/kindleAssignments.js'
import type { KindleImportAssignment } from '../services/kindleAssignments.js'

export type {
  KindleImportBookReport,
  KindleImportReport
} from '../services/KindleAnnotationWriter.js'
export type { KindleImportAssignment } from '../services/kindleAssignments.js'

export interface CommitKindleImportDTO {
  text: string
  /** Grupos a importar y el libro de destino. Los grupos que no figuran no se importan. */
  assignments: KindleImportAssignment[]
}

/**
 * Paso 2 de la importación: con las asignaciones finales grupo → libro, crea subrayados y
 * notas `KINDLE` con `KindleAnnotationWriter`: reimportar el mismo archivo no duplica
 * (huella) y lo que ya llegó por la exportación del Cuaderno tampoco (clave de contenido,
 * #26). Las notas se vinculan al subrayado que comentan, sea nuevo o importado antes.
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
    const groupsByBook = groupAssignmentsByBook(dto.assignments, groupsByKey)

    const report = emptyKindleImportReport(groups.length - [...groupsByBook.values()].flat().length)

    // Se validan todos los libros antes de escribir, para no dejar una importación a medias
    // por un libro inexistente.
    const titles = await KindleAnnotationWriter.loadBookTitles(
      this.bookRepository,
      groupsByBook.keys()
    )

    const writer = new KindleAnnotationWriter(this.highlightRepository, this.noteRepository)
    for (const [bookId, bookGroups] of groupsByBook) {
      const batches = bookGroups.map((group) => resolveKindleAnnotations(group.clippings))
      addBookReport(report, await writer.importIntoBook(bookId, titles.get(bookId) ?? '', batches))
    }

    return report
  }
}

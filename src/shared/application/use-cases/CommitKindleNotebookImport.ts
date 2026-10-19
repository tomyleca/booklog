import type { BookRepository } from '../../domain/ports/BookRepository.js'
import type { HighlightRepository } from '../../domain/ports/HighlightRepository.js'
import type { NoteRepository } from '../../domain/ports/NoteRepository.js'
import type { ImportedNotebookFileRepository } from '../../domain/ports/ImportedNotebookFileRepository.js'
import { ImportedNotebookFile } from '../../domain/entities/ImportedNotebookFile.js'
import { resolveKindleNotebook } from '../../domain/services/kindle/resolveKindleNotebook.js'
import {
  addBookReport,
  emptyKindleImportReport,
  KindleAnnotationWriter
} from '../services/KindleAnnotationWriter.js'
import type { KindleImportReport } from '../services/KindleAnnotationWriter.js'
import { groupAssignmentsByBook } from '../services/kindleAssignments.js'
import type { KindleImportAssignment } from '../services/kindleAssignments.js'
import { parseKindleNotebookFiles } from '../services/kindleNotebookFiles.js'
import type { KindleNotebookFileInput } from '../services/kindleNotebookFiles.js'

export interface CommitKindleNotebookImportDTO {
  files: KindleNotebookFileInput[]
  /** Archivos a importar (`groupKey` = nombre del archivo) y su libro de destino. */
  assignments: KindleImportAssignment[]
}

/**
 * Paso 2 de la importación de exportaciones del Cuaderno (feature #26). Usa el mismo
 * escritor que My Clippings (`KindleAnnotationWriter`): no duplica lo ya importado de la
 * misma exportación (huella `kindle-nb-v1`) ni lo que llegó por My Clippings (misma
 * ubicación de inicio y mismo texto). Los subrayados conservan su color y quedan sin fecha.
 * Al terminar recuerda cada archivo importado (ruta + fecha de modificación).
 */
export class CommitKindleNotebookImport {
  constructor(
    private readonly bookRepository: BookRepository,
    private readonly highlightRepository: HighlightRepository,
    private readonly noteRepository: NoteRepository,
    private readonly importedFiles: ImportedNotebookFileRepository
  ) {}

  public async execute(dto: CommitKindleNotebookImportDTO): Promise<KindleImportReport> {
    const files = parseKindleNotebookFiles(dto.files).filter(
      (file) => file.parsed.entries.length > 0
    )
    const filesByKey = new Map(files.map((file) => [file.key, file]))
    const filesByBook = groupAssignmentsByBook(dto.assignments, filesByKey)

    const report = emptyKindleImportReport(files.length - [...filesByBook.values()].flat().length)

    // Igual que en My Clippings: se validan todos los libros antes de escribir.
    const titles = await KindleAnnotationWriter.loadBookTitles(
      this.bookRepository,
      filesByBook.keys()
    )

    const writer = new KindleAnnotationWriter(this.highlightRepository, this.noteRepository)
    for (const [bookId, bookFiles] of filesByBook) {
      const batches = bookFiles.map((file) => resolveKindleNotebook(file.parsed.entries))
      addBookReport(report, await writer.importIntoBook(bookId, titles.get(bookId) ?? '', batches))
      for (const { file } of bookFiles) {
        await this.importedFiles.save(
          new ImportedNotebookFile({ path: file.path, modifiedAt: file.modifiedAt })
        )
      }
    }

    return report
  }
}

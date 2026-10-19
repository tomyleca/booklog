import type { BookRepository } from '../../domain/ports/BookRepository.js'
import type { ImportedNotebookFileRepository } from '../../domain/ports/ImportedNotebookFileRepository.js'
import { matchKindleBook } from '../../domain/services/kindle/matchKindleBook.js'
import { resolveKindleNotebook } from '../../domain/services/kindle/resolveKindleNotebook.js'
import { loadKindleMatchCandidates } from '../services/kindleMatchCandidates.js'
import { parseKindleNotebookFiles } from '../services/kindleNotebookFiles.js'
import type { KindleNotebookFileInput } from '../services/kindleNotebookFiles.js'
import { NotebookImportState } from './PreviewKindleImport.js'
import type { KindleImportGroupPreview, KindleImportPreview } from './PreviewKindleImport.js'

export type { KindleNotebookFileInput } from '../services/kindleNotebookFiles.js'

export interface PreviewKindleNotebookImportDTO {
  files: KindleNotebookFileInput[]
}

/**
 * Paso 1 de la importación de exportaciones del Cuaderno (feature #26): un grupo por
 * archivo, con las mismas cantidades, propuesta de libro y forma que la vista previa de
 * My Clippings (#23), más el estado del archivo respecto de importaciones anteriores (misma
 * ruta y misma fecha de modificación = ya importado). Los archivos sin anotaciones solo
 * suman a los totales. No escribe nada.
 */
export class PreviewKindleNotebookImport {
  constructor(
    private readonly bookRepository: BookRepository,
    private readonly importedFiles: ImportedNotebookFileRepository
  ) {}

  public async execute(dto: PreviewKindleNotebookImportDTO): Promise<KindleImportPreview> {
    const candidates = await loadKindleMatchCandidates(this.bookRepository)
    const records = await this.importedFiles.findByPaths(dto.files.map((file) => file.path))
    const recordByPath = new Map(records.map((record) => [record.path, record]))

    const preview: KindleImportPreview = {
      fileCount: dto.files.length,
      totalEntries: 0,
      ignoredBookmarks: 0,
      ignoredEmpty: 0,
      unrecognizedEntries: 0,
      groups: []
    }

    for (const { key, file, parsed, normalized } of parseKindleNotebookFiles(dto.files)) {
      preview.totalEntries += parsed.totalEntries
      preview.ignoredBookmarks += parsed.ignoredBookmarks
      preview.ignoredEmpty += parsed.ignoredEmpty
      preview.unrecognizedEntries += parsed.unrecognizedEntries
      if (parsed.entries.length === 0) continue

      const resolved = resolveKindleNotebook(parsed.entries)
      const record = recordByPath.get(file.path)
      let importState: NotebookImportState = NotebookImportState.NEW
      if (record) {
        importState = record.matches(file.modifiedAt)
          ? NotebookImportState.IMPORTED
          : NotebookImportState.CHANGED
      }
      const group: KindleImportGroupPreview = {
        key,
        rawTitle: normalized.rawTitle,
        title: normalized.title,
        author: normalized.author,
        isbn: normalized.isbn,
        highlightCount: resolved.highlights.length,
        noteCount: resolved.notes.length,
        supersededHighlights: 0,
        supersededNotes: 0,
        lastCapturedAt: null,
        match: matchKindleBook(normalized, candidates),
        fileName: file.fileName,
        importState
      }
      preview.groups.push(group)
    }

    preview.groups.sort((a, b) => a.title.localeCompare(b.title, 'es'))
    return preview
  }
}

import type { BookRepository } from '../../domain/ports/BookRepository.js'
import { parseKindleClippings } from '../../domain/services/kindle/parseKindleClippings.js'
import { groupKindleClippings } from '../../domain/services/kindle/groupKindleClippings.js'
import { matchKindleBook } from '../../domain/services/kindle/matchKindleBook.js'
import type { KindleBookMatch } from '../../domain/services/kindle/matchKindleBook.js'
import { resolveKindleAnnotations } from '../../domain/services/kindle/resolveKindleAnnotations.js'
import { loadKindleMatchCandidates } from '../services/kindleMatchCandidates.js'

/** Estado de una exportación del Cuaderno respecto de importaciones anteriores (#26). */
export const NotebookImportState = {
  NEW: 'NEW',
  IMPORTED: 'IMPORTED',
  CHANGED: 'CHANGED'
} as const

export type NotebookImportState = (typeof NotebookImportState)[keyof typeof NotebookImportState]

export interface PreviewKindleImportDTO {
  /** Contenido completo de `My Clippings.txt`. */
  text: string
}

export interface KindleImportGroupPreview {
  /** Clave del grupo (encabezado del Kindle); se devuelve en el commit con su libro. */
  key: string
  rawTitle: string
  title: string
  author: string | null
  isbn: string | null
  highlightCount: number
  noteCount: number
  supersededHighlights: number
  supersededNotes: number
  lastCapturedAt: Date | null
  /** Libro propuesto de la biblioteca, o `null` si no hubo coincidencia. */
  match: KindleBookMatch | null
  /** Solo en exportaciones del Cuaderno (#26): nombre del archivo exportado. */
  fileName?: string
  /** Solo en exportaciones del Cuaderno (#26): ya importado, cambiado desde entonces o nuevo. */
  importState?: NotebookImportState
}

export interface KindleImportPreview {
  /** Solo en exportaciones del Cuaderno (#26): archivos encontrados en la carpeta. */
  fileCount?: number
  totalEntries: number
  ignoredBookmarks: number
  ignoredEmpty: number
  unrecognizedEntries: number
  groups: KindleImportGroupPreview[]
}

/**
 * Paso 1 de la importación: interpreta el archivo, agrupa por título del Kindle, aplica el
 * dedupe de subrayados editados para mostrar cantidades reales y propone un libro de la
 * biblioteca para cada grupo. No escribe nada.
 */
export class PreviewKindleImport {
  constructor(private readonly bookRepository: BookRepository) {}

  public async execute(dto: PreviewKindleImportDTO): Promise<KindleImportPreview> {
    const parsed = parseKindleClippings(dto.text)
    const candidates = await loadKindleMatchCandidates(this.bookRepository)

    const groups = groupKindleClippings(parsed.clippings).map((group) => {
      const resolved = resolveKindleAnnotations(group.clippings)
      const times = group.clippings
        .map((clipping) => clipping.capturedAt?.getTime())
        .filter((time): time is number => time !== undefined)
      return {
        key: group.key,
        rawTitle: group.normalized.rawTitle,
        title: group.normalized.title,
        author: group.normalized.author,
        isbn: group.normalized.isbn,
        highlightCount: resolved.highlights.length,
        noteCount: resolved.notes.length,
        supersededHighlights: resolved.supersededHighlights,
        supersededNotes: resolved.supersededNotes,
        lastCapturedAt: times.length > 0 ? new Date(Math.max(...times)) : null,
        match: matchKindleBook(group.normalized, candidates)
      }
    })

    groups.sort((a, b) => a.title.localeCompare(b.title, 'es'))

    return {
      totalEntries: parsed.totalEntries,
      ignoredBookmarks: parsed.ignoredBookmarks,
      ignoredEmpty: parsed.ignoredEmpty,
      unrecognizedEntries: parsed.unrecognizedEntries,
      groups
    }
  }
}

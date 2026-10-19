import { normalizeKindleTitle } from '../../domain/services/kindle/normalizeKindleTitle.js'
import type { NormalizedKindleTitle } from '../../domain/services/kindle/normalizeKindleTitle.js'
import { parseKindleNotebook } from '../../domain/services/kindle/parseKindleNotebook.js'
import type { KindleNotebookParseResult } from '../../domain/services/kindle/KindleNotebook.js'

/** Una exportación del Cuaderno leída por el main process (feature #26). */
export interface KindleNotebookFileInput {
  /** Nombre del archivo; identifica el grupo de la vista previa y vuelve en el commit. */
  fileName: string
  /** Ruta absoluta; se usa para recordar qué archivos ya se importaron. */
  path: string
  modifiedAt: Date
  html: string
}

export interface ParsedKindleNotebookFile {
  key: string
  file: KindleNotebookFileInput
  parsed: KindleNotebookParseResult
  normalized: NormalizedKindleTitle
}

/** Sufijos que la app de Kindle agrega al exportar (`-Bloc de notas.html`, `-Notebook.html`). */
export const NOTEBOOK_FILE_SUFFIX = /-(?:bloc de notas|notebook)\.html?$/iu

/**
 * Interpreta cada archivo y normaliza su título con la misma limpieza que My Clippings. Si
 * el HTML no trae título se usa el nombre del archivo sin el sufijo. El autor de la app
 * (`div.authors`) viene limpio, así que tiene prioridad sobre el que se deduce del título.
 */
export function parseKindleNotebookFiles(
  files: KindleNotebookFileInput[]
): ParsedKindleNotebookFile[] {
  return files.map((file) => {
    const parsed = parseKindleNotebook(file.html)
    const rawTitle = parsed.rawTitle || file.fileName.replace(NOTEBOOK_FILE_SUFFIX, '')
    const fromTitle = normalizeKindleTitle(rawTitle)
    return {
      key: file.fileName,
      file,
      parsed,
      normalized: { ...fromTitle, author: parsed.author ?? fromTitle.author }
    }
  })
}

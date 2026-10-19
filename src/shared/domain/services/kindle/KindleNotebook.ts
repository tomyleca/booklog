import type { HighlightColor } from '../../entities/HighlightColor.js'
import type { KindleClipping } from './KindleClipping.js'

/**
 * Tipos de la exportación del Cuaderno de la app de Kindle (feature #26): un HTML por libro
 * (`<título>-Bloc de notas.html` / `<título>-Notebook.html`). A diferencia de
 * `My Clippings.txt` no trae fechas ni la posición final, pero sí el color y el capítulo.
 */
export interface KindleNotebookEntry extends KindleClipping {
  /** Color del subrayado; `null` en notas o si el color no es uno de los conocidos. */
  readonly color: HighlightColor | null
  /** Encabezado de sección (`h2.sectionHeading`) bajo el que aparece la entrada. */
  readonly section: string | null
  /** Capítulo indicado en el propio encabezado (`Carta II > Posición 1069`). */
  readonly chapter: string | null
}

export interface KindleNotebookParseResult {
  /** Título crudo del libro (`div.bookTitle`), igual de sucio que en My Clippings. */
  readonly rawTitle: string
  /** Autor tal como lo escribe la app (`div.authors`), o `null` si falta. */
  readonly author: string | null
  readonly entries: KindleNotebookEntry[]
  /** Encabezados de entrada (`noteHeading`) encontrados en el archivo. */
  readonly totalEntries: number
  readonly ignoredBookmarks: number
  /** Subrayados o notas sin texto. */
  readonly ignoredEmpty: number
  /** Encabezados sin tipo reconocible o sin página/posición numérica. */
  readonly unrecognizedEntries: number
}

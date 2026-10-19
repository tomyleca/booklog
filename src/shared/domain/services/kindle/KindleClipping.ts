import type { LocationRange } from '../../entities/AnnotationLocation.js'

/**
 * Tipos de la importación de `My Clippings.txt` (feature #23). Son datos puros: el parser
 * los produce a partir del texto y el resto de la lógica (agrupado, matching, dedupe) los
 * consume sin tocar disco ni base de datos.
 */

export const KindleClippingKind = {
  HIGHLIGHT: 'HIGHLIGHT',
  NOTE: 'NOTE'
} as const

export type KindleClippingKind = (typeof KindleClippingKind)[keyof typeof KindleClippingKind]

/** Un número suelto (`end = null`) o un rango `inicio-fin`. */
export type KindleRange = LocationRange

/**
 * Una entrada útil del archivo (resaltado o nota con texto). El Kindle puede indicar
 * página, posición o ambas (`en la página 12 | posición 180-183`); se conservan las dos
 * porque la página es lo que entiende el lector y la posición es más fina para comparar.
 */
export interface KindleClipping {
  /** Orden de aparición en el archivo (0, 1, 2...). Desempata fechas iguales o ausentes. */
  readonly index: number
  readonly rawTitle: string
  readonly kind: KindleClippingKind
  readonly page: KindleRange | null
  readonly position: KindleRange | null
  readonly capturedAt: Date | null
  readonly content: string
}

export interface KindleParseResult {
  readonly clippings: KindleClipping[]
  /** Bloques separados por `==========` que tenían algo escrito. */
  readonly totalEntries: number
  readonly ignoredBookmarks: number
  /** Resaltados o notas sin texto. */
  readonly ignoredEmpty: number
  /** Bloques cuyo encabezado no se pudo interpretar (formato o idioma desconocido). */
  readonly unrecognizedEntries: number
}

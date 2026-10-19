import { KindleClippingKind } from './KindleClipping.js'
import type { KindleClipping, KindleParseResult, KindleRange } from './KindleClipping.js'
import { parseKindleDate } from './parseKindleDate.js'

export const KINDLE_ENTRY_SEPARATOR = '=========='

/** U+FEFF: el Kindle lo escribe al inicio del archivo (y a veces de cada título). */
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff)

type HeaderKind = KindleClippingKind | 'BOOKMARK'

const HIGHLIGHT_WORDS = /\b(resaltado|subrayado|highlight)\b/iu
const NOTE_WORDS = /\b(nota|note)\b/iu
const BOOKMARK_WORDS = /\b(marcador|bookmark)\b/iu
const PAGE_REFERENCE = /(?:página|pagina|page)\s+(\d+)(?:\s*-\s*(\d+))?/iu
const POSITION_REFERENCE = /(?:posición|posicion|location|loc\.)\s+(\d+)(?:\s*-\s*(\d+))?/iu
const DATE_SEGMENT = /(?:añadido el|anadido el|added on)\s+(.+)$/iu

function detectKind(firstSegment: string): HeaderKind | null {
  if (BOOKMARK_WORDS.test(firstSegment)) return 'BOOKMARK'
  if (HIGHLIGHT_WORDS.test(firstSegment)) return KindleClippingKind.HIGHLIGHT
  if (NOTE_WORDS.test(firstSegment)) return KindleClippingKind.NOTE
  return null
}

/**
 * Algunos firmwares abrevian el fin del rango (`1200-05` = `1200-1205`): se completa con
 * los dígitos iniciales del inicio.
 */
function buildRange(startText: string, endText: string | undefined): KindleRange | null {
  const start = Number(startText)
  if (!Number.isInteger(start) || start <= 0) return null
  if (!endText) return { start, end: null }

  let end = Number(endText)
  if (end < start && endText.length < startText.length) {
    end = Number(startText.slice(0, startText.length - endText.length) + endText)
  }
  if (!Number.isInteger(end) || end < start) return { start, end: null }
  return { start, end: end === start ? null : end }
}

function findRange(segments: string[], pattern: RegExp): KindleRange | null {
  for (const segment of segments) {
    const match = pattern.exec(segment)
    if (match?.[1]) return buildRange(match[1], match[2])
  }
  return null
}

function findDate(segments: string[]): Date | null {
  for (const segment of segments) {
    const match = DATE_SEGMENT.exec(segment.trim())
    if (match?.[1]) return parseKindleDate(match[1])
  }
  return null
}

function splitBlocks(text: string): string[][] {
  const normalized = text.split(BYTE_ORDER_MARK).join('').replace(/\r\n?/g, '\n')
  const blocks: string[][] = []
  let current: string[] = []
  for (const line of normalized.split('\n')) {
    if (line.trim() === KINDLE_ENTRY_SEPARATOR) {
      blocks.push(current)
      current = []
    } else {
      current.push(line)
    }
  }
  blocks.push(current)
  return blocks
}

/**
 * Parser puro de `My Clippings.txt`. Cada entrada es: título (con el autor entre
 * paréntesis), línea de metadatos (`- Tu resaltado en la página 12 | posición 180-183 |
 * Añadido el ...`), una línea en blanco y el texto; las entradas se separan con
 * `==========`. Reconoce encabezados en castellano e inglés por separado de la fecha.
 *
 * Se descartan los marcadores y los resaltados o notas sin texto; los bloques cuyo
 * encabezado no se entiende se cuentan como no reconocidos en vez de abortar.
 */
export function parseKindleClippings(text: string): KindleParseResult {
  const clippings: KindleClipping[] = []
  let totalEntries = 0
  let ignoredBookmarks = 0
  let ignoredEmpty = 0
  let unrecognizedEntries = 0

  for (const block of splitBlocks(text)) {
    const firstUsed = block.findIndex((line) => line.trim().length > 0)
    if (firstUsed === -1) continue
    totalEntries++

    const lines = block.slice(firstUsed)
    const rawTitle = (lines[0] ?? '').trim()
    const metadata = (lines[1] ?? '').trim()
    const segments = metadata.replace(/^-\s*/, '').split('|')
    const kind = detectKind(segments[0] ?? '')

    if (kind === 'BOOKMARK') {
      ignoredBookmarks++
      continue
    }

    const page = findRange(segments, PAGE_REFERENCE)
    const position = findRange(segments, POSITION_REFERENCE)
    if (kind === null || rawTitle.length === 0 || (page === null && position === null)) {
      unrecognizedEntries++
      continue
    }

    const content = lines.slice(2).join('\n').trim()
    if (content.length === 0) {
      ignoredEmpty++
      continue
    }

    clippings.push({
      index: clippings.length,
      rawTitle,
      kind,
      page,
      position,
      capturedAt: findDate(segments),
      content
    })
  }

  return { clippings, totalEntries, ignoredBookmarks, ignoredEmpty, unrecognizedEntries }
}

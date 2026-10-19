import { HighlightColor } from '../../entities/HighlightColor.js'
import { KindleClippingKind } from './KindleClipping.js'
import type { KindleRange } from './KindleClipping.js'
import type { KindleNotebookEntry, KindleNotebookParseResult } from './KindleNotebook.js'

/** U+FEFF: por si la exportación se guardó con BOM. */
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff)

const TRACKED_CLASSES = ['bookTitle', 'authors', 'sectionHeading', 'noteHeading', 'noteText']
type TrackedClass = 'bookTitle' | 'authors' | 'sectionHeading' | 'noteHeading' | 'noteText'

const OPENING_TAG = /<([a-z][a-z0-9]*)\b[^>]*?\bclass\s*=\s*(['"])([^'"]*)\2[^>]*>/giu
/** Fin del contenido de un elemento: el primer cierre de bloque, sea cual sea su etiqueta. */
const BLOCK_CLOSE = /<\/(?:div|h[1-6]|p|li|td|body|html)\s*>/iu
const LINE_BREAK_TAG = /<br\s*\/?>/giu
const ANY_TAG = /<[^>]*>/gu
const COLOR_CLASS = /\bhighlight_([a-z]+)\b/iu

const HIGHLIGHT_WORDS = /\b(resaltado|subrayado|highlight)\b/iu
const NOTE_WORDS = /\b(nota|note)\b/iu
const BOOKMARK_WORDS = /\b(marcador|bookmark)\b/iu
const PAGE_REFERENCE = /(?:página|pagina|page)\s+(\d+)(?:\s*-\s*(\d+))?/iu
const POSITION_REFERENCE = /(?:posición|posicion|location|loc\.)\s+(\d+)(?:\s*-\s*(\d+))?/iu
const KIND_SEPARATOR = /\s[-–—]\s/u

const COLOR_NAMES: Record<string, HighlightColor> = {
  yellow: HighlightColor.YELLOW,
  amarillo: HighlightColor.YELLOW,
  blue: HighlightColor.BLUE,
  azul: HighlightColor.BLUE,
  pink: HighlightColor.PINK,
  rosa: HighlightColor.PINK,
  orange: HighlightColor.ORANGE,
  naranja: HighlightColor.ORANGE
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  laquo: '«',
  raquo: '»',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  iexcl: '¡',
  iquest: '¿'
}

/** Decodifica entidades HTML con nombre (las comunes) y numéricas (`&#233;`, `&#xE9;`). */
export function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/giu, (whole, code: string) => {
    if (code.startsWith('#')) {
      const isHex = code[1] === 'x' || code[1] === 'X'
      const point = Number.parseInt(code.slice(isHex ? 2 : 1), isHex ? 16 : 10)
      return Number.isInteger(point) && point > 0 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : whole
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? whole
  })
}

/** Texto de un fragmento HTML: `<br>` → salto de línea, sin etiquetas, entidades decodificadas. */
function htmlToText(fragment: string): string {
  const text = decodeHtmlEntities(fragment.replace(LINE_BREAK_TAG, '\n').replace(ANY_TAG, ''))
  return text
    .split('\n')
    .map((line) => line.replace(/[ \t\f\v]+/gu, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim()
}

function collapse(value: string): string {
  return value.replace(/\s+/gu, ' ').trim()
}

interface Token {
  cls: TrackedClass
  /** HTML crudo del contenido (sin la etiqueta de apertura). */
  html: string
}

/**
 * La exportación es XHTML **mal formado** (`<h3 class='noteHeading'>…</div><div
 * class='noteText'>…</h3>`), así que no se usa un parser estricto: se buscan las etiquetas de
 * apertura con las clases conocidas y el contenido de cada una llega hasta el primer cierre
 * de bloque o hasta la próxima etiqueta conocida, lo que ocurra antes.
 */
function tokenize(html: string): Token[] {
  const openings: { cls: TrackedClass; start: number; end: number }[] = []
  for (const match of html.matchAll(OPENING_TAG)) {
    const classes = (match[3] ?? '').split(/\s+/u)
    const cls = TRACKED_CLASSES.find((name) => classes.includes(name)) as TrackedClass | undefined
    if (!cls || match.index === undefined) continue
    openings.push({ cls, start: match.index, end: match.index + match[0].length })
  }

  return openings.map((opening, i) => {
    const limit = openings[i + 1]?.start ?? html.length
    const slice = html.slice(opening.end, limit)
    const close = BLOCK_CLOSE.exec(slice)
    return { cls: opening.cls, html: close ? slice.slice(0, close.index) : slice }
  })
}

function buildRange(startText: string, endText: string | undefined): KindleRange | null {
  const start = Number(startText)
  if (!Number.isInteger(start) || start <= 0) return null
  const end = endText ? Number(endText) : null
  if (end === null || !Number.isInteger(end) || end <= start) return { start, end: null }
  return { start, end }
}

function findRange(text: string, pattern: RegExp): KindleRange | null {
  const match = pattern.exec(text)
  return match?.[1] ? buildRange(match[1], match[2]) : null
}

type HeadingKind = KindleClippingKind | 'BOOKMARK'

interface ParsedHeading {
  kind: HeadingKind
  color: HighlightColor | null
  chapter: string | null
  page: KindleRange | null
  position: KindleRange | null
}

function detectKind(label: string): HeadingKind | null {
  if (BOOKMARK_WORDS.test(label)) return 'BOOKMARK'
  if (HIGHLIGHT_WORDS.test(label)) return KindleClippingKind.HIGHLIGHT
  if (NOTE_WORDS.test(label)) return KindleClippingKind.NOTE
  return null
}

function detectColor(headingHtml: string, label: string): HighlightColor | null {
  const byClass = COLOR_CLASS.exec(headingHtml)?.[1]?.toLowerCase()
  if (byClass && COLOR_NAMES[byClass]) return COLOR_NAMES[byClass] ?? null
  const byName = /\(([^)]+)\)/u.exec(label)?.[1]?.trim().toLowerCase()
  return byName ? (COLOR_NAMES[byName] ?? null) : null
}

/**
 * `Subrayado (amarillo) - Carta II > Posición 1069`, `Nota - Posición 641` o, en inglés,
 * `Highlight (yellow) - Page 12 · Location 150`. Lo anterior al primer ` - ` es el tipo (y el
 * color); lo posterior, el capítulo opcional (separado con `>`) y la página/posición.
 */
function parseHeading(headingHtml: string): ParsedHeading | null {
  const text = collapse(htmlToText(headingHtml))
  const separator = KIND_SEPARATOR.exec(text)
  const label = separator ? text.slice(0, separator.index) : text
  const rest = separator ? text.slice(separator.index + separator[0].length) : ''

  const kind = detectKind(label)
  if (!kind) return null

  const parts = rest.split('>').map((part) => part.trim())
  const where = parts[parts.length - 1] ?? ''
  const chapter = parts.length > 1 ? parts.slice(0, -1).join(' > ') : null

  return {
    kind,
    color: kind === KindleClippingKind.HIGHLIGHT ? detectColor(headingHtml, label) : null,
    chapter: chapter && chapter.length > 0 ? chapter : null,
    page: findRange(where, PAGE_REFERENCE),
    position: findRange(where, POSITION_REFERENCE)
  }
}

/**
 * Parser puro de la exportación del Cuaderno de la app de Kindle (feature #26). Tolera el
 * HTML mal formado, encabezados en castellano e inglés, capítulos en el encabezado,
 * entidades HTML y notas multilínea. Ignora marcadores y entradas sin texto, y cuenta como
 * no reconocidas las que no tienen tipo o página/posición numérica. Las entradas no tienen
 * fecha (`capturedAt = null`): la app no la exporta.
 */
export function parseKindleNotebook(html: string): KindleNotebookParseResult {
  const tokens = tokenize(html.split(BYTE_ORDER_MARK).join('').replace(/\r\n?/gu, '\n'))

  let rawTitle = ''
  let author: string | null = null
  let section: string | null = null
  let totalEntries = 0
  let ignoredBookmarks = 0
  let ignoredEmpty = 0
  let unrecognizedEntries = 0
  const pending: { heading: ParsedHeading | null; section: string | null; text: string }[] = []

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i] as Token
    switch (token.cls) {
      case 'bookTitle':
        if (!rawTitle) rawTitle = collapse(htmlToText(token.html))
        break
      case 'authors':
        if (author === null) author = collapse(htmlToText(token.html)) || null
        break
      case 'sectionHeading':
        section = collapse(htmlToText(token.html)) || null
        break
      case 'noteHeading': {
        totalEntries++
        const next = tokens[i + 1]
        const text = next?.cls === 'noteText' ? htmlToText(next.html) : ''
        if (next?.cls === 'noteText') i++
        pending.push({ heading: parseHeading(token.html), section, text })
        break
      }
      case 'noteText':
        // Texto sin encabezado: no se puede ubicar.
        break
    }
  }

  const entries: KindleNotebookEntry[] = []
  for (const item of pending) {
    const heading = item.heading
    if (!heading || (!heading.page && !heading.position)) {
      if (heading?.kind === 'BOOKMARK') ignoredBookmarks++
      else unrecognizedEntries++
      continue
    }
    if (heading.kind === 'BOOKMARK') {
      ignoredBookmarks++
      continue
    }
    if (item.text.length === 0) {
      ignoredEmpty++
      continue
    }
    entries.push({
      index: entries.length,
      rawTitle,
      kind: heading.kind,
      page: heading.page,
      position: heading.position,
      capturedAt: null,
      content: item.text,
      color: heading.color,
      section: item.section,
      chapter: heading.chapter
    })
  }

  return {
    rawTitle,
    author,
    entries,
    totalEntries,
    ignoredBookmarks,
    ignoredEmpty,
    unrecognizedEntries
  }
}

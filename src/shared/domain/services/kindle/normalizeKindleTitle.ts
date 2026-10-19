import { normalizeForSearch } from '../rankSearchResults.js'

export interface NormalizedKindleTitle {
  /** Encabezado tal cual vino del archivo (identifica el grupo en la vista previa). */
  readonly rawTitle: string
  /** Título legible, sin la basura de las descargas; se usa para precargar el alta. */
  readonly title: string
  /** Autor legible (`Nombre Apellido`), o `null` si el archivo no lo trae. */
  readonly author: string | null
  /** ISBN-13 (solo dígitos) si aparece en el encabezado. */
  readonly isbn: string | null
}

/** U+FEFF: el Kindle lo escribe al inicio del archivo (y a veces de cada título). */
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff)
const TRAILING_PARENTHESES = /\s*\(([^()]*)\)\s*$/u
const DOWNLOAD_SITE_TAG = /\((?:z-?library|z-lib(?:\.org)?|1lib|libgen)\)/giu
const ANNAS_ARCHIVE = /anna[’']?s\s+arch\w*/giu
const HEX_HASH = /\b[0-9a-f]{20,40}\b/giu
const EPUBLIBRE_MARKERS = /\s*\[\d+\]\s*(?:\(r\d+(?:\.\d+)*\))?|\s*\(r\d+(?:\.\d+)+\)/giu
const SITE_PREFIX = /^_*(?:oceanofpdf\.com|z-lib\.org|ebook3000\.com)_*/iu
const TRANSLATOR_SUFFIX = /\s+trad\.?\s+.+$/iu
const ISBN_13 = /(?<![0-9a-f])(97[89]\d{10})(?![0-9a-f])/iu
const ISBN_10 = /isbn(?:10)?\s*[:-]?\s*(\d{9}[\dx])(?![\dx])/iu
const SEGMENT_SEPARATOR = /\s+--\s+/u
const AUTHOR_TITLE_SEPARATOR = /\s+-\s+/u

function collapseSpaces(value: string): string {
  return value.replace(/\s+/gu, ' ').trim()
}

/** `Weiner, Tim` → `Tim Weiner`. Solo si hay una única coma y no es una lista de autores. */
function toFirstLast(author: string): string {
  const parts = author.split(',')
  if (parts.length !== 2) return author
  const [last, first] = parts.map((part) => part.trim())
  if (!last || !first || /[&;]/u.test(author)) return author
  if (last.split(' ').length > 3 || first.split(' ').length > 3) return author
  return `${first} ${last}`
}

function cleanAuthor(author: string): string | null {
  const cleaned = collapseSpaces(author.replace(/\[[^\]]*\]/gu, '').replace(/_/gu, ' '))
  if (cleaned.length === 0) return null
  return toFirstLast(cleaned)
}

function authorTokens(author: string): Set<string> {
  return new Set(
    normalizeForSearch(author)
      .split(' ')
      .filter((token) => token.length > 1)
  )
}

/** Coincidencia de autor por palabras, tolerante a orden (`Borges, Jorge Luis`) y acentos. */
export function authorsLookAlike(a: string, b: string): boolean {
  const tokensA = authorTokens(a)
  const tokensB = authorTokens(b)
  if (tokensA.size === 0 || tokensB.size === 0) return false
  const [smaller, larger] = tokensA.size <= tokensB.size ? [tokensA, tokensB] : [tokensB, tokensA]
  let shared = 0
  for (const token of smaller) {
    if (larger.has(token)) shared++
  }
  return shared >= Math.min(2, smaller.size)
}

function convertIsbn10To13(isbn10: string): string {
  const body = `978${isbn10.slice(0, 9)}`
  const sum = [...body].reduce(
    (acc, digit, index) => acc + Number(digit) * (index % 2 === 0 ? 1 : 3),
    0
  )
  return `${body}${(10 - (sum % 10)) % 10}`
}

/** Deja un ISBN en forma canónica de 13 dígitos, o `null` si no lo parece. */
export function canonicalIsbn(value: string | null | undefined): string | null {
  if (!value) return null
  const compact = value.replace(/[\s-]/gu, '').toUpperCase()
  if (/^97[89]\d{10}$/u.test(compact)) return compact
  if (/^\d{9}[\dX]$/u.test(compact)) return convertIsbn10To13(compact)
  return null
}

function extractIsbn(rawTitle: string): string | null {
  const isbn13 = ISBN_13.exec(rawTitle)
  if (isbn13?.[1]) return isbn13[1]
  const isbn10 = ISBN_10.exec(rawTitle)
  return isbn10?.[1] ? canonicalIsbn(isbn10[1]) : null
}

/** Quita los paréntesis finales: el autor que agrega el Kindle y etiquetas de descarga. */
function stripTrailingAuthor(rawTitle: string): { rest: string; author: string | null } {
  let rest = rawTitle.replace(DOWNLOAD_SITE_TAG, ' ').trim()
  const match = TRAILING_PARENTHESES.exec(rest)
  if (!match) return { rest, author: null }

  const author = match[1]?.trim() || null
  rest = rest.slice(0, match.index).trim()

  // `Título (Autor) (Z-Library) (Autor)`: tras quitar la etiqueta queda el autor repetido.
  const repeated = TRAILING_PARENTHESES.exec(rest)
  if (repeated && author && repeated[1] && authorsLookAlike(repeated[1], author)) {
    rest = rest.slice(0, repeated.index).trim()
  }
  return { rest, author }
}

/** `_` hace de `:` en los nombres de archivo (`Legado de cenizas _ La historia...`). */
function restoreUnderscores(value: string): string {
  return value
    .replace(/\s*_\s+/gu, ': ')
    .replace(/_+$/u, '')
    .replace(/_/gu, ' ')
}

/**
 * Separa `Título - Autor` o `Autor - Título`. Se elige el lado que se parece al autor
 * conocido; sin autor conocido se asume `Título - Autor`, que es lo más común.
 */
function splitAuthorAndTitle(
  value: string,
  knownAuthor: string | null
): { title: string; author: string | null } {
  const parts = value.split(AUTHOR_TITLE_SEPARATOR)
  if (parts.length < 2) return { title: value, author: null }

  const first = parts[0] ?? ''
  const last = parts[parts.length - 1] ?? ''
  if (knownAuthor && authorsLookAlike(first, knownAuthor) && !authorsLookAlike(last, knownAuthor)) {
    return { title: parts.slice(1).join(' - '), author: first }
  }
  if (knownAuthor && !authorsLookAlike(last, knownAuthor)) {
    return { title: value, author: null }
  }
  return { title: parts.slice(0, -1).join(' - '), author: last }
}

/**
 * Limpia el encabezado de una entrada del Kindle (títulos de descargas con segmentos
 * `--`, `Anna’s Archive`, `(Z-Library)`, hashes, marcas de ePubLibre, prefijos de sitios,
 * `_` y `-` como espacios) y extrae autor e ISBN.
 */
export function normalizeKindleTitle(rawTitle: string): NormalizedKindleTitle {
  const raw = collapseSpaces(rawTitle.split(BYTE_ORDER_MARK).join(''))
  const isbn = extractIsbn(raw)
  const { rest, author: trailingAuthor } = stripTrailingAuthor(raw)

  const segments = rest.split(SEGMENT_SEPARATOR)
  const segmentAuthor = segments.length > 1 ? (segments[1] ?? null) : null

  let main = (segments[0] ?? rest)
    .replace(SITE_PREFIX, '')
    .replace(ANNAS_ARCHIVE, ' ')
    .replace(HEX_HASH, ' ')
    .replace(EPUBLIBRE_MARKERS, ' ')
  main = collapseSpaces(restoreUnderscores(main))

  const knownAuthor = trailingAuthor ?? segmentAuthor
  const split = splitAuthorAndTitle(main, knownAuthor)
  let title = split.title

  // Sin espacios, los guiones separan palabras (`De-animales-a-dioses`, `Moby-Dick`).
  if (!/\s/u.test(title)) title = title.replace(/-/gu, ' ')
  title = collapseSpaces(title.replace(TRANSLATOR_SUFFIX, '').replace(/[\s:;,.-]+$/u, ''))

  const authorSource = trailingAuthor ?? segmentAuthor ?? split.author
  return {
    rawTitle: raw,
    title: title.length > 0 ? title : raw,
    author: authorSource ? cleanAuthor(authorSource) : null,
    isbn
  }
}

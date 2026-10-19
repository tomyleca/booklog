import { normalizeForSearch } from '../rankSearchResults.js'
import { authorsLookAlike, canonicalIsbn } from './normalizeKindleTitle.js'
import type { NormalizedKindleTitle } from './normalizeKindleTitle.js'

/** Lo mínimo de un libro de la biblioteca que necesita el matching. */
export interface KindleMatchCandidate {
  id: number
  title: string
  authors: string
  isbn?: string | null
}

export const KindleMatchMethod = {
  ISBN: 'ISBN',
  TITLE_AUTHOR: 'TITLE_AUTHOR',
  TITLE: 'TITLE',
  SIMILARITY: 'SIMILARITY'
} as const

export type KindleMatchMethod = (typeof KindleMatchMethod)[keyof typeof KindleMatchMethod]

export const KindleMatchConfidence = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW'
} as const

export type KindleMatchConfidence =
  (typeof KindleMatchConfidence)[keyof typeof KindleMatchConfidence]

export interface KindleBookMatch {
  bookId: number
  method: KindleMatchMethod
  confidence: KindleMatchConfidence
  /** 0..1; 1 para ISBN y título exacto. */
  score: number
}

/** Umbral mínimo de similitud de títulos para proponer un libro (ADR 023). */
export const SIMILARITY_THRESHOLD = 0.6
const HIGH_SIMILARITY = 0.85
const AUTHOR_BONUS = 0.15

/** Título completo y título principal (antes de `:`), ya normalizados para comparar. */
function titleVariants(title: string): string[] {
  const variants = new Set<string>()
  const full = normalizeForSearch(title)
  if (full) variants.add(full)
  const mainTitle = normalizeForSearch(title.split(/[:(]/u)[0] ?? '')
  if (mainTitle) variants.add(mainTitle)
  return [...variants]
}

function bigrams(value: string): Map<string, number> {
  const compact = value.replace(/\s+/gu, ' ')
  const counts = new Map<string, number>()
  for (let i = 0; i < compact.length - 1; i++) {
    const gram = compact.slice(i, i + 2)
    counts.set(gram, (counts.get(gram) ?? 0) + 1)
  }
  return counts
}

/** Coeficiente de Sørensen–Dice sobre bigramas de caracteres (0..1). */
export function titleSimilarity(a: string, b: string): number {
  if (a === b) return a.length > 0 ? 1 : 0
  const gramsA = bigrams(a)
  const gramsB = bigrams(b)
  let sizeA = 0
  let sizeB = 0
  let shared = 0
  for (const count of gramsA.values()) sizeA += count
  for (const [gram, count] of gramsB) {
    sizeB += count
    shared += Math.min(count, gramsA.get(gram) ?? 0)
  }
  if (sizeA + sizeB === 0) return 0
  return (2 * shared) / (sizeA + sizeB)
}

function bestTitleSimilarity(kindleTitles: string[], bookTitles: string[]): number {
  let best = 0
  for (const a of kindleTitles) {
    for (const b of bookTitles) {
      best = Math.max(best, titleSimilarity(a, b))
    }
  }
  return best
}

function sameTitle(kindleTitles: string[], bookTitles: string[]): boolean {
  return kindleTitles.some((title) => bookTitles.includes(title))
}

function authorMatches(kindleAuthor: string | null, bookAuthors: string): boolean {
  if (!kindleAuthor) return false
  return bookAuthors
    .split(/[,;&]| y | and /u)
    .concat(bookAuthors)
    .some((author) => author.trim().length > 0 && authorsLookAlike(kindleAuthor, author))
}

/**
 * Propone el libro de la biblioteca que corresponde a un título del Kindle, en orden de
 * fiabilidad: ISBN → título igual + autor → título igual → título parecido (similitud).
 * Devuelve `null` si nada supera el umbral.
 */
export function matchKindleBook(
  kindle: NormalizedKindleTitle,
  books: KindleMatchCandidate[]
): KindleBookMatch | null {
  if (kindle.isbn) {
    const byIsbn = books.find((book) => canonicalIsbn(book.isbn) === kindle.isbn)
    if (byIsbn) {
      return { bookId: byIsbn.id, method: 'ISBN', confidence: 'HIGH', score: 1 }
    }
  }

  const kindleTitles = titleVariants(kindle.title)
  const scored = books.map((book) => {
    const bookTitles = titleVariants(book.title)
    return {
      book,
      exact: sameTitle(kindleTitles, bookTitles),
      author: authorMatches(kindle.author, book.authors),
      similarity: bestTitleSimilarity(kindleTitles, bookTitles)
    }
  })

  const exactWithAuthor = scored.find((entry) => entry.exact && entry.author)
  if (exactWithAuthor) {
    return {
      bookId: exactWithAuthor.book.id,
      method: 'TITLE_AUTHOR',
      confidence: 'HIGH',
      score: 1
    }
  }

  // Mismo título sin confirmar el autor: si el Kindle trae un autor distinto, se baja la
  // confianza (puede ser otro libro con el mismo nombre, p. ej. "Cuentos").
  const exact = scored.find((entry) => entry.exact)
  if (exact) {
    return {
      bookId: exact.book.id,
      method: 'TITLE',
      confidence: kindle.author ? 'LOW' : 'MEDIUM',
      score: 1
    }
  }

  let best: { id: number; score: number } | null = null
  for (const entry of scored) {
    const score = Math.min(1, entry.similarity + (entry.author ? AUTHOR_BONUS : 0))
    if (score >= SIMILARITY_THRESHOLD && (best === null || score > best.score)) {
      best = { id: entry.book.id, score }
    }
  }
  if (!best) return null

  return {
    bookId: best.id,
    method: 'SIMILARITY',
    confidence: best.score >= HIGH_SIMILARITY ? 'MEDIUM' : 'LOW',
    score: Math.round(best.score * 100) / 100
  }
}

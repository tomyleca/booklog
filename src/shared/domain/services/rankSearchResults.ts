import type { BookSearchResult } from '../ports/BookSearchService.js'

export interface SearchRelevanceCriteria {
  query: string
  author?: string | null
}

/**
 * Pesos del puntaje de relevancia (ADR 021). El título domina, el autor desempata entre
 * ediciones con el mismo título y los datos completos (portada, ISBN, páginas) sólo
 * ordenan dentro de un mismo nivel de coincidencia.
 */
export const RELEVANCE_WEIGHTS = {
  TITLE_EXACT: 100,
  TITLE_STARTS_WITH: 60,
  TITLE_CONTAINS_PHRASE: 45,
  TITLE_WORD_COVERAGE: 30,
  AUTHOR_FIELD_MATCH: 50,
  AUTHOR_FROM_QUERY: 40,
  HAS_COVER: 10,
  HAS_ISBN: 5,
  HAS_PAGE_COUNT: 5
} as const

export function normalizeForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function tokenize(value: string): string[] {
  const normalized = normalizeForSearch(value)
  return normalized ? normalized.split(' ') : []
}

function bestAuthorCoverage(searchTokens: string[], authors: string[]): number {
  if (searchTokens.length === 0) return 0
  const searchSet = new Set(searchTokens)
  let best = 0
  for (const author of authors) {
    const authorTokens = tokenize(author)
    if (authorTokens.length === 0) continue
    const matched = authorTokens.filter((token) => searchSet.has(token)).length
    best = Math.max(best, matched / authorTokens.length)
  }
  return best
}

function scoreTitle(titleQueryTokens: string[], title: string): number {
  if (titleQueryTokens.length === 0) return 0

  const normalizedTitle = normalizeForSearch(title)
  const phrase = titleQueryTokens.join(' ')

  if (normalizedTitle === phrase) return RELEVANCE_WEIGHTS.TITLE_EXACT
  if (normalizedTitle.startsWith(`${phrase} `)) return RELEVANCE_WEIGHTS.TITLE_STARTS_WITH
  if (` ${normalizedTitle} `.includes(` ${phrase} `)) {
    return RELEVANCE_WEIGHTS.TITLE_CONTAINS_PHRASE
  }

  const titleTokens = new Set(normalizedTitle.split(' '))
  const matched = titleQueryTokens.filter((token) => titleTokens.has(token)).length
  return RELEVANCE_WEIGHTS.TITLE_WORD_COVERAGE * (matched / titleQueryTokens.length)
}

/**
 * Puntaje de relevancia de un resultado frente a lo que escribió el usuario.
 *
 * Si el texto libre trae palabras del autor ("it stephen king"), esas palabras se cuentan
 * como coincidencia de autor y se quitan antes de comparar el título, para que "It" siga
 * siendo una coincidencia exacta.
 */
export function scoreSearchResult(
  result: BookSearchResult,
  criteria: SearchRelevanceCriteria
): number {
  const queryTokens = tokenize(criteria.query)
  const authorFieldTokens = tokenize(criteria.author ?? '')
  const authors = result.authors ?? []
  const titleTokens = new Set(tokenize(result.title))
  const resultAuthorTokens = new Set(authors.flatMap((author) => tokenize(author)))

  const titleQueryTokens = queryTokens.filter(
    (token) => titleTokens.has(token) || !resultAuthorTokens.has(token)
  )

  let score = scoreTitle(titleQueryTokens, result.title)

  if (authorFieldTokens.length > 0) {
    score += RELEVANCE_WEIGHTS.AUTHOR_FIELD_MATCH * bestAuthorCoverage(authorFieldTokens, authors)
  } else {
    score += RELEVANCE_WEIGHTS.AUTHOR_FROM_QUERY * bestAuthorCoverage(queryTokens, authors)
  }

  if (result.coverUrl) score += RELEVANCE_WEIGHTS.HAS_COVER
  if (result.isbn) score += RELEVANCE_WEIGHTS.HAS_ISBN
  if (result.pageCount) score += RELEVANCE_WEIGHTS.HAS_PAGE_COUNT

  return score
}

/**
 * Devuelve una copia ordenada de mayor a menor relevancia. No descarta ningún resultado
 * (todas las ediciones se conservan) y ante empate respeta el orden original.
 */
export function rankSearchResults(
  results: BookSearchResult[],
  criteria: SearchRelevanceCriteria
): BookSearchResult[] {
  return results
    .map((result, index) => ({ result, index, score: scoreSearchResult(result, criteria) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ result }) => result)
}

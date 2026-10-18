import type { BookSearchResult } from '../ports/BookSearchService.js'

/**
 * Concatena varias listas de resultados conservando el orden de llegada y descartando
 * los repetidos por `googleBooksId` (gana la primera aparición). Los resultados sin id
 * no se pueden comparar con seguridad, así que se conservan todos.
 */
export function mergeSearchResults(...lists: BookSearchResult[][]): BookSearchResult[] {
  const seenIds = new Set<string>()
  const merged: BookSearchResult[] = []

  for (const list of lists) {
    for (const result of list) {
      const id = result.googleBooksId
      if (id) {
        if (seenIds.has(id)) continue
        seenIds.add(id)
      }
      merged.push(result)
    }
  }

  return merged
}

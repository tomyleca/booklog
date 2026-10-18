import type { IpcResult } from '../../../shared/infrastructure/ipc/contracts.js'
import type { BookSearchResult } from '../../../shared/domain/ports/BookSearchService.js'

export const searchService = {
  async searchBooks(query: string, author?: string): Promise<IpcResult<BookSearchResult[]>> {
    const trimmedAuthor = author?.trim()
    return trimmedAuthor
      ? await window.api.search.books(query, trimmedAuthor)
      : await window.api.search.books(query)
  }
}

export async function searchBooks(
  query: string,
  author?: string
): Promise<IpcResult<BookSearchResult[]>> {
  return await searchService.searchBooks(query, author)
}

import type { IpcResult } from '../../../shared/infrastructure/ipc/contracts.js'
import type { BookSearchResult } from '../../../shared/domain/ports/BookSearchService.js'

export const searchService = {
  async searchBooks(query: string): Promise<IpcResult<BookSearchResult[]>> {
    return await window.api.search.books(query)
  }
}

export async function searchBooks(query: string): Promise<IpcResult<BookSearchResult[]>> {
  return await searchService.searchBooks(query)
}

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/infrastructure/ipc/channels.js'
import {
  ipcSuccess,
  formatIpcError
} from '../../shared/infrastructure/ipc/contracts.js'
import type { SearchBooksDTO } from '../../shared/infrastructure/ipc/contracts.js'
import type { BookSearchService } from '../../shared/domain/ports/BookSearchService.js'
import { GoogleBooksService } from '../../shared/infrastructure/api/GoogleBooksService.js'

export function registerSearchHandlers(
  searchService: BookSearchService = new GoogleBooksService()
): void {
  ipcMain.handle(IPC_CHANNELS.SEARCH.BOOKS, async (_, args: Partial<SearchBooksDTO> | string) => {
    try {
      const rawQuery = typeof args === 'string' ? args : args?.query
      const rawAuthor = typeof args === 'string' ? undefined : args?.author
      const query = typeof rawQuery === 'string' ? rawQuery.trim() : ''
      const author = typeof rawAuthor === 'string' ? rawAuthor.trim() : ''
      if (!query && !author) {
        return ipcSuccess([])
      }

      const results = author
        ? await searchService.searchByQuery(query, author)
        : await searchService.searchByQuery(query)
      return ipcSuccess(results)
    } catch (error) {
      return formatIpcError(error)
    }
  })
}

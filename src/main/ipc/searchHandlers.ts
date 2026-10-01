import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/infrastructure/ipc/channels.js'
import {
  ipcSuccess,
  formatIpcError
} from '../../shared/infrastructure/ipc/contracts.js'
import type { BookSearchService } from '../../shared/domain/ports/BookSearchService.js'
import { GoogleBooksService } from '../../shared/infrastructure/api/GoogleBooksService.js'

export function registerSearchHandlers(
  searchService: BookSearchService = new GoogleBooksService()
): void {
  ipcMain.handle(IPC_CHANNELS.SEARCH.BOOKS, async (_, args: { query?: string } | string) => {
    try {
      const query = typeof args === 'string' ? args : args?.query
      if (typeof query !== 'string' || !query.trim()) {
        return ipcSuccess([])
      }

      const results = await searchService.searchByQuery(query.trim())
      return ipcSuccess(results)
    } catch (error) {
      return formatIpcError(error)
    }
  })
}

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/infrastructure/ipc/channels.js'
import {
  ipcSuccess,
  ipcError,
  formatIpcError,
  IPC_ERROR_CODES
} from '../../shared/infrastructure/ipc/contracts.js'
import type { BookRepository } from '../../shared/domain/ports/BookRepository.js'
import type { HighlightRepository } from '../../shared/domain/ports/HighlightRepository.js'
import { GetBookHighlights } from '../../shared/application/use-cases/GetBookHighlights.js'
import { DeleteHighlight } from '../../shared/application/use-cases/DeleteHighlight.js'

export function registerHighlightHandlers(
  bookRepository: BookRepository,
  highlightRepository: HighlightRepository
): void {
  ipcMain.handle(
    IPC_CHANNELS.HIGHLIGHTS.GET_BY_BOOK,
    async (_, args: { bookId: number } | number) => {
      try {
        const bookId = typeof args === 'number' ? args : args?.bookId
        if (typeof bookId !== 'number' || Number.isNaN(bookId)) {
          return ipcError('ID de libro inválido', IPC_ERROR_CODES.VALIDATION_ERROR)
        }
        const useCase = new GetBookHighlights(bookRepository, highlightRepository)
        const highlights = await useCase.execute({ bookId })
        return ipcSuccess(highlights.map((h) => h.toPrimitives()))
      } catch (error) {
        return formatIpcError(error)
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.HIGHLIGHTS.DELETE, async (_, args: { id: number } | number) => {
    try {
      const id = typeof args === 'number' ? args : args?.id
      if (typeof id !== 'number' || Number.isNaN(id)) {
        return ipcError('ID de subrayado inválido', IPC_ERROR_CODES.VALIDATION_ERROR)
      }
      const useCase = new DeleteHighlight(highlightRepository)
      await useCase.execute({ id })
      return ipcSuccess<void>(undefined)
    } catch (error) {
      return formatIpcError(error)
    }
  })
}

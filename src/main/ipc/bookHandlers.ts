import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/infrastructure/ipc/channels.js'
import {
  ipcSuccess,
  ipcError,
  formatIpcError,
  IPC_ERROR_CODES,
  type AddBookDTO,
  type ListBooksDTO,
  type UpdateBookStatusDTO,
  type UpdateBookProgressDTO,
  type RateBookDTO
} from '../../shared/infrastructure/ipc/contracts.js'
import type { BookRepository } from '../../shared/domain/ports/BookRepository.js'
import { ListBooks } from '../../shared/application/use-cases/ListBooks.js'
import { GetBookById } from '../../shared/application/use-cases/GetBookById.js'
import { AddBook } from '../../shared/application/use-cases/AddBook.js'
import { UpdateBookStatus } from '../../shared/application/use-cases/UpdateBookStatus.js'
import { UpdateBookProgress } from '../../shared/application/use-cases/UpdateBookProgress.js'
import { RateBook } from '../../shared/application/use-cases/RateBook.js'
import { DeleteBook } from '../../shared/application/use-cases/DeleteBook.js'

export function registerBookHandlers(bookRepository: BookRepository): void {
  ipcMain.handle(IPC_CHANNELS.BOOKS.LIST, async (_, dto?: ListBooksDTO) => {
    try {
      const useCase = new ListBooks(bookRepository)
      const books = await useCase.execute(dto)
      return ipcSuccess(books.map((b) => b.toPrimitives()))
    } catch (error) {
      return formatIpcError(error)
    }
  })

  ipcMain.handle(IPC_CHANNELS.BOOKS.GET_BY_ID, async (_, args: { id: number } | number) => {
    try {
      const id = typeof args === 'number' ? args : args?.id
      if (typeof id !== 'number' || Number.isNaN(id)) {
        return ipcError('ID de libro inválido', IPC_ERROR_CODES.VALIDATION_ERROR)
      }
      const useCase = new GetBookById(bookRepository)
      const book = await useCase.execute({ id })
      return ipcSuccess(book.toPrimitives())
    } catch (error) {
      return formatIpcError(error)
    }
  })

  ipcMain.handle(IPC_CHANNELS.BOOKS.CREATE, async (_, dto: AddBookDTO) => {
    try {
      const useCase = new AddBook(bookRepository)
      const book = await useCase.execute(dto)
      return ipcSuccess(book.toPrimitives())
    } catch (error) {
      return formatIpcError(error)
    }
  })

  ipcMain.handle(IPC_CHANNELS.BOOKS.UPDATE_STATUS, async (_, dto: UpdateBookStatusDTO) => {
    try {
      const useCase = new UpdateBookStatus(bookRepository)
      const book = await useCase.execute(dto)
      return ipcSuccess(book.toPrimitives())
    } catch (error) {
      return formatIpcError(error)
    }
  })

  ipcMain.handle(IPC_CHANNELS.BOOKS.UPDATE_PROGRESS, async (_, dto: UpdateBookProgressDTO) => {
    try {
      const useCase = new UpdateBookProgress(bookRepository)
      const book = await useCase.execute(dto)
      return ipcSuccess(book.toPrimitives())
    } catch (error) {
      return formatIpcError(error)
    }
  })

  ipcMain.handle(IPC_CHANNELS.BOOKS.RATE, async (_, dto: RateBookDTO) => {
    try {
      const useCase = new RateBook(bookRepository)
      const book = await useCase.execute(dto)
      return ipcSuccess(book.toPrimitives())
    } catch (error) {
      return formatIpcError(error)
    }
  })

  ipcMain.handle(IPC_CHANNELS.BOOKS.DELETE, async (_, args: { id: number } | number) => {
    try {
      const id = typeof args === 'number' ? args : args?.id
      if (typeof id !== 'number' || Number.isNaN(id)) {
        return ipcError('ID de libro inválido', IPC_ERROR_CODES.VALIDATION_ERROR)
      }
      const useCase = new DeleteBook(bookRepository)
      await useCase.execute({ id })
      return ipcSuccess<void>(undefined)
    } catch (error) {
      return formatIpcError(error)
    }
  })
}

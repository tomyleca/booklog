import type {
  AddBookDTO,
  BookPrimitives,
  IpcResult,
  ListBooksDTO,
  RateBookDTO,
  UpdateBookProgressDTO,
  UpdateBookStatusDTO
} from '../../../shared/infrastructure/ipc/contracts.js'

export const bookService = {
  async list(dto?: ListBooksDTO): Promise<IpcResult<BookPrimitives[]>> {
    return await window.api.books.list(dto)
  },

  async getById(id: number): Promise<IpcResult<BookPrimitives>> {
    return await window.api.books.getById(id)
  },

  async create(dto: AddBookDTO): Promise<IpcResult<BookPrimitives>> {
    return await window.api.books.create(dto)
  },

  async updateStatus(dto: UpdateBookStatusDTO): Promise<IpcResult<BookPrimitives>> {
    return await window.api.books.updateStatus(dto)
  },

  async updateProgress(dto: UpdateBookProgressDTO): Promise<IpcResult<BookPrimitives>> {
    return await window.api.books.updateProgress(dto)
  },

  async rate(dto: RateBookDTO): Promise<IpcResult<BookPrimitives>> {
    return await window.api.books.rate(dto)
  },

  async delete(id: number): Promise<IpcResult<void>> {
    return await window.api.books.delete(id)
  }
}

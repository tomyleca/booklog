import type {
  AddNoteDTO,
  IpcResult,
  NotePrimitives,
  UpdateNoteDTO
} from '../../../shared/infrastructure/ipc/contracts.js'

export const noteService = {
  async getByBook(bookId: number): Promise<IpcResult<NotePrimitives[]>> {
    return await window.api.notes.getByBook(bookId)
  },

  async create(dto: AddNoteDTO): Promise<IpcResult<NotePrimitives>> {
    return await window.api.notes.create(dto)
  },

  async update(dto: UpdateNoteDTO): Promise<IpcResult<NotePrimitives>> {
    return await window.api.notes.update(dto)
  },

  async delete(id: number): Promise<IpcResult<void>> {
    return await window.api.notes.delete(id)
  }
}

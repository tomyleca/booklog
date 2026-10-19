import type {
  HighlightPrimitives,
  IpcResult
} from '../../../shared/infrastructure/ipc/contracts.js'

export const highlightService = {
  async getByBook(bookId: number): Promise<IpcResult<HighlightPrimitives[]>> {
    return await window.api.highlights.getByBook(bookId)
  },

  async delete(id: number): Promise<IpcResult<void>> {
    return await window.api.highlights.delete(id)
  }
}

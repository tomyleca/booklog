import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/infrastructure/ipc/channels.js'
import {
  ipcSuccess,
  ipcError,
  formatIpcError,
  IPC_ERROR_CODES,
  type AddNoteDTO,
  type UpdateNoteDTO
} from '../../shared/infrastructure/ipc/contracts.js'
import type { BookRepository } from '../../shared/domain/ports/BookRepository.js'
import type { NoteRepository } from '../../shared/domain/ports/NoteRepository.js'
import { GetBookNotes } from '../../shared/application/use-cases/GetBookNotes.js'
import { AddNote } from '../../shared/application/use-cases/AddNote.js'
import { UpdateNote } from '../../shared/application/use-cases/UpdateNote.js'
import { DeleteNote } from '../../shared/application/use-cases/DeleteNote.js'

export function registerNoteHandlers(
  bookRepository: BookRepository,
  noteRepository: NoteRepository
): void {
  ipcMain.handle(IPC_CHANNELS.NOTES.GET_BY_BOOK, async (_, args: { bookId: number } | number) => {
    try {
      const bookId = typeof args === 'number' ? args : args?.bookId
      if (typeof bookId !== 'number' || Number.isNaN(bookId)) {
        return ipcError('ID de libro inválido', IPC_ERROR_CODES.VALIDATION_ERROR)
      }
      const useCase = new GetBookNotes(bookRepository, noteRepository)
      const notes = await useCase.execute({ bookId })
      return ipcSuccess(notes.map((n) => n.toPrimitives()))
    } catch (error) {
      return formatIpcError(error)
    }
  })

  ipcMain.handle(IPC_CHANNELS.NOTES.CREATE, async (_, dto: AddNoteDTO) => {
    try {
      const useCase = new AddNote(bookRepository, noteRepository)
      const note = await useCase.execute(dto)
      return ipcSuccess(note.toPrimitives())
    } catch (error) {
      return formatIpcError(error)
    }
  })

  ipcMain.handle(IPC_CHANNELS.NOTES.UPDATE, async (_, dto: UpdateNoteDTO) => {
    try {
      const useCase = new UpdateNote(noteRepository)
      const note = await useCase.execute(dto)
      return ipcSuccess(note.toPrimitives())
    } catch (error) {
      return formatIpcError(error)
    }
  })

  ipcMain.handle(IPC_CHANNELS.NOTES.DELETE, async (_, args: { id: number } | number) => {
    try {
      const id = typeof args === 'number' ? args : args?.id
      if (typeof id !== 'number' || Number.isNaN(id)) {
        return ipcError('ID de nota inválido', IPC_ERROR_CODES.VALIDATION_ERROR)
      }
      const useCase = new DeleteNote(noteRepository)
      await useCase.execute({ id })
      return ipcSuccess<void>(undefined)
    } catch (error) {
      return formatIpcError(error)
    }
  })
}

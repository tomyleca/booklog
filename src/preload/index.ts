import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IPC_CHANNELS } from '../shared/infrastructure/ipc/channels.js'
import type {
  AddBookDTO,
  AddNoteDTO,
  BookPrimitives,
  IpcResult,
  ListBooksDTO,
  NotePrimitives,
  RateBookDTO,
  UpdateBookProgressDTO,
  UpdateBookStatusDTO,
  UpdateNoteDTO,
  BookSearchResult
} from '../shared/infrastructure/ipc/contracts.js'

export const api = {
  books: {
    list: (dto?: ListBooksDTO): Promise<IpcResult<BookPrimitives[]>> =>
      ipcRenderer.invoke(IPC_CHANNELS.BOOKS.LIST, dto),
    getById: (id: number): Promise<IpcResult<BookPrimitives>> =>
      ipcRenderer.invoke(IPC_CHANNELS.BOOKS.GET_BY_ID, { id }),
    create: (dto: AddBookDTO): Promise<IpcResult<BookPrimitives>> =>
      ipcRenderer.invoke(IPC_CHANNELS.BOOKS.CREATE, dto),
    updateStatus: (dto: UpdateBookStatusDTO): Promise<IpcResult<BookPrimitives>> =>
      ipcRenderer.invoke(IPC_CHANNELS.BOOKS.UPDATE_STATUS, dto),
    updateProgress: (dto: UpdateBookProgressDTO): Promise<IpcResult<BookPrimitives>> =>
      ipcRenderer.invoke(IPC_CHANNELS.BOOKS.UPDATE_PROGRESS, dto),
    rate: (dto: RateBookDTO): Promise<IpcResult<BookPrimitives>> =>
      ipcRenderer.invoke(IPC_CHANNELS.BOOKS.RATE, dto),
    delete: (id: number): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC_CHANNELS.BOOKS.DELETE, { id })
  },
  notes: {
    getByBook: (bookId: number): Promise<IpcResult<NotePrimitives[]>> =>
      ipcRenderer.invoke(IPC_CHANNELS.NOTES.GET_BY_BOOK, { bookId }),
    create: (dto: AddNoteDTO): Promise<IpcResult<NotePrimitives>> =>
      ipcRenderer.invoke(IPC_CHANNELS.NOTES.CREATE, dto),
    update: (dto: UpdateNoteDTO): Promise<IpcResult<NotePrimitives>> =>
      ipcRenderer.invoke(IPC_CHANNELS.NOTES.UPDATE, dto),
    delete: (id: number): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC_CHANNELS.NOTES.DELETE, { id })
  },
  covers: {
    saveFromUrl: (url: string): Promise<IpcResult<string>> =>
      ipcRenderer.invoke(IPC_CHANNELS.COVERS.SAVE_FROM_URL, { url }),
    saveFromLocal: (filePath: string): Promise<IpcResult<string>> =>
      ipcRenderer.invoke(IPC_CHANNELS.COVERS.SAVE_FROM_LOCAL, { filePath })
  },
  search: {
    books: (query: string): Promise<IpcResult<BookSearchResult[]>> =>
      ipcRenderer.invoke(IPC_CHANNELS.SEARCH.BOOKS, { query })
  },
  window: {
    minimize: (): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC_CHANNELS.WINDOW.MINIMIZE),
    maximize: (): Promise<IpcResult<boolean>> =>
      ipcRenderer.invoke(IPC_CHANNELS.WINDOW.MAXIMIZE),
    close: (): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC_CHANNELS.WINDOW.CLOSE),
    isMaximized: (): Promise<IpcResult<boolean>> =>
      ipcRenderer.invoke(IPC_CHANNELS.WINDOW.IS_MAXIMIZED)
  }
}

export type BookLogApi = typeof api

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  const customWindow = window as unknown as { electron: typeof electronAPI; api: typeof api }
  customWindow.electron = electronAPI
  customWindow.api = api
}

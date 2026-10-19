import { describe, it, expect, beforeEach, vi } from 'vitest'

type IpcHandler = (event: unknown, ...args: unknown[]) => Promise<unknown> | unknown
const registeredHandlers = new Map<string, IpcHandler>()

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: IpcHandler) => {
      registeredHandlers.set(channel, handler)
    })
  }
}))

import { IPC_CHANNELS } from '../../src/shared/infrastructure/ipc/channels.js'
import {
  IPC_ERROR_CODES,
  type IpcResult,
  type KindleImportReport,
  type KindleNotebookFolderDTO,
  type KindlePreviewResultDTO
} from '../../src/shared/infrastructure/ipc/contracts.js'
import { Book, Highlight, ImportedNotebookFile, Note } from '../../src/shared/domain/index.js'
import type {
  BookRepository,
  HighlightRepository,
  ImportedNotebookFileRepository,
  NoteRepository
} from '../../src/shared/domain/index.js'
import { registerKindleHandlers } from '../../src/main/ipc/kindleHandlers.js'
import {
  KindleFileError,
  type KindleDeviceService
} from '../../src/main/services/KindleDeviceService.js'
import type { KindleNotebookScanner } from '../../src/main/services/KindleNotebookScanner.js'
import { NOTEBOOK_ES_FILE_NAME, NOTEBOOK_ES_HTML } from '../fixtures/kindleNotebooks.js'

class Books implements BookRepository {
  constructor(private readonly items: Book[]) {}
  async findAll(): Promise<Book[]> {
    return this.items
  }
  async findById(id: number): Promise<Book | null> {
    return this.items.find((b) => b.id === id) ?? null
  }
  async findByStatus(): Promise<Book[]> {
    return this.items
  }
  async create(book: Book): Promise<Book> {
    return book
  }
  async update(book: Book): Promise<Book> {
    return book
  }
  async delete(): Promise<void> {}
}

class Highlights implements HighlightRepository {
  public items: Highlight[] = []
  async findByBookId(bookId: number): Promise<Highlight[]> {
    return this.items.filter((h) => h.bookId === bookId)
  }
  async findById(): Promise<Highlight | null> {
    return null
  }
  async create(highlight: Highlight): Promise<Highlight> {
    const saved = Highlight.fromPrimitives({
      ...highlight.toPrimitives(),
      id: this.items.length + 1
    })
    this.items.push(saved)
    return saved
  }
  async delete(): Promise<void> {}
}

class Notes implements NoteRepository {
  public items: Note[] = []
  async findByBookId(bookId: number): Promise<Note[]> {
    return this.items.filter((n) => n.bookId === bookId)
  }
  async findById(): Promise<Note | null> {
    return null
  }
  async create(note: Note): Promise<Note> {
    const saved = Note.fromPrimitives({ ...note.toPrimitives(), id: this.items.length + 1 })
    this.items.push(saved)
    return saved
  }
  async update(note: Note): Promise<Note> {
    return note
  }
  async delete(): Promise<void> {}
}

class ImportedFiles implements ImportedNotebookFileRepository {
  public items = new Map<string, ImportedNotebookFile>()
  async findByPaths(paths: string[]): Promise<ImportedNotebookFile[]> {
    return paths.flatMap((p) =>
      this.items.has(p) ? [this.items.get(p) as ImportedNotebookFile] : []
    )
  }
  async save(file: ImportedNotebookFile): Promise<ImportedNotebookFile> {
    this.items.set(file.path, file)
    return file
  }
}

async function invoke<T>(channel: string, payload?: unknown): Promise<IpcResult<T>> {
  const handler = registeredHandlers.get(channel)
  if (!handler) throw new Error(`No handler registered for ${channel}`)
  return (await handler({}, payload)) as IpcResult<T>
}

const FOLDER = 'E:\\Tomas\\Documents'
const FILE_PATH = `${FOLDER}\\${NOTEBOOK_ES_FILE_NAME}`
const MODIFIED = new Date('2026-10-19T15:40:00.123Z')

describe('Feature #26 — notebook import IPC', () => {
  let scan: ReturnType<typeof vi.fn>
  let resolveFolder: ReturnType<typeof vi.fn>
  let chooseFolder: ReturnType<typeof vi.fn>
  let saveFolder: ReturnType<typeof vi.fn>
  let highlights: Highlights
  let importedFiles: ImportedFiles

  beforeEach(() => {
    registeredHandlers.clear()
    scan = vi.fn(async () => ({
      folder: FOLDER,
      files: [
        {
          fileName: NOTEBOOK_ES_FILE_NAME,
          path: FILE_PATH,
          modifiedAt: MODIFIED,
          html: NOTEBOOK_ES_HTML
        }
      ]
    }))
    resolveFolder = vi.fn(async () => ({ folder: FOLDER, isDefault: true }))
    chooseFolder = vi.fn(async () => 'D:\\Kindle')
    saveFolder = vi.fn(async () => undefined)
    highlights = new Highlights()
    importedFiles = new ImportedFiles()
    registerKindleHandlers({
      bookRepository: new Books([
        new Book({ id: 1, title: 'El crepúsculo de los ídolos', authors: 'Friedrich Nietzsche' })
      ]),
      highlightRepository: highlights,
      noteRepository: new Notes(),
      deviceService: {} as KindleDeviceService,
      chooseFile: vi.fn(),
      notebook: {
        scanner: { scan, resolveFolder } as unknown as KindleNotebookScanner,
        importedFiles,
        chooseFolder,
        saveFolder
      }
    })
  })

  it('should expose typed channel names', () => {
    expect(IPC_CHANNELS.KINDLE_NOTEBOOK).toEqual({
      PREVIEW: 'kindleNotebook:preview',
      GET_FOLDER: 'kindleNotebook:getFolder',
      CHOOSE_FOLDER: 'kindleNotebook:chooseFolder',
      RESET_FOLDER: 'kindleNotebook:resetFolder'
    })
  })

  it('should scan the folder and return a preview without paths or contents', async () => {
    const result = await invoke<KindlePreviewResultDTO>(IPC_CHANNELS.KINDLE_NOTEBOOK.PREVIEW)
    if (!result.success) throw new Error(result.error)
    expect(result.data).toMatchObject({ source: 'NOTEBOOK', sourceLabel: FOLDER })
    expect(result.data.preview.groups).toHaveLength(1)
    expect(result.data.preview.groups[0]).toMatchObject({
      key: NOTEBOOK_ES_FILE_NAME,
      importState: 'NEW',
      match: { bookId: 1 }
    })
    expect(JSON.stringify(result.data)).not.toContain('Primer subrayado inventado')
    expect(JSON.stringify(result.data)).not.toContain(FILE_PATH.replace(/\\/gu, '\\\\'))
  })

  it('should commit the notebook session through kindle:commit and remember the file', async () => {
    const preview = await invoke<KindlePreviewResultDTO>(IPC_CHANNELS.KINDLE_NOTEBOOK.PREVIEW)
    if (!preview.success) throw new Error(preview.error)
    const dto = {
      sourceId: preview.data.sourceId,
      assignments: [{ groupKey: NOTEBOOK_ES_FILE_NAME, bookId: 1 }]
    }
    const result = await invoke<KindleImportReport>(IPC_CHANNELS.KINDLE.COMMIT, dto)
    expect(result).toMatchObject({
      success: true,
      data: { highlightsImported: 10, notesImported: 5 }
    })
    expect(importedFiles.items.get(FILE_PATH)?.matches(MODIFIED)).toBe(true)
    expect(await invoke(IPC_CHANNELS.KINDLE.COMMIT, dto)).toMatchObject({
      success: false,
      code: IPC_ERROR_CODES.KINDLE_SESSION_EXPIRED
    })

    const again = await invoke<KindlePreviewResultDTO>(IPC_CHANNELS.KINDLE_NOTEBOOK.PREVIEW)
    expect(again.success && again.data.preview.groups[0]?.importState).toBe('IMPORTED')
  })

  it('should report a folder that cannot be read', async () => {
    scan.mockRejectedValueOnce(new KindleFileError('No se pudo abrir la carpeta'))
    expect(await invoke(IPC_CHANNELS.KINDLE_NOTEBOOK.PREVIEW)).toMatchObject({
      success: false,
      code: IPC_ERROR_CODES.KINDLE_FILE_ERROR
    })
  })

  it('should read, choose and reset the folder from the main process', async () => {
    expect(await invoke<KindleNotebookFolderDTO>(IPC_CHANNELS.KINDLE_NOTEBOOK.GET_FOLDER)).toEqual({
      success: true,
      data: { folder: FOLDER, isDefault: true }
    })

    resolveFolder.mockResolvedValueOnce({ folder: 'D:\\Kindle', isDefault: false })
    expect(await invoke(IPC_CHANNELS.KINDLE_NOTEBOOK.CHOOSE_FOLDER)).toEqual({
      success: true,
      data: { folder: 'D:\\Kindle', isDefault: false }
    })
    expect(saveFolder).toHaveBeenCalledWith('D:\\Kindle')

    chooseFolder.mockResolvedValueOnce(null)
    expect(await invoke(IPC_CHANNELS.KINDLE_NOTEBOOK.CHOOSE_FOLDER)).toEqual({
      success: true,
      data: null
    })
    expect(saveFolder).toHaveBeenCalledTimes(1)

    expect(await invoke(IPC_CHANNELS.KINDLE_NOTEBOOK.RESET_FOLDER, 'C:\\Windows')).toMatchObject({
      success: true,
      data: { isDefault: true }
    })
    expect(saveFolder).toHaveBeenLastCalledWith('')
  })
})

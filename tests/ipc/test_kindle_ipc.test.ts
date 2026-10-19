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
  type KindlePreviewResultDTO
} from '../../src/shared/infrastructure/ipc/contracts.js'
import { Book, BookStatus, Highlight, Note } from '../../src/shared/domain/index.js'
import type {
  BookRepository,
  HighlightRepository,
  NoteRepository
} from '../../src/shared/domain/index.js'
import { registerKindleHandlers } from '../../src/main/ipc/kindleHandlers.js'
import {
  KindleDeviceError,
  KindleFileError,
  type KindleDeviceService
} from '../../src/main/services/KindleDeviceService.js'
import { KINDLE_FIXTURE_TEXT, KINDLE_TITLES } from '../fixtures/kindleClippings.js'

class Books implements BookRepository {
  constructor(private readonly items: Book[]) {}
  async findAll(): Promise<Book[]> {
    return this.items
  }
  async findById(id: number): Promise<Book | null> {
    return this.items.find((b) => b.id === id) ?? null
  }
  async findByStatus(status: BookStatus): Promise<Book[]> {
    return this.items.filter((b) => b.status === status)
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
  async findById(id: number): Promise<Highlight | null> {
    return this.items.find((h) => h.id === id) ?? null
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
  async findById(id: number): Promise<Note | null> {
    return this.items.find((n) => n.id === id) ?? null
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

async function invoke<T>(channel: string, payload?: unknown): Promise<IpcResult<T>> {
  const handler = registeredHandlers.get(channel)
  if (!handler) throw new Error(`No handler registered for ${channel}`)
  return (await handler({}, payload)) as IpcResult<T>
}

describe('Feature #23 — Kindle import IPC', () => {
  let readFromDevice: ReturnType<typeof vi.fn>
  let readFromFile: ReturnType<typeof vi.fn>
  let chooseFile: ReturnType<typeof vi.fn>
  let highlights: Highlights

  beforeEach(() => {
    registeredHandlers.clear()
    readFromDevice = vi.fn(async () => ({ text: KINDLE_FIXTURE_TEXT, label: 'Kindle Paperwhite' }))
    readFromFile = vi.fn(async () => ({ text: KINDLE_FIXTURE_TEXT, label: 'My Clippings.txt' }))
    chooseFile = vi.fn(async () => 'C:\\copias\\My Clippings.txt')
    highlights = new Highlights()
    registerKindleHandlers({
      bookRepository: new Books([
        new Book({ id: 1, title: 'Legado de cenizas', authors: 'Tim Weiner' })
      ]),
      highlightRepository: highlights,
      noteRepository: new Notes(),
      deviceService: { readFromDevice, readFromFile } as unknown as KindleDeviceService,
      chooseFile
    })
  })

  it('should expose typed channel names', () => {
    expect(IPC_CHANNELS.KINDLE).toEqual({
      PREVIEW_FROM_DEVICE: 'kindle:previewFromDevice',
      PREVIEW_FROM_FILE: 'kindle:previewFromFile',
      COMMIT: 'kindle:commit'
    })
  })

  it('should read the device and return a preview with a session id', async () => {
    const result = await invoke<KindlePreviewResultDTO>(IPC_CHANNELS.KINDLE.PREVIEW_FROM_DEVICE)
    if (!result.success) throw new Error(result.error)
    expect(result.data.source).toBe('DEVICE')
    expect(result.data.sourceLabel).toBe('Kindle Paperwhite')
    expect(result.data.sourceId).toMatch(/[0-9a-f-]{36}/u)
    expect(result.data.preview.groups).toHaveLength(12)
    expect(JSON.stringify(result.data)).not.toContain('Texto inventado del primer subrayado')
  })

  it.each([
    ['NOT_FOUND', IPC_ERROR_CODES.KINDLE_NOT_FOUND],
    ['TIMEOUT', IPC_ERROR_CODES.KINDLE_COPY_TIMEOUT],
    ['UNSUPPORTED', IPC_ERROR_CODES.KINDLE_UNSUPPORTED],
    ['FAILED', IPC_ERROR_CODES.KINDLE_DEVICE_ERROR]
  ] as const)('should translate device failure %s to %s', async (reason, code) => {
    readFromDevice.mockRejectedValueOnce(new KindleDeviceError(reason, 'mensaje'))
    const result = await invoke(IPC_CHANNELS.KINDLE.PREVIEW_FROM_DEVICE)
    expect(result).toEqual({ success: false, error: 'mensaje', code })
  })

  it('should return null when the file dialog is cancelled', async () => {
    chooseFile.mockResolvedValueOnce(null)
    const result = await invoke(IPC_CHANNELS.KINDLE.PREVIEW_FROM_FILE)
    expect(result).toEqual({ success: true, data: null })
    expect(readFromFile).not.toHaveBeenCalled()
  })

  it('should read the chosen file and report file errors', async () => {
    const ok = await invoke<KindlePreviewResultDTO>(IPC_CHANNELS.KINDLE.PREVIEW_FROM_FILE)
    expect(ok.success && ok.data.source).toBe('FILE')
    expect(readFromFile).toHaveBeenCalledWith('C:\\copias\\My Clippings.txt')

    readFromFile.mockRejectedValueOnce(new KindleFileError('vacío'))
    const failed = await invoke(IPC_CHANNELS.KINDLE.PREVIEW_FROM_FILE)
    expect(failed).toMatchObject({ success: false, code: IPC_ERROR_CODES.KINDLE_FILE_ERROR })
  })

  it('should commit with the stored text and expire the session afterwards', async () => {
    const preview = await invoke<KindlePreviewResultDTO>(IPC_CHANNELS.KINDLE.PREVIEW_FROM_DEVICE)
    if (!preview.success) throw new Error(preview.error)
    const dto = {
      sourceId: preview.data.sourceId,
      assignments: [{ groupKey: KINDLE_TITLES.dashAuthor.trim(), bookId: 1 }]
    }

    const result = await invoke<KindleImportReport>(IPC_CHANNELS.KINDLE.COMMIT, dto)
    expect(result).toMatchObject({
      success: true,
      data: { highlightsImported: 2, notesImported: 1 }
    })
    expect(highlights.items).toHaveLength(2)

    const again = await invoke(IPC_CHANNELS.KINDLE.COMMIT, dto)
    expect(again).toMatchObject({ success: false, code: IPC_ERROR_CODES.KINDLE_SESSION_EXPIRED })
  })

  it('should validate the commit payload and map domain errors', async () => {
    expect(await invoke(IPC_CHANNELS.KINDLE.COMMIT, undefined)).toMatchObject({
      success: false,
      code: IPC_ERROR_CODES.VALIDATION_ERROR
    })
    const preview = await invoke<KindlePreviewResultDTO>(IPC_CHANNELS.KINDLE.PREVIEW_FROM_DEVICE)
    if (!preview.success) throw new Error(preview.error)
    const unknownBook = await invoke(IPC_CHANNELS.KINDLE.COMMIT, {
      sourceId: preview.data.sourceId,
      assignments: [{ groupKey: KINDLE_TITLES.dashAuthor.trim(), bookId: 99 }]
    })
    expect(unknownBook).toMatchObject({ success: false, code: IPC_ERROR_CODES.BOOK_NOT_FOUND })
    const unknownGroup = await invoke(IPC_CHANNELS.KINDLE.COMMIT, {
      sourceId: preview.data.sourceId,
      assignments: [{ groupKey: 'Otro libro', bookId: 1 }]
    })
    expect(unknownGroup).toMatchObject({ success: false, code: IPC_ERROR_CODES.VALIDATION_ERROR })
  })
})

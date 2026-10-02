import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

// Setup electron mock before importing handlers
type IpcHandler = (event: unknown, ...args: unknown[]) => Promise<unknown> | unknown
const registeredHandlers = new Map<string, IpcHandler>()

vi.mock('electron', () => {
  return {
    ipcMain: {
      handle: vi.fn((channel: string, handler: IpcHandler) => {
        registeredHandlers.set(channel, handler)
      })
    },
    app: {
      getPath: vi.fn(() => os.tmpdir()),
      getVersion: vi.fn(() => '1.0.0'),
      getName: vi.fn(() => 'BookLog')
    },
    safeStorage: {
      isEncryptionAvailable: vi.fn(() => false),
      encryptString: vi.fn((val: string) => Buffer.from(val)),
      decryptString: vi.fn((buf: Buffer) => buf.toString())
    },
    BrowserWindow: {
      fromWebContents: vi.fn(),
      getFocusedWindow: vi.fn()
    }
  }
})

import { IPC_CHANNELS } from '../../src/shared/infrastructure/ipc/channels.js'
import {
  ipcSuccess,
  ipcError,
  formatIpcError,
  IPC_ERROR_CODES,
  type IpcResult,
  type BookPrimitives,
  type NotePrimitives
} from '../../src/shared/infrastructure/ipc/contracts.js'
import {
  Book,
  BookStatus,
  Note,
  InvalidBookError,
  InvalidNoteError,
  InvalidProgressError
} from '../../src/shared/domain/index.js'
import { BookNotFoundError, NoteNotFoundError } from '../../src/shared/application/index.js'
import type { BookRepository } from '../../src/shared/domain/ports/BookRepository.js'
import type { NoteRepository } from '../../src/shared/domain/ports/NoteRepository.js'

import { registerBookHandlers } from '../../src/main/ipc/bookHandlers.js'
import { registerNoteHandlers } from '../../src/main/ipc/noteHandlers.js'
import { registerCoverHandlers } from '../../src/main/ipc/coverHandlers.js'
import { registerSearchHandlers } from '../../src/main/ipc/searchHandlers.js'
import { registerWindowHandlers } from '../../src/main/ipc/windowHandlers.js'
import { registerSettingsHandlers } from '../../src/main/ipc/settingsHandlers.js'
import { SettingsStorageService } from '../../src/main/services/SettingsStorageService.js'
import type { BookSearchService, BookSearchResult } from '../../src/shared/domain/ports/BookSearchService.js'
import { CoverStorageService } from '../../src/main/services/CoverStorageService.js'
import { resolveCoverUrl } from '../../src/renderer/src/services/coverService.js'
import type {
  AppSettingsDTO,
  SaveSettingsDTO,
  TestApiKeyResultDTO,
  AppInfoDTO
} from '../../src/shared/infrastructure/ipc/contracts.js'

class MockBookRepository implements BookRepository {
  public books: Map<number, Book> = new Map()
  private nextId = 1

  async findAll(): Promise<Book[]> {
    return Array.from(this.books.values())
  }

  async findById(id: number): Promise<Book | null> {
    const book = this.books.get(id)
    if (!book) return null
    return Book.fromPrimitives(book.toPrimitives())
  }

  async findByStatus(status: BookStatus): Promise<Book[]> {
    return Array.from(this.books.values()).filter((b) => b.status === status)
  }

  async create(book: Book): Promise<Book> {
    const primitives = book.toPrimitives()
    const id = primitives.id ?? this.nextId++
    const saved = Book.fromPrimitives({ ...primitives, id })
    this.books.set(id, saved)
    return Book.fromPrimitives(saved.toPrimitives())
  }

  async update(book: Book): Promise<Book> {
    if (!book.id || !this.books.has(book.id)) {
      throw new Error(`Book with id ${book.id} not found in mock repository`)
    }
    const updated = Book.fromPrimitives(book.toPrimitives())
    this.books.set(book.id, updated)
    return Book.fromPrimitives(updated.toPrimitives())
  }

  async delete(id: number): Promise<void> {
    this.books.delete(id)
  }
}

class MockNoteRepository implements NoteRepository {
  public notes: Map<number, Note> = new Map()
  private nextId = 1

  async findByBookId(bookId: number): Promise<Note[]> {
    return Array.from(this.notes.values())
      .filter((n) => n.bookId === bookId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  }

  async findById(id: number): Promise<Note | null> {
    const note = this.notes.get(id)
    if (!note) return null
    return Note.fromPrimitives(note.toPrimitives())
  }

  async create(note: Note): Promise<Note> {
    const primitives = note.toPrimitives()
    const id = primitives.id ?? this.nextId++
    const saved = Note.fromPrimitives({ ...primitives, id })
    this.notes.set(id, saved)
    return Note.fromPrimitives(saved.toPrimitives())
  }

  async update(note: Note): Promise<Note> {
    if (!note.id || !this.notes.has(note.id)) {
      throw new Error(`Note with id ${note.id} not found in mock repository`)
    }
    const updated = Note.fromPrimitives(note.toPrimitives())
    this.notes.set(note.id, updated)
    return Note.fromPrimitives(updated.toPrimitives())
  }

  async delete(id: number): Promise<void> {
    this.notes.delete(id)
  }
}

describe('IPC Contracts and Result Pattern', () => {
  it('should construct a successful IpcResult', () => {
    const result = ipcSuccess({ id: 1, title: 'Clean Architecture' })
    expect(result).toEqual({
      success: true,
      data: { id: 1, title: 'Clean Architecture' }
    })
  })

  it('should construct a failure IpcResult with error message and code', () => {
    const result = ipcError('Libro no encontrado', IPC_ERROR_CODES.BOOK_NOT_FOUND)
    expect(result).toEqual({
      success: false,
      error: 'Libro no encontrado',
      code: 'BOOK_NOT_FOUND'
    })
  })

  describe('formatIpcError', () => {
    it('should format BookNotFoundError with code BOOK_NOT_FOUND', () => {
      const err = new BookNotFoundError(42)
      const res = formatIpcError(err)
      expect(res).toEqual({
        success: false,
        error: 'Libro con ID 42 no encontrado.',
        code: IPC_ERROR_CODES.BOOK_NOT_FOUND
      })
    })

    it('should format NoteNotFoundError with code NOTE_NOT_FOUND', () => {
      const err = new NoteNotFoundError(99)
      const res = formatIpcError(err)
      expect(res).toEqual({
        success: false,
        error: 'Nota con ID 99 no encontrada.',
        code: IPC_ERROR_CODES.NOTE_NOT_FOUND
      })
    })

    it('should format InvalidBookError with code VALIDATION_ERROR', () => {
      const err = new InvalidBookError('Título no válido')
      const res = formatIpcError(err)
      expect(res).toEqual({
        success: false,
        error: 'Título no válido',
        code: IPC_ERROR_CODES.VALIDATION_ERROR
      })
    })

    it('should format InvalidNoteError with code VALIDATION_ERROR', () => {
      const err = new InvalidNoteError('Contenido vacío')
      const res = formatIpcError(err)
      expect(res).toEqual({
        success: false,
        error: 'Contenido vacío',
        code: IPC_ERROR_CODES.VALIDATION_ERROR
      })
    })

    it('should format InvalidProgressError with code VALIDATION_ERROR', () => {
      const err = new InvalidProgressError('Progreso negativo')
      const res = formatIpcError(err)
      expect(res).toEqual({
        success: false,
        error: 'Progreso negativo',
        code: IPC_ERROR_CODES.VALIDATION_ERROR
      })
    })

    it('should format generic standard Error with code INTERNAL_ERROR', () => {
      const err = new Error('Falla en la base de datos')
      const res = formatIpcError(err)
      expect(res).toEqual({
        success: false,
        error: 'Falla en la base de datos',
        code: IPC_ERROR_CODES.INTERNAL_ERROR
      })
    })

    it('should format non-Error objects gracefully', () => {
      const res = formatIpcError('Error inesperado como string')
      expect(res).toEqual({
        success: false,
        error: 'Error inesperado como string',
        code: IPC_ERROR_CODES.INTERNAL_ERROR
      })
    })
  })
})

describe('Book IPC Handlers Integration', () => {
  let bookRepo: MockBookRepository

  beforeEach(() => {
    bookRepo = new MockBookRepository()
    registeredHandlers.clear()
    registerBookHandlers(bookRepo)
  })

  async function invoke<T>(channel: string, args?: unknown): Promise<IpcResult<T>> {
    const handler = registeredHandlers.get(channel)
    if (!handler) {
      throw new Error(`Handler not registered for channel: ${channel}`)
    }
    return (await handler(null, args)) as IpcResult<T>
  }

  it('should list books returning IpcResult with primitives', async () => {
    await bookRepo.create(Book.create({ title: 'Book 1', authors: 'Author 1' }))
    await bookRepo.create(Book.create({ title: 'Book 2', authors: 'Author 2', status: BookStatus.READING }))

    const result = await invoke<BookPrimitives[]>(IPC_CHANNELS.BOOKS.LIST)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toHaveLength(2)
      expect(result.data[0]?.title).toBe('Book 1')
      expect(result.data[1]?.title).toBe('Book 2')
    }

    const filtered = await invoke<BookPrimitives[]>(IPC_CHANNELS.BOOKS.LIST, { status: BookStatus.READING })
    expect(filtered.success).toBe(true)
    if (filtered.success) {
      expect(filtered.data).toHaveLength(1)
      expect(filtered.data[0]?.title).toBe('Book 2')
    }
  })

  it('should get book by ID on success', async () => {
    const created = await bookRepo.create(Book.create({ title: 'Domain-Driven Design', authors: 'Eric Evans' }))

    const result = await invoke<BookPrimitives>(IPC_CHANNELS.BOOKS.GET_BY_ID, { id: created.id! })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.title).toBe('Domain-Driven Design')
      expect(result.data.authors).toBe('Eric Evans')
    }
  })

  it('should return BOOK_NOT_FOUND if book does not exist on getById', async () => {
    const result = await invoke<BookPrimitives>(IPC_CHANNELS.BOOKS.GET_BY_ID, { id: 999 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe(IPC_ERROR_CODES.BOOK_NOT_FOUND)
      expect(result.error).toContain('999')
    }
  })

  it('should return VALIDATION_ERROR on invalid getById parameters', async () => {
    const result = await invoke<BookPrimitives>(IPC_CHANNELS.BOOKS.GET_BY_ID, { id: NaN })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe(IPC_ERROR_CODES.VALIDATION_ERROR)
    }
  })

  it('should create a book and return primitives', async () => {
    const result = await invoke<BookPrimitives>(IPC_CHANNELS.BOOKS.CREATE, {
      title: 'Refactoring',
      authors: 'Martin Fowler',
      pageCount: 450
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.id).toBeDefined()
      expect(result.data.title).toBe('Refactoring')
      expect(result.data.pageCount).toBe(450)
    }
  })

  it('should return VALIDATION_ERROR when creating book with empty title', async () => {
    const result = await invoke<BookPrimitives>(IPC_CHANNELS.BOOKS.CREATE, {
      title: '',
      authors: 'Martin Fowler'
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe(IPC_ERROR_CODES.VALIDATION_ERROR)
      expect(result.error).toContain('título')
    }
  })

  it('should update book status', async () => {
    const created = await bookRepo.create(Book.create({ title: 'Book A', authors: 'Author A' }))

    const result = await invoke<BookPrimitives>(IPC_CHANNELS.BOOKS.UPDATE_STATUS, {
      id: created.id!,
      status: BookStatus.READING
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe(BookStatus.READING)
    }
  })

  it('should return BOOK_NOT_FOUND when updating status of non-existent book', async () => {
    const result = await invoke<BookPrimitives>(IPC_CHANNELS.BOOKS.UPDATE_STATUS, {
      id: 555,
      status: BookStatus.READING
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe(IPC_ERROR_CODES.BOOK_NOT_FOUND)
    }
  })

  it('should return VALIDATION_ERROR when updating book status with invalid value', async () => {
    const created = await bookRepo.create(Book.create({ title: 'Book A', authors: 'Author A' }))

    const result = await invoke<BookPrimitives>(IPC_CHANNELS.BOOKS.UPDATE_STATUS, {
      id: created.id!,
      // @ts-expect-error test invalid status
      status: 'INVALID_STATUS'
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe(IPC_ERROR_CODES.VALIDATION_ERROR)
    }
  })

  it('should update book progress and auto-finish when reaching 100%', async () => {
    const created = await bookRepo.create(
      Book.create({ title: 'Book P', authors: 'Author P', pageCount: 200, status: BookStatus.READING })
    )

    const result = await invoke<BookPrimitives>(IPC_CHANNELS.BOOKS.UPDATE_PROGRESS, {
      id: created.id!,
      page: 200
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.currentPage).toBe(200)
      expect(result.data.progressPercentage).toBe(100)
      expect(result.data.status).toBe(BookStatus.FINISHED)
    }
  })

  it('should return VALIDATION_ERROR on invalid page progress', async () => {
    const created = await bookRepo.create(
      Book.create({ title: 'Book P', authors: 'Author P', pageCount: 100 })
    )

    const result = await invoke<BookPrimitives>(IPC_CHANNELS.BOOKS.UPDATE_PROGRESS, {
      id: created.id!,
      page: 150
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe(IPC_ERROR_CODES.VALIDATION_ERROR)
    }
  })

  it('should rate a book', async () => {
    const created = await bookRepo.create(Book.create({ title: 'Book R', authors: 'Author R' }))

    const result = await invoke<BookPrimitives>(IPC_CHANNELS.BOOKS.RATE, {
      id: created.id!,
      rating: 5
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.rating).toBe(5)
    }
  })

  it('should return VALIDATION_ERROR on invalid rating value', async () => {
    const created = await bookRepo.create(Book.create({ title: 'Book R', authors: 'Author R' }))

    const result = await invoke<BookPrimitives>(IPC_CHANNELS.BOOKS.RATE, {
      id: created.id!,
      rating: 6
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe(IPC_ERROR_CODES.VALIDATION_ERROR)
    }
  })

  it('should delete a book', async () => {
    const created = await bookRepo.create(Book.create({ title: 'To Delete', authors: 'Author' }))

    const result = await invoke<void>(IPC_CHANNELS.BOOKS.DELETE, { id: created.id! })
    expect(result.success).toBe(true)

    const found = await bookRepo.findById(created.id!)
    expect(found).toBeNull()
  })

  it('should return BOOK_NOT_FOUND when deleting non-existent book', async () => {
    const result = await invoke<void>(IPC_CHANNELS.BOOKS.DELETE, { id: 777 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe(IPC_ERROR_CODES.BOOK_NOT_FOUND)
    }
  })
})

describe('Note IPC Handlers Integration', () => {
  let bookRepo: MockBookRepository
  let noteRepo: MockNoteRepository
  let bookId: number

  beforeEach(async () => {
    bookRepo = new MockBookRepository()
    noteRepo = new MockNoteRepository()
    registeredHandlers.clear()
    registerNoteHandlers(bookRepo, noteRepo)

    const book = await bookRepo.create(Book.create({ title: 'Note Parent', authors: 'Author' }))
    bookId = book.id!
  })

  async function invoke<T>(channel: string, args?: unknown): Promise<IpcResult<T>> {
    const handler = registeredHandlers.get(channel)
    if (!handler) {
      throw new Error(`Handler not registered for channel: ${channel}`)
    }
    return (await handler(null, args)) as IpcResult<T>
  }

  it('should create a note for a book', async () => {
    const result = await invoke<NotePrimitives>(IPC_CHANNELS.NOTES.CREATE, {
      bookId,
      content: 'Gran introducción al patrón Repository.'
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.id).toBeDefined()
      expect(result.data.bookId).toBe(bookId)
      expect(result.data.content).toBe('Gran introducción al patrón Repository.')
    }
  })

  it('should return BOOK_NOT_FOUND when creating note for non-existent book', async () => {
    const result = await invoke<NotePrimitives>(IPC_CHANNELS.NOTES.CREATE, {
      bookId: 888,
      content: 'Contenido válido'
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe(IPC_ERROR_CODES.BOOK_NOT_FOUND)
    }
  })

  it('should return VALIDATION_ERROR when creating note with empty content', async () => {
    const result = await invoke<NotePrimitives>(IPC_CHANNELS.NOTES.CREATE, {
      bookId,
      content: '   '
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe(IPC_ERROR_CODES.VALIDATION_ERROR)
    }
  })

  it('should get notes by book', async () => {
    await noteRepo.create(Note.create({ bookId, content: 'Nota 1' }))
    await noteRepo.create(Note.create({ bookId, content: 'Nota 2' }))

    const result = await invoke<NotePrimitives[]>(IPC_CHANNELS.NOTES.GET_BY_BOOK, { bookId })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toHaveLength(2)
      expect(result.data[0]?.content).toBe('Nota 1')
      expect(result.data[1]?.content).toBe('Nota 2')
    }
  })

  it('should return BOOK_NOT_FOUND when getting notes of non-existent book', async () => {
    const result = await invoke<NotePrimitives[]>(IPC_CHANNELS.NOTES.GET_BY_BOOK, { bookId: 9999 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe(IPC_ERROR_CODES.BOOK_NOT_FOUND)
    }
  })

  it('should update note content', async () => {
    const note = await noteRepo.create(Note.create({ bookId, content: 'Original' }))

    const result = await invoke<NotePrimitives>(IPC_CHANNELS.NOTES.UPDATE, {
      id: note.id!,
      content: 'Modificado con éxito'
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.content).toBe('Modificado con éxito')
    }
  })

  it('should return NOTE_NOT_FOUND when updating non-existent note', async () => {
    const result = await invoke<NotePrimitives>(IPC_CHANNELS.NOTES.UPDATE, {
      id: 9999,
      content: 'Nuevo contenido'
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe(IPC_ERROR_CODES.NOTE_NOT_FOUND)
    }
  })

  it('should delete a note', async () => {
    const note = await noteRepo.create(Note.create({ bookId, content: 'Eliminar' }))

    const result = await invoke<void>(IPC_CHANNELS.NOTES.DELETE, { id: note.id! })
    expect(result.success).toBe(true)

    const found = await noteRepo.findById(note.id!)
    expect(found).toBeNull()
  })

  it('should return NOTE_NOT_FOUND when deleting non-existent note', async () => {
    const result = await invoke<void>(IPC_CHANNELS.NOTES.DELETE, { id: 8888 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe(IPC_ERROR_CODES.NOTE_NOT_FOUND)
    }
  })
})

describe('CoverStorageService and Cover IPC Handlers', () => {
  let tempDir: string
  let coverService: CoverStorageService

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `booklog-test-covers-${Date.now()}-${Math.random().toString(36).substring(7)}`)
    await fs.promises.mkdir(tempDir, { recursive: true })
    coverService = new CoverStorageService(tempDir)
    registeredHandlers.clear()
    registerCoverHandlers(coverService)
  })

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true })
    } catch {
      // ignore cleanup errors in tests
    }
  })

  async function invoke<T>(channel: string, args?: unknown): Promise<IpcResult<T>> {
    const handler = registeredHandlers.get(channel)
    if (!handler) {
      throw new Error(`Handler not registered for channel: ${channel}`)
    }
    return (await handler(null, args)) as IpcResult<T>
  }

  it('should save a local file into covers directory and return relative path', async () => {
    const sampleFilePath = path.join(tempDir, 'sample_cover.png')
    await fs.promises.writeFile(sampleFilePath, Buffer.from('fake-image-bytes'))

    const relativePath = await coverService.saveFromLocalFile(sampleFilePath)
    expect(relativePath).toMatch(/^covers\/[a-f0-9-]+\.png$/)

    const fullPath = coverService.getCoverFullPath(relativePath)
    expect(fs.existsSync(fullPath)).toBe(true)
    const content = await fs.promises.readFile(fullPath)
    expect(content.toString()).toBe('fake-image-bytes')
  })

  it('should throw error when source local file does not exist', async () => {
    const nonExistentPath = path.join(tempDir, 'does-not-exist.jpg')
    await expect(coverService.saveFromLocalFile(nonExistentPath)).rejects.toThrow('no existe')
  })

  it('should prevent path traversal outside covers directory in getCoverFullPath', () => {
    expect(() => {
      coverService.getCoverFullPath('../../../etc/passwd')
    }).toThrow('Ruta de portada inválida')
  })

  it('should save cover from URL using mocked fetch', async () => {
    const mockImageBytes = new TextEncoder().encode('remote-image-content')
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (h: string) => (h === 'content-type' ? 'image/jpeg' : null)
      },
      arrayBuffer: async () => mockImageBytes.buffer
    } as unknown as Response)

    try {
      const relativePath = await coverService.saveFromUrl('https://example.com/books/cover.jpg')
      expect(relativePath).toMatch(/^covers\/[a-f0-9-]+\.jpg$/)

      const fullPath = coverService.getCoverFullPath(relativePath)
      expect(fs.existsSync(fullPath)).toBe(true)
      const data = await fs.promises.readFile(fullPath)
      expect(data.toString()).toBe('remote-image-content')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('should handle cover saveFromUrl IPC channel successfully', async () => {
    const mockImageBytes = new TextEncoder().encode('ipc-cover')
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (h: string) => (h === 'content-type' ? 'image/webp' : null)
      },
      arrayBuffer: async () => mockImageBytes.buffer
    } as unknown as Response)

    try {
      const result = await invoke<string>(IPC_CHANNELS.COVERS.SAVE_FROM_URL, {
        url: 'https://images.example.com/cover.webp'
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toMatch(/^covers\/[a-f0-9-]+\.webp$/)
      }
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('should return VALIDATION_ERROR on invalid url for covers:saveFromUrl', async () => {
    const result = await invoke<string>(IPC_CHANNELS.COVERS.SAVE_FROM_URL, {
      url: ''
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe(IPC_ERROR_CODES.VALIDATION_ERROR)
    }
  })

  it('should handle cover saveFromLocal IPC channel successfully', async () => {
    const localImg = path.join(tempDir, 'my_pic.jpg')
    await fs.promises.writeFile(localImg, Buffer.from('img-bytes'))

    const result = await invoke<string>(IPC_CHANNELS.COVERS.SAVE_FROM_LOCAL, {
      filePath: localImg
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toMatch(/^covers\/[a-f0-9-]+\.jpg$/)
    }
  })

  it('should return VALIDATION_ERROR on missing filePath for covers:saveFromLocal', async () => {
    const result = await invoke<string>(IPC_CHANNELS.COVERS.SAVE_FROM_LOCAL, {})
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe(IPC_ERROR_CODES.VALIDATION_ERROR)
    }
  })
})

describe('Renderer coverService.resolveUrl', () => {
  it('should return fallback if input is null, undefined or empty', () => {
    expect(resolveCoverUrl(null, '/placeholder.png')).toBe('/placeholder.png')
    expect(resolveCoverUrl(undefined, '/placeholder.png')).toBe('/placeholder.png')
    expect(resolveCoverUrl('', '/placeholder.png')).toBe('/placeholder.png')
    expect(resolveCoverUrl('   ', '/placeholder.png')).toBe('/placeholder.png')
  })

  it('should preserve external HTTP and HTTPS URLs', () => {
    expect(resolveCoverUrl('http://books.google.com/cover.jpg')).toBe('http://books.google.com/cover.jpg')
    expect(resolveCoverUrl('https://books.google.com/cover.jpg')).toBe('https://books.google.com/cover.jpg')
  })

  it('should preserve base64 data URLs', () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='
    expect(resolveCoverUrl(dataUrl)).toBe(dataUrl)
  })

  it('should preserve existing booklog-media:// URLs', () => {
    expect(resolveCoverUrl('booklog-media://covers/uuid.jpg')).toBe('booklog-media://covers/uuid.jpg')
  })

  it('should convert relative covers/ path into booklog-media:// URL', () => {
    expect(resolveCoverUrl('covers/abc-123.jpg')).toBe('booklog-media://covers/abc-123.jpg')
    expect(resolveCoverUrl('covers\\abc-123.jpg')).toBe('booklog-media://covers/abc-123.jpg')
    expect(resolveCoverUrl('/covers/abc-123.jpg')).toBe('booklog-media://covers/abc-123.jpg')
  })

  it('should convert raw filename into booklog-media://covers/ URL', () => {
    expect(resolveCoverUrl('abc-123.png')).toBe('booklog-media://covers/abc-123.png')
  })
})

describe('IPC Search Handlers (SEARCH.BOOKS)', () => {
  let searchServiceMock: BookSearchService

  beforeEach(() => {
    registeredHandlers.clear()
    searchServiceMock = {
      searchByQuery: vi.fn()
    }
    registerSearchHandlers(searchServiceMock)
  })

  async function invoke<T>(channel: string, args?: unknown): Promise<IpcResult<T>> {
    const handler = registeredHandlers.get(channel)
    if (!handler) {
      throw new Error(`Handler not registered for channel: ${channel}`)
    }
    return (await handler(null, args)) as IpcResult<T>
  }

  it('should return empty list when query is empty or not a string', async () => {
    const resEmpty = await invoke<BookSearchResult[]>(IPC_CHANNELS.SEARCH.BOOKS, '')
    expect(resEmpty).toEqual({ success: true, data: [] })
    expect(searchServiceMock.searchByQuery).not.toHaveBeenCalled()

    const resObj = await invoke<BookSearchResult[]>(IPC_CHANNELS.SEARCH.BOOKS, { query: '   ' })
    expect(resObj).toEqual({ success: true, data: [] })
    expect(searchServiceMock.searchByQuery).not.toHaveBeenCalled()
  })

  it('should call searchService and return results when query is provided', async () => {
    const mockResults: BookSearchResult[] = [
      {
        googleBooksId: 'id1',
        title: 'Don Quijote',
        authors: ['Miguel de Cervantes'],
        publishedDate: '1605',
        pageCount: 863,
        coverUrl: 'https://example.com/quijote.jpg',
        isbn: '9788424116286'
      }
    ]
    vi.mocked(searchServiceMock.searchByQuery).mockResolvedValue(mockResults)

    const res = await invoke<BookSearchResult[]>(IPC_CHANNELS.SEARCH.BOOKS, { query: 'Quijote' })
    expect(res).toEqual({ success: true, data: mockResults })
    expect(searchServiceMock.searchByQuery).toHaveBeenCalledWith('Quijote')
  })

  it('should return formatted IPC error when searchService throws', async () => {
    vi.mocked(searchServiceMock.searchByQuery).mockRejectedValue(new Error('Network error'))

    const res = await invoke<BookSearchResult[]>(IPC_CHANNELS.SEARCH.BOOKS, 'Test')
    expect(res.success).toBe(false)
    if (!res.success) {
      expect(res.error).toBe('Network error')
      expect(res.code).toBe(IPC_ERROR_CODES.INTERNAL_ERROR)
    }
  })
})

describe('Window IPC Handlers (WINDOW.*)', () => {
  let maximizedState = false
  let mockWindow: {
    minimize: ReturnType<typeof vi.fn>
    maximize: ReturnType<typeof vi.fn>
    unmaximize: ReturnType<typeof vi.fn>
    close: ReturnType<typeof vi.fn>
    isMaximized: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    registeredHandlers.clear()
    maximizedState = false
    mockWindow = {
      minimize: vi.fn(),
      maximize: vi.fn(() => {
        maximizedState = true
      }),
      unmaximize: vi.fn(() => {
        maximizedState = false
      }),
      close: vi.fn(),
      isMaximized: vi.fn(() => maximizedState)
    }
    // @ts-expect-error test mock
    registerWindowHandlers(() => mockWindow)
  })

  async function invoke<T>(channel: string, args?: unknown): Promise<IpcResult<T>> {
    const handler = registeredHandlers.get(channel)
    if (!handler) {
      throw new Error(`Handler not registered for channel: ${channel}`)
    }
    return (await handler(null, args)) as IpcResult<T>
  }

  it('should minimize window and return success', async () => {
    const res = await invoke<void>(IPC_CHANNELS.WINDOW.MINIMIZE)
    expect(res).toEqual({ success: true, data: undefined })
    expect(mockWindow.minimize).toHaveBeenCalledTimes(1)
  })

  it('should maximize window when not maximized, returning true', async () => {
    maximizedState = false
    const res = await invoke<boolean>(IPC_CHANNELS.WINDOW.MAXIMIZE)
    expect(res).toEqual({ success: true, data: true })
    expect(mockWindow.maximize).toHaveBeenCalledTimes(1)
    expect(mockWindow.unmaximize).not.toHaveBeenCalled()
  })

  it('should unmaximize window when already maximized, returning false', async () => {
    maximizedState = true
    const res = await invoke<boolean>(IPC_CHANNELS.WINDOW.MAXIMIZE)
    expect(res).toEqual({ success: true, data: false })
    expect(mockWindow.unmaximize).toHaveBeenCalledTimes(1)
    expect(mockWindow.maximize).not.toHaveBeenCalled()
  })

  it('should close window and return success', async () => {
    const res = await invoke<void>(IPC_CHANNELS.WINDOW.CLOSE)
    expect(res).toEqual({ success: true, data: undefined })
    expect(mockWindow.close).toHaveBeenCalledTimes(1)
  })

  it('should return window maximized status with isMaximized', async () => {
    mockWindow.isMaximized.mockReturnValue(true)
    const resTrue = await invoke<boolean>(IPC_CHANNELS.WINDOW.IS_MAXIMIZED)
    expect(resTrue).toEqual({ success: true, data: true })

    mockWindow.isMaximized.mockReturnValue(false)
    const resFalse = await invoke<boolean>(IPC_CHANNELS.WINDOW.IS_MAXIMIZED)
    expect(resFalse).toEqual({ success: true, data: false })
  })

  it('should return INTERNAL_ERROR if no active window can be resolved', async () => {
    registeredHandlers.clear()
    registerWindowHandlers(() => null)

    const res = await invoke<void>(IPC_CHANNELS.WINDOW.MINIMIZE)
    expect(res.success).toBe(false)
    if (!res.success) {
      expect(res.code).toBe(IPC_ERROR_CODES.INTERNAL_ERROR)
      expect(res.error).toContain('No hay ventana activa')
    }
  })
})

describe('Settings IPC Handlers (Feature #15: settings_page)', () => {
  let tempDir: string
  let settingsFile: string
  let settingsService: SettingsStorageService
  let mockFetch: ReturnType<typeof vi.fn>

  const invoke = async <T>(channel: string, ...args: unknown[]): Promise<IpcResult<T>> => {
    const handler = registeredHandlers.get(channel)
    if (!handler) {
      throw new Error(`Handler not found for channel: ${channel}`)
    }
    return (await handler({}, ...args)) as IpcResult<T>
  }

  beforeEach(() => {
    registeredHandlers.clear()
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'booklog-settings-test-'))
    settingsFile = path.join(tempDir, 'settings.json')
    settingsService = new SettingsStorageService(settingsFile)
    mockFetch = vi.fn()
    registerSettingsHandlers(settingsService, mockFetch as unknown as typeof fetch)
  })

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  it('settings:get returns default settings when file does not exist', async () => {
    const res = await invoke<AppSettingsDTO>(IPC_CHANNELS.SETTINGS.GET)
    expect(res).toEqual({
      success: true,
      data: {
        googleBooksApiKey: '',
        theme: 'dark'
      }
    })
  })

  it('settings:save persists settings and settings:get reads them back', async () => {
    const saveDto: SaveSettingsDTO = {
      googleBooksApiKey: 'AIzaSyTestApiKey123',
      theme: 'light'
    }

    const saveRes = await invoke<AppSettingsDTO>(IPC_CHANNELS.SETTINGS.SAVE, saveDto)
    expect(saveRes).toEqual({
      success: true,
      data: {
        googleBooksApiKey: 'AIzaSyTestApiKey123',
        theme: 'light'
      }
    })

    // Retrieve again
    const getRes = await invoke<AppSettingsDTO>(IPC_CHANNELS.SETTINGS.GET)
    expect(getRes).toEqual({
      success: true,
      data: {
        googleBooksApiKey: 'AIzaSyTestApiKey123',
        theme: 'light'
      }
    })
  })

  it('settings:save allows partial updates (only theme)', async () => {
    await invoke<AppSettingsDTO>(IPC_CHANNELS.SETTINGS.SAVE, {
      googleBooksApiKey: 'InitialKey',
      theme: 'dark'
    })

    const partialRes = await invoke<AppSettingsDTO>(IPC_CHANNELS.SETTINGS.SAVE, {
      theme: 'system'
    })

    expect(partialRes).toEqual({
      success: true,
      data: {
        googleBooksApiKey: 'InitialKey',
        theme: 'system'
      }
    })
  })

  it('settings:testApiKey returns valid true when Google Books API responds 200 OK', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ kind: 'books#volumes', totalItems: 1 })
    })

    const res = await invoke<TestApiKeyResultDTO>(IPC_CHANNELS.SETTINGS.TEST_API_KEY, {
      apiKey: 'ValidKey123'
    })

    expect(res).toEqual({
      success: true,
      data: { valid: true }
    })
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch.mock.calls[0][0]).toContain('key=ValidKey123')
  })

  it('settings:testApiKey returns error when Google Books API responds with 400/403', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request'
    })

    const res = await invoke<TestApiKeyResultDTO>(IPC_CHANNELS.SETTINGS.TEST_API_KEY, {
      apiKey: 'InvalidKey'
    })

    expect(res.success).toBe(false)
    if (!res.success) {
      expect(res.error).toBe('Clave de API inválida o cuota superada')
    }
  })

  it('settings:testApiKey fails if key is empty or whitespace', async () => {
    const res = await invoke<TestApiKeyResultDTO>(IPC_CHANNELS.SETTINGS.TEST_API_KEY, {
      apiKey: '   '
    })

    expect(res.success).toBe(false)
    if (!res.success) {
      expect(res.error).toBe('Clave de API inválida o cuota superada')
    }
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('settings:getAppInfo returns application and runtime metadata', async () => {
    const res = await invoke<AppInfoDTO>(IPC_CHANNELS.SETTINGS.GET_APP_INFO)
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.name).toBe('BookLog')
      expect(res.data.version).toBeDefined()
      expect(res.data.electronVersion).toBeDefined()
      expect(res.data.nodeVersion).toBeDefined()
      expect(res.data.chromeVersion).toBeDefined()
      expect(res.data.license).toBe('MIT')
      expect(res.data.repositoryUrl).toContain('github.com')
    }
  })
})


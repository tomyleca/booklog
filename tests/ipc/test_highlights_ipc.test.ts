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
  formatIpcError,
  IPC_ERROR_CODES,
  type HighlightPrimitives,
  type IpcResult
} from '../../src/shared/infrastructure/ipc/contracts.js'
import { HighlightNotFoundError } from '../../src/shared/application/index.js'
import {
  Book,
  BookStatus,
  Highlight,
  InvalidHighlightError,
  LocationKind
} from '../../src/shared/domain/index.js'
import type { BookRepository } from '../../src/shared/domain/ports/BookRepository.js'
import type { HighlightRepository } from '../../src/shared/domain/ports/HighlightRepository.js'
import { registerHighlightHandlers } from '../../src/main/ipc/highlightHandlers.js'

class MockBookRepository implements BookRepository {
  public books = new Map<number, Book>()

  async findAll(): Promise<Book[]> {
    return [...this.books.values()]
  }

  async findById(id: number): Promise<Book | null> {
    return this.books.get(id) ?? null
  }

  async findByStatus(status: BookStatus): Promise<Book[]> {
    return [...this.books.values()].filter((b) => b.status === status)
  }

  async create(book: Book): Promise<Book> {
    this.books.set(book.id as number, book)
    return book
  }

  async update(book: Book): Promise<Book> {
    this.books.set(book.id as number, book)
    return book
  }

  async delete(id: number): Promise<void> {
    this.books.delete(id)
  }
}

class MockHighlightRepository implements HighlightRepository {
  public highlights = new Map<number, Highlight>()
  private nextId = 1

  async findByBookId(bookId: number): Promise<Highlight[]> {
    return [...this.highlights.values()].filter((h) => h.bookId === bookId)
  }

  async findById(id: number): Promise<Highlight | null> {
    return this.highlights.get(id) ?? null
  }

  async create(highlight: Highlight): Promise<Highlight> {
    const id = this.nextId++
    const saved = Highlight.fromPrimitives({ ...highlight.toPrimitives(), id })
    this.highlights.set(id, saved)
    return saved
  }

  async delete(id: number): Promise<void> {
    this.highlights.delete(id)
  }
}

async function invoke<T>(channel: string, payload: unknown): Promise<IpcResult<T>> {
  const handler = registeredHandlers.get(channel)
  if (!handler) throw new Error(`No handler registered for ${channel}`)
  return (await handler({}, payload)) as IpcResult<T>
}

describe('Feature #22 — highlights IPC contracts', () => {
  let highlightRepo: MockHighlightRepository
  let savedId: number

  beforeEach(async () => {
    registeredHandlers.clear()
    const bookRepo = new MockBookRepository()
    highlightRepo = new MockHighlightRepository()
    await bookRepo.create(new Book({ id: 1, title: 'Ficciones', authors: 'Borges' }))
    const saved = await highlightRepo.create(
      Highlight.create({
        bookId: 1,
        content: 'El jardín de senderos que se bifurcan',
        location: { kind: LocationKind.PAGE, start: 12, end: 13 },
        capturedAt: new Date(2026, 6, 14, 22, 15, 3),
        fingerprint: 'f1'
      })
    )
    savedId = saved.id as number
    registerHighlightHandlers(bookRepo, highlightRepo)
  })

  it('should expose typed channel names', () => {
    expect(IPC_CHANNELS.HIGHLIGHTS.GET_BY_BOOK).toBe('highlights:getByBook')
    expect(IPC_CHANNELS.HIGHLIGHTS.DELETE).toBe('highlights:delete')
  })

  it('should list highlights of a book as primitives', async () => {
    const result = await invoke<HighlightPrimitives[]>(IPC_CHANNELS.HIGHLIGHTS.GET_BY_BOOK, {
      bookId: 1
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data).toHaveLength(1)
    expect(result.data[0]).toMatchObject({
      id: savedId,
      bookId: 1,
      content: 'El jardín de senderos que se bifurcan',
      location: { kind: 'PAGE', start: 12, end: 13 },
      fingerprint: 'f1'
    })
  })

  it('should return BOOK_NOT_FOUND for an unknown book', async () => {
    const result = await invoke(IPC_CHANNELS.HIGHLIGHTS.GET_BY_BOOK, { bookId: 77 })
    expect(result).toMatchObject({ success: false, code: IPC_ERROR_CODES.BOOK_NOT_FOUND })
  })

  it('should return VALIDATION_ERROR for an invalid book id', async () => {
    const result = await invoke(IPC_CHANNELS.HIGHLIGHTS.GET_BY_BOOK, { bookId: 'x' })
    expect(result).toMatchObject({ success: false, code: IPC_ERROR_CODES.VALIDATION_ERROR })
  })

  it('should delete a highlight', async () => {
    const result = await invoke<void>(IPC_CHANNELS.HIGHLIGHTS.DELETE, { id: savedId })
    expect(result.success).toBe(true)
    expect(highlightRepo.highlights.has(savedId)).toBe(false)
  })

  it('should return HIGHLIGHT_NOT_FOUND when deleting an unknown highlight', async () => {
    const result = await invoke(IPC_CHANNELS.HIGHLIGHTS.DELETE, { id: 404 })
    expect(result).toMatchObject({ success: false, code: IPC_ERROR_CODES.HIGHLIGHT_NOT_FOUND })
  })

  it('should return VALIDATION_ERROR for an invalid highlight id', async () => {
    const result = await invoke(IPC_CHANNELS.HIGHLIGHTS.DELETE, { id: Number.NaN })
    expect(result).toMatchObject({ success: false, code: IPC_ERROR_CODES.VALIDATION_ERROR })
  })

  it('should map highlight errors in formatIpcError', () => {
    expect(formatIpcError(new HighlightNotFoundError(3)).code).toBe(
      IPC_ERROR_CODES.HIGHLIGHT_NOT_FOUND
    )
    expect(formatIpcError(new InvalidHighlightError('x')).code).toBe(
      IPC_ERROR_CODES.VALIDATION_ERROR
    )
  })
})

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
  type BookPrimitives,
  type IpcResult
} from '../../src/shared/infrastructure/ipc/contracts.js'
import {
  Book,
  BookStatus,
  FutureFinishedDateError,
  InvalidFinishedDateError,
  toIsoDate,
  todayIsoDate
} from '../../src/shared/domain/index.js'
import type { BookRepository } from '../../src/shared/domain/ports/BookRepository.js'
import { registerBookHandlers } from '../../src/main/ipc/bookHandlers.js'

class MockBookRepository implements BookRepository {
  public books = new Map<number, Book>()
  private nextId = 1

  async findAll(): Promise<Book[]> {
    return [...this.books.values()]
  }

  async findById(id: number): Promise<Book | null> {
    const book = this.books.get(id)
    return book ? Book.fromPrimitives(book.toPrimitives()) : null
  }

  async findByStatus(status: BookStatus): Promise<Book[]> {
    return [...this.books.values()].filter((b) => b.status === status)
  }

  async create(book: Book): Promise<Book> {
    const id = this.nextId++
    const saved = Book.fromPrimitives({ ...book.toPrimitives(), id })
    this.books.set(id, saved)
    return saved
  }

  async update(book: Book): Promise<Book> {
    const saved = Book.fromPrimitives(book.toPrimitives())
    this.books.set(book.id as number, saved)
    return saved
  }

  async delete(id: number): Promise<void> {
    this.books.delete(id)
  }
}

function tomorrowIso(): string {
  const now = new Date()
  return toIsoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12))
}

async function invoke(channel: string, payload: unknown): Promise<IpcResult<BookPrimitives>> {
  const handler = registeredHandlers.get(channel)
  if (!handler) throw new Error(`No handler registered for ${channel}`)
  return (await handler({}, payload)) as IpcResult<BookPrimitives>
}

describe('Feature #20 — finished date IPC contracts', () => {
  let repo: MockBookRepository
  let readingId: number

  beforeEach(async () => {
    registeredHandlers.clear()
    repo = new MockBookRepository()
    registerBookHandlers(repo)
    const book = await repo.create(
      Book.create({ title: 'Martín Fierro', authors: 'José Hernández', pageCount: 100 })
    )
    readingId = book.id as number
  })

  it('should expose a dedicated channel to edit the finished date', () => {
    expect(IPC_CHANNELS.BOOKS.SET_FINISHED_DATE).toBe('books:setFinishedDate')
    expect(registeredHandlers.has(IPC_CHANNELS.BOOKS.SET_FINISHED_DATE)).toBe(true)
  })

  it('should map finished date domain errors to VALIDATION_ERROR', () => {
    expect(formatIpcError(new FutureFinishedDateError()).code).toBe(
      IPC_ERROR_CODES.VALIDATION_ERROR
    )
    expect(formatIpcError(new InvalidFinishedDateError('x')).code).toBe(
      IPC_ERROR_CODES.VALIDATION_ERROR
    )
  })

  it('should create a FINISHED book with the given finishedAt', async () => {
    const res = await invoke(IPC_CHANNELS.BOOKS.CREATE, {
      title: 'Facundo',
      authors: ['Sarmiento'],
      status: BookStatus.FINISHED,
      finishedAt: '2026-07-09'
    })
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.finishedAt).toBeInstanceOf(Date)
      expect(toIsoDate(res.data.finishedAt as Date)).toBe('2026-07-09')
    }
  })

  it('should update status to FINISHED with the given date', async () => {
    const res = await invoke(IPC_CHANNELS.BOOKS.UPDATE_STATUS, {
      id: readingId,
      status: BookStatus.FINISHED,
      finishedAt: '2026-09-30'
    })
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.status).toBe(BookStatus.FINISHED)
      expect(toIsoDate(res.data.finishedAt as Date)).toBe('2026-09-30')
    }
  })

  it('should return VALIDATION_ERROR for a future finished date on status change', async () => {
    const res = await invoke(IPC_CHANNELS.BOOKS.UPDATE_STATUS, {
      id: readingId,
      status: BookStatus.FINISHED,
      finishedAt: tomorrowIso()
    })
    expect(res.success).toBe(false)
    if (!res.success) {
      expect(res.code).toBe(IPC_ERROR_CODES.VALIDATION_ERROR)
    }
  })

  it('should auto-assign today when progress reaches 100%', async () => {
    const res = await invoke(IPC_CHANNELS.BOOKS.UPDATE_PROGRESS, {
      id: readingId,
      percentage: 100
    })
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.status).toBe(BookStatus.FINISHED)
      expect(toIsoDate(res.data.finishedAt as Date)).toBe(todayIsoDate())
    }
  })

  it('should edit the finished date through books:setFinishedDate', async () => {
    await invoke(IPC_CHANNELS.BOOKS.UPDATE_STATUS, {
      id: readingId,
      status: BookStatus.FINISHED
    })
    const res = await invoke(IPC_CHANNELS.BOOKS.SET_FINISHED_DATE, {
      id: readingId,
      finishedAt: '2026-08-15'
    })
    expect(res.success).toBe(true)
    if (res.success) {
      expect(toIsoDate(res.data.finishedAt as Date)).toBe('2026-08-15')
    }
  })

  it('should return BOOK_NOT_FOUND when editing the date of an unknown book', async () => {
    const res = await invoke(IPC_CHANNELS.BOOKS.SET_FINISHED_DATE, {
      id: 999,
      finishedAt: '2026-08-15'
    })
    expect(res.success).toBe(false)
    if (!res.success) {
      expect(res.code).toBe(IPC_ERROR_CODES.BOOK_NOT_FOUND)
    }
  })

  it('should return VALIDATION_ERROR when editing to a future or malformed date', async () => {
    await invoke(IPC_CHANNELS.BOOKS.UPDATE_STATUS, { id: readingId, status: BookStatus.FINISHED })

    const future = await invoke(IPC_CHANNELS.BOOKS.SET_FINISHED_DATE, {
      id: readingId,
      finishedAt: tomorrowIso()
    })
    const malformed = await invoke(IPC_CHANNELS.BOOKS.SET_FINISHED_DATE, {
      id: readingId,
      finishedAt: '15/08/2026'
    })
    expect(future.success).toBe(false)
    expect(malformed.success).toBe(false)
    if (!future.success && !malformed.success) {
      expect(future.code).toBe(IPC_ERROR_CODES.VALIDATION_ERROR)
      expect(malformed.code).toBe(IPC_ERROR_CODES.VALIDATION_ERROR)
    }
  })
})

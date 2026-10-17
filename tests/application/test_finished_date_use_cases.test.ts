import { describe, it, expect, beforeEach } from 'vitest'
import {
  Book,
  BookStatus,
  FutureFinishedDateError,
  InvalidFinishedDateError,
  toIsoDate,
  todayIsoDate
} from '../../src/shared/domain/index.js'
import type { BookRepository } from '../../src/shared/domain/ports/BookRepository.js'
import {
  AddBook,
  BookNotFoundError,
  SetFinishedDate,
  UpdateBookProgress,
  UpdateBookStatus
} from '../../src/shared/application/index.js'

class InMemoryBookRepository implements BookRepository {
  public books = new Map<number, Book>()
  public updateCalls = 0
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
    this.updateCalls++
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

describe('Feature #20 — finished date use cases', () => {
  let repo: InMemoryBookRepository

  beforeEach(() => {
    repo = new InMemoryBookRepository()
  })

  async function seedReadingBook(): Promise<Book> {
    return repo.create(
      Book.create({
        title: 'El túnel',
        authors: 'Ernesto Sabato',
        pageCount: 160,
        currentPage: 40,
        status: BookStatus.READING
      })
    )
  }

  describe('AddBook', () => {
    it('should store the given finished date when adding a FINISHED book', async () => {
      const book = await new AddBook(repo).execute({
        title: 'Sobre héroes y tumbas',
        authors: 'Ernesto Sabato',
        status: BookStatus.FINISHED,
        finishedAt: '2026-03-05'
      })
      expect(toIsoDate(book.finishedAt as Date)).toBe('2026-03-05')
    })

    it('should default to today when adding a FINISHED book without date', async () => {
      const book = await new AddBook(repo).execute({
        title: 'Sobre héroes y tumbas',
        authors: 'Ernesto Sabato',
        status: BookStatus.FINISHED
      })
      expect(toIsoDate(book.finishedAt as Date)).toBe(todayIsoDate())
    })

    it('should reject a future finished date', async () => {
      await expect(
        new AddBook(repo).execute({
          title: 'Sobre héroes y tumbas',
          authors: 'Ernesto Sabato',
          status: BookStatus.FINISHED,
          finishedAt: tomorrowIso()
        })
      ).rejects.toThrow(FutureFinishedDateError)
      expect(repo.books.size).toBe(0)
    })

    it('should reject a malformed finished date', async () => {
      await expect(
        new AddBook(repo).execute({
          title: 'Sobre héroes y tumbas',
          authors: 'Ernesto Sabato',
          status: BookStatus.FINISHED,
          finishedAt: '05/03/2026'
        })
      ).rejects.toThrow(InvalidFinishedDateError)
    })
  })

  describe('UpdateBookStatus', () => {
    it('should set the given finished date when marking as FINISHED', async () => {
      const seeded = await seedReadingBook()
      const book = await new UpdateBookStatus(repo).execute({
        id: seeded.id as number,
        status: BookStatus.FINISHED,
        finishedAt: '2026-10-01'
      })
      expect(book.status).toBe(BookStatus.FINISHED)
      expect(toIsoDate(book.finishedAt as Date)).toBe('2026-10-01')
    })

    it('should default to today when marking as FINISHED without date', async () => {
      const seeded = await seedReadingBook()
      const book = await new UpdateBookStatus(repo).execute({
        id: seeded.id as number,
        status: BookStatus.FINISHED
      })
      expect(toIsoDate(book.finishedAt as Date)).toBe(todayIsoDate())
    })

    it('should preserve the date when leaving FINISHED and overwrite it when re-finishing', async () => {
      const seeded = await seedReadingBook()
      const id = seeded.id as number
      const useCase = new UpdateBookStatus(repo)

      await useCase.execute({ id, status: BookStatus.FINISHED, finishedAt: '2026-01-10' })
      const reopened = await useCase.execute({ id, status: BookStatus.READING })
      expect(toIsoDate(reopened.finishedAt as Date)).toBe('2026-01-10')

      const refinished = await useCase.execute({
        id,
        status: BookStatus.FINISHED,
        finishedAt: '2026-02-20'
      })
      expect(toIsoDate(refinished.finishedAt as Date)).toBe('2026-02-20')
    })

    it('should reject a future finished date without persisting', async () => {
      const seeded = await seedReadingBook()
      await expect(
        new UpdateBookStatus(repo).execute({
          id: seeded.id as number,
          status: BookStatus.FINISHED,
          finishedAt: tomorrowIso()
        })
      ).rejects.toThrow(FutureFinishedDateError)
      expect(repo.updateCalls).toBe(0)
    })
  })

  describe('UpdateBookProgress', () => {
    it('should assign today without asking when progress reaches 100%', async () => {
      const seeded = await seedReadingBook()
      const book = await new UpdateBookProgress(repo).execute({
        id: seeded.id as number,
        page: 160
      })
      expect(book.status).toBe(BookStatus.FINISHED)
      expect(toIsoDate(book.finishedAt as Date)).toBe(todayIsoDate())
    })

    it('should not touch finishedAt when progress stays below 100%', async () => {
      const seeded = await seedReadingBook()
      const book = await new UpdateBookProgress(repo).execute({
        id: seeded.id as number,
        page: 100
      })
      expect(book.finishedAt).toBeNull()
    })
  })

  describe('SetFinishedDate', () => {
    it('should edit the finished date of a finished book', async () => {
      const seeded = await seedReadingBook()
      const id = seeded.id as number
      await new UpdateBookStatus(repo).execute({ id, status: BookStatus.FINISHED })

      const book = await new SetFinishedDate(repo).execute({ id, finishedAt: '2025-12-24' })
      expect(toIsoDate(book.finishedAt as Date)).toBe('2025-12-24')
    })

    it('should throw BookNotFoundError for unknown books', async () => {
      await expect(
        new SetFinishedDate(repo).execute({ id: 999, finishedAt: '2025-12-24' })
      ).rejects.toThrow(BookNotFoundError)
    })

    it('should reject future dates', async () => {
      const seeded = await seedReadingBook()
      const id = seeded.id as number
      await new UpdateBookStatus(repo).execute({ id, status: BookStatus.FINISHED })
      const callsBefore = repo.updateCalls

      await expect(
        new SetFinishedDate(repo).execute({ id, finishedAt: tomorrowIso() })
      ).rejects.toThrow(FutureFinishedDateError)
      expect(repo.updateCalls).toBe(callsBefore)
    })

    it('should reject editing the date of a book that is not finished', async () => {
      const seeded = await seedReadingBook()
      await expect(
        new SetFinishedDate(repo).execute({ id: seeded.id as number, finishedAt: '2025-12-24' })
      ).rejects.toThrow(InvalidFinishedDateError)
    })
  })
})

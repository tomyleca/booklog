import { describe, it, expect, beforeEach } from 'vitest'
import {
  BookNotFoundError,
  DeleteHighlight,
  GetBookHighlights,
  HighlightNotFoundError
} from '../../src/shared/application/index.js'
import { Book, BookStatus, Highlight } from '../../src/shared/domain/index.js'
import type { BookRepository } from '../../src/shared/domain/ports/BookRepository.js'
import type { HighlightRepository } from '../../src/shared/domain/ports/HighlightRepository.js'

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
  public deletedIds: number[] = []
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
    this.deletedIds.push(id)
    this.highlights.delete(id)
  }
}

function highlightFor(bookId: number, fingerprint: string): Highlight {
  return Highlight.create({
    bookId,
    content: `Subrayado ${fingerprint}`,
    location: { page: { start: 10 } },
    fingerprint
  })
}

describe('Feature #22 — highlight use cases', () => {
  let bookRepository: MockBookRepository
  let highlightRepository: MockHighlightRepository

  beforeEach(async () => {
    bookRepository = new MockBookRepository()
    highlightRepository = new MockHighlightRepository()
    await bookRepository.create(new Book({ id: 1, title: 'Ficciones', authors: 'Borges' }))
    await bookRepository.create(new Book({ id: 2, title: 'Moby-Dick', authors: 'Melville' }))
  })

  describe('GetBookHighlights', () => {
    it('should return only the highlights of the requested book', async () => {
      await highlightRepository.create(highlightFor(1, 'a'))
      await highlightRepository.create(highlightFor(1, 'b'))
      await highlightRepository.create(highlightFor(2, 'c'))

      const useCase = new GetBookHighlights(bookRepository, highlightRepository)
      const result = await useCase.execute({ bookId: 1 })

      expect(result.map((h) => h.fingerprint)).toEqual(['a', 'b'])
    })

    it('should return an empty list when the book has no highlights', async () => {
      const useCase = new GetBookHighlights(bookRepository, highlightRepository)
      expect(await useCase.execute({ bookId: 2 })).toEqual([])
    })

    it('should throw BookNotFoundError when the book does not exist', async () => {
      const useCase = new GetBookHighlights(bookRepository, highlightRepository)
      await expect(useCase.execute({ bookId: 99 })).rejects.toThrow(BookNotFoundError)
    })
  })

  describe('DeleteHighlight', () => {
    it('should delete an existing highlight', async () => {
      const saved = await highlightRepository.create(highlightFor(1, 'a'))

      const useCase = new DeleteHighlight(highlightRepository)
      await useCase.execute({ id: saved.id as number })

      expect(highlightRepository.deletedIds).toEqual([saved.id])
      expect(await highlightRepository.findById(saved.id as number)).toBeNull()
    })

    it('should throw HighlightNotFoundError when the highlight does not exist', async () => {
      const useCase = new DeleteHighlight(highlightRepository)
      await expect(useCase.execute({ id: 404 })).rejects.toThrow(HighlightNotFoundError)
      expect(highlightRepository.deletedIds).toEqual([])
    })
  })
})

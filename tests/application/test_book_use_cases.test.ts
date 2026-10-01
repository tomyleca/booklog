import { describe, it, expect, beforeEach } from 'vitest'
import {
  AddBook,
  ListBooks,
  UpdateBookStatus,
  UpdateBookProgress,
  RateBook,
  DeleteBook,
  GetBookById,
  BookNotFoundError
} from '../../src/shared/application/index.js'
import {
  Book,
  BookStatus,
  InvalidBookError,
  InvalidProgressError
} from '../../src/shared/domain/index.js'
import type { BookRepository } from '../../src/shared/domain/ports/BookRepository.js'

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

describe('Book Application Use Cases', () => {
  let repository: MockBookRepository

  beforeEach(() => {
    repository = new MockBookRepository()
  })

  describe('AddBook', () => {
    it('should create and persist a book with minimal required data', async () => {
      const useCase = new AddBook(repository)
      const book = await useCase.execute({
        title: 'Clean Code',
        authors: 'Robert C. Martin'
      })

      expect(book.id).toBeDefined()
      expect(book.title).toBe('Clean Code')
      expect(book.authors).toBe('Robert C. Martin')
      expect(book.status).toBe(BookStatus.TO_READ)
      expect(book.currentPage).toBeNull()
      expect(book.progressPercentage).toBeNull()

      const stored = await repository.findById(book.id!)
      expect(stored).not.toBeNull()
      expect(stored?.title).toBe('Clean Code')
    })

    it('should create and persist a book with full details', async () => {
      const useCase = new AddBook(repository)
      const book = await useCase.execute({
        title: 'Refactoring',
        authors: 'Martin Fowler',
        pageCount: 448,
        isbn: '9780201485677',
        status: BookStatus.READING,
        currentPage: 50,
        rating: 5,
        googleBooksId: 'gbook-123',
        coverUrl: 'https://example.com/cover.jpg',
        coverPath: '/local/covers/cover.jpg'
      })

      expect(book.id).toBeDefined()
      expect(book.title).toBe('Refactoring')
      expect(book.authors).toBe('Martin Fowler')
      expect(book.pageCount).toBe(448)
      expect(book.isbn).toBe('9780201485677')
      expect(book.status).toBe(BookStatus.READING)
      expect(book.currentPage).toBe(50)
      expect(book.progressPercentage).toBe(11) // Math.round(50 / 448 * 100) = 11%
      expect(book.rating).toBe(5)
      expect(book.googleBooksId).toBe('gbook-123')
      expect(book.coverUrl).toBe('https://example.com/cover.jpg')
      expect(book.coverPath).toBe('/local/covers/cover.jpg')
    })

    it('should reject creation when title is empty', async () => {
      const useCase = new AddBook(repository)
      await expect(
        useCase.execute({
          title: '   ',
          authors: 'Martin Fowler'
        })
      ).rejects.toThrow(InvalidBookError)
    })

    it('should reject creation when authors is empty', async () => {
      const useCase = new AddBook(repository)
      await expect(
        useCase.execute({
          title: 'Refactoring',
          authors: '   '
        })
      ).rejects.toThrow(InvalidBookError)
    })

    it('should reject creation when rating is out of bounds', async () => {
      const useCase = new AddBook(repository)
      await expect(
        useCase.execute({
          title: 'Refactoring',
          authors: 'Martin Fowler',
          rating: 6
        })
      ).rejects.toThrow(InvalidBookError)
    })
  })

  describe('ListBooks', () => {
    beforeEach(async () => {
      const addBook = new AddBook(repository)
      await addBook.execute({
        title: 'Book A',
        authors: 'Author A',
        status: BookStatus.TO_READ
      })
      await addBook.execute({
        title: 'Book B',
        authors: 'Author B',
        status: BookStatus.READING
      })
      await addBook.execute({
        title: 'Book C',
        authors: 'Author C',
        status: BookStatus.READING
      })
      await addBook.execute({
        title: 'Book D',
        authors: 'Author D',
        status: BookStatus.PAUSED
      })
      await addBook.execute({
        title: 'Book E',
        authors: 'Author E',
        status: BookStatus.FINISHED
      })
    })

    it('should return all books when no filter is provided', async () => {
      const useCase = new ListBooks(repository)
      const books = await useCase.execute()
      expect(books).toHaveLength(5)
    })

    it('should return all books when empty DTO is provided', async () => {
      const useCase = new ListBooks(repository)
      const books = await useCase.execute({})
      expect(books).toHaveLength(5)
    })

    it('should filter books by READING status', async () => {
      const useCase = new ListBooks(repository)
      const books = await useCase.execute({ status: BookStatus.READING })
      expect(books).toHaveLength(2)
      expect(books.every((b) => b.status === BookStatus.READING)).toBe(true)
    })

    it('should filter books by PAUSED status', async () => {
      const useCase = new ListBooks(repository)
      const books = await useCase.execute({ status: BookStatus.PAUSED })
      expect(books).toHaveLength(1)
      expect(books[0]?.title).toBe('Book D')
    })

    it('should filter books by FINISHED status', async () => {
      const useCase = new ListBooks(repository)
      const books = await useCase.execute({ status: BookStatus.FINISHED })
      expect(books).toHaveLength(1)
      expect(books[0]?.title).toBe('Book E')
    })

    it('should return empty list when no books match status', async () => {
      const useCase = new ListBooks(repository)
      const books = await useCase.execute({ status: BookStatus.ABANDONED })
      expect(books).toHaveLength(0)
    })
  })

  describe('UpdateBookStatus', () => {
    it('should update status successfully', async () => {
      const addBook = new AddBook(repository)
      const created = await addBook.execute({
        title: 'The Pragmatic Programmer',
        authors: 'Andy Hunt',
        status: BookStatus.TO_READ
      })

      const useCase = new UpdateBookStatus(repository)
      const updated = await useCase.execute({
        id: created.id!,
        status: BookStatus.READING
      })

      expect(updated.status).toBe(BookStatus.READING)
      const stored = await repository.findById(created.id!)
      expect(stored?.status).toBe(BookStatus.READING)
    })

    it('should automatically set progress to 100% when manually transitioning to FINISHED', async () => {
      const addBook = new AddBook(repository)
      const created = await addBook.execute({
        title: 'The Pragmatic Programmer',
        authors: 'Andy Hunt',
        pageCount: 350,
        currentPage: 100,
        status: BookStatus.READING
      })

      const useCase = new UpdateBookStatus(repository)
      const updated = await useCase.execute({
        id: created.id!,
        status: BookStatus.FINISHED
      })

      expect(updated.status).toBe(BookStatus.FINISHED)
      expect(updated.currentPage).toBe(350)
      expect(updated.progressPercentage).toBe(100)
    })

    it('should throw BookNotFoundError when book does not exist', async () => {
      const useCase = new UpdateBookStatus(repository)
      await expect(
        useCase.execute({
          id: 9999,
          status: BookStatus.READING
        })
      ).rejects.toThrow(BookNotFoundError)

      try {
        await useCase.execute({ id: 9999, status: BookStatus.READING })
      } catch (error) {
        expect(error).toBeInstanceOf(BookNotFoundError)
        expect((error as BookNotFoundError).bookId).toBe(9999)
      }
    })

    it('should throw InvalidBookError for invalid status value', async () => {
      const addBook = new AddBook(repository)
      const created = await addBook.execute({
        title: 'The Pragmatic Programmer',
        authors: 'Andy Hunt'
      })

      const useCase = new UpdateBookStatus(repository)
      await expect(
        useCase.execute({
          id: created.id!,
          // @ts-expect-error testing runtime validation
          status: 'NOT_A_VALID_STATUS'
        })
      ).rejects.toThrow(InvalidBookError)
    })
  })

  describe('UpdateBookProgress', () => {
    it('should update progress by page and calculate percentage', async () => {
      const addBook = new AddBook(repository)
      const created = await addBook.execute({
        title: 'Domain-Driven Design',
        authors: 'Eric Evans',
        pageCount: 500,
        status: BookStatus.READING
      })

      const useCase = new UpdateBookProgress(repository)
      const updated = await useCase.execute({
        id: created.id!,
        page: 250
      })

      expect(updated.currentPage).toBe(250)
      expect(updated.progressPercentage).toBe(50)
      expect(updated.status).toBe(BookStatus.READING)
    })

    it('should update progress by percentage and calculate page when pageCount exists', async () => {
      const addBook = new AddBook(repository)
      const created = await addBook.execute({
        title: 'Domain-Driven Design',
        authors: 'Eric Evans',
        pageCount: 400,
        status: BookStatus.READING
      })

      const useCase = new UpdateBookProgress(repository)
      const updated = await useCase.execute({
        id: created.id!,
        percentage: 75
      })

      expect(updated.progressPercentage).toBe(75)
      expect(updated.currentPage).toBe(300) // 75% of 400
      expect(updated.status).toBe(BookStatus.READING)
    })

    it('should update progress by percentage without pageCount', async () => {
      const addBook = new AddBook(repository)
      const created = await addBook.execute({
        title: 'Audiobook or Ebook without pages',
        authors: 'Author',
        status: BookStatus.READING
      })

      const useCase = new UpdateBookProgress(repository)
      const updated = await useCase.execute({
        id: created.id!,
        percentage: 42
      })

      expect(updated.progressPercentage).toBe(42)
      expect(updated.currentPage).toBeNull()
      expect(updated.status).toBe(BookStatus.READING)
    })

    it('should automatically transition to FINISHED when progress reaches 100% via percentage', async () => {
      const addBook = new AddBook(repository)
      const created = await addBook.execute({
        title: 'Domain-Driven Design',
        authors: 'Eric Evans',
        pageCount: 400,
        status: BookStatus.READING
      })

      const useCase = new UpdateBookProgress(repository)
      const updated = await useCase.execute({
        id: created.id!,
        percentage: 100
      })

      expect(updated.status).toBe(BookStatus.FINISHED)
      expect(updated.progressPercentage).toBe(100)
      expect(updated.currentPage).toBe(400)
    })

    it('should automatically transition to FINISHED when currentPage reaches pageCount', async () => {
      const addBook = new AddBook(repository)
      const created = await addBook.execute({
        title: 'Domain-Driven Design',
        authors: 'Eric Evans',
        pageCount: 300,
        status: BookStatus.READING
      })

      const useCase = new UpdateBookProgress(repository)
      const updated = await useCase.execute({
        id: created.id!,
        page: 300
      })

      expect(updated.status).toBe(BookStatus.FINISHED)
      expect(updated.currentPage).toBe(300)
      expect(updated.progressPercentage).toBe(100)
    })

    it('should automatically transition to FINISHED when percentage reaches 100% on a book without pageCount', async () => {
      const addBook = new AddBook(repository)
      const created = await addBook.execute({
        title: 'Ebook without page count',
        authors: 'Unknown',
        status: BookStatus.READING
      })

      const useCase = new UpdateBookProgress(repository)
      const updated = await useCase.execute({
        id: created.id!,
        percentage: 100
      })

      expect(updated.status).toBe(BookStatus.FINISHED)
      expect(updated.progressPercentage).toBe(100)
    })

    it('should throw BookNotFoundError when book is not found', async () => {
      const useCase = new UpdateBookProgress(repository)
      await expect(
        useCase.execute({
          id: 9999,
          page: 50
        })
      ).rejects.toThrow(BookNotFoundError)
    })

    it('should throw InvalidProgressError when neither page nor percentage is provided', async () => {
      const addBook = new AddBook(repository)
      const created = await addBook.execute({
        title: 'Domain-Driven Design',
        authors: 'Eric Evans',
        pageCount: 300
      })

      const useCase = new UpdateBookProgress(repository)
      await expect(
        useCase.execute({
          id: created.id!
        })
      ).rejects.toThrow(InvalidProgressError)
    })

    it('should throw InvalidProgressError when page exceeds pageCount', async () => {
      const addBook = new AddBook(repository)
      const created = await addBook.execute({
        title: 'Domain-Driven Design',
        authors: 'Eric Evans',
        pageCount: 300
      })

      const useCase = new UpdateBookProgress(repository)
      await expect(
        useCase.execute({
          id: created.id!,
          page: 301
        })
      ).rejects.toThrow(InvalidProgressError)
    })

    it('should throw InvalidProgressError when percentage is out of [0, 100] range', async () => {
      const addBook = new AddBook(repository)
      const created = await addBook.execute({
        title: 'Domain-Driven Design',
        authors: 'Eric Evans'
      })

      const useCase = new UpdateBookProgress(repository)
      await expect(
        useCase.execute({
          id: created.id!,
          percentage: 105
        })
      ).rejects.toThrow(InvalidProgressError)

      await expect(
        useCase.execute({
          id: created.id!,
          percentage: -5
        })
      ).rejects.toThrow(InvalidProgressError)
    })
  })

  describe('RateBook', () => {
    it('should rate a book successfully with values 1 to 5', async () => {
      const addBook = new AddBook(repository)
      const created = await addBook.execute({
        title: 'Test-Driven Development',
        authors: 'Kent Beck'
      })

      const useCase = new RateBook(repository)

      for (let rating = 1; rating <= 5; rating++) {
        const updated = await useCase.execute({
          id: created.id!,
          rating
        })
        expect(updated.rating).toBe(rating)
      }
    })

    it('should remove rating when passing undefined or null', async () => {
      const addBook = new AddBook(repository)
      const created = await addBook.execute({
        title: 'Test-Driven Development',
        authors: 'Kent Beck',
        rating: 4
      })

      expect(created.rating).toBe(4)

      const useCase = new RateBook(repository)
      const withoutRatingNull = await useCase.execute({
        id: created.id!,
        rating: null
      })
      expect(withoutRatingNull.rating).toBeNull()

      // Reset to 3 and then remove with undefined
      await useCase.execute({ id: created.id!, rating: 3 })
      const withoutRatingUndefined = await useCase.execute({
        id: created.id!,
        rating: undefined
      })
      expect(withoutRatingUndefined.rating).toBeNull()
    })

    it('should reject rating values outside 1-5', async () => {
      const addBook = new AddBook(repository)
      const created = await addBook.execute({
        title: 'Test-Driven Development',
        authors: 'Kent Beck'
      })

      const useCase = new RateBook(repository)
      await expect(useCase.execute({ id: created.id!, rating: 0 })).rejects.toThrow(
        InvalidBookError
      )
      await expect(useCase.execute({ id: created.id!, rating: 6 })).rejects.toThrow(
        InvalidBookError
      )
      await expect(useCase.execute({ id: created.id!, rating: 3.5 })).rejects.toThrow(
        InvalidBookError
      )
    })

    it('should throw BookNotFoundError when book does not exist', async () => {
      const useCase = new RateBook(repository)
      await expect(useCase.execute({ id: 8888, rating: 5 })).rejects.toThrow(BookNotFoundError)
    })
  })

  describe('DeleteBook', () => {
    it('should delete an existing book', async () => {
      const addBook = new AddBook(repository)
      const created = await addBook.execute({
        title: 'Design Patterns',
        authors: 'GoF'
      })

      const deleteUseCase = new DeleteBook(repository)
      await deleteUseCase.execute({ id: created.id! })

      const found = await repository.findById(created.id!)
      expect(found).toBeNull()
    })

    it('should throw BookNotFoundError when attempting to delete non-existent book', async () => {
      const deleteUseCase = new DeleteBook(repository)
      await expect(deleteUseCase.execute({ id: 9999 })).rejects.toThrow(BookNotFoundError)
    })
  })

  describe('GetBookById', () => {
    it('should retrieve book by id successfully', async () => {
      const addBook = new AddBook(repository)
      const created = await addBook.execute({
        title: 'Building Microservices',
        authors: 'Sam Newman'
      })

      const useCase = new GetBookById(repository)
      const retrieved = await useCase.execute({ id: created.id! })

      expect(retrieved.id).toBe(created.id)
      expect(retrieved.title).toBe('Building Microservices')
    })

    it('should throw BookNotFoundError when book does not exist', async () => {
      const useCase = new GetBookById(repository)
      await expect(useCase.execute({ id: 7777 })).rejects.toThrow(BookNotFoundError)
    })
  })
})

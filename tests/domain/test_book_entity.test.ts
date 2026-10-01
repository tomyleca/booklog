import { describe, it, expect } from 'vitest'
import {
  Book,
  BookStatus,
  InvalidBookError,
  InvalidProgressError,
  Note
} from '../../src/shared/domain/index.js'

describe('Book Domain Entity', () => {
  describe('Invariants and Validations', () => {
    it('should create a valid book with minimum required fields', () => {
      const book = Book.create({
        title: 'Clean Code',
        authors: 'Robert C. Martin'
      })

      expect(book.title).toBe('Clean Code')
      expect(book.authors).toBe('Robert C. Martin')
      expect(book.status).toBe(BookStatus.TO_READ)
      expect(book.currentPage).toBeNull()
      expect(book.progressPercentage).toBeNull()
      expect(book.pageCount).toBeNull()
      expect(book.rating).toBeNull()
      expect(book.notes).toEqual([])
      expect(book.createdAt).toBeInstanceOf(Date)
      expect(book.updatedAt).toBeInstanceOf(Date)
    })

    it('should reject empty or whitespace-only title', () => {
      expect(() => {
        Book.create({
          title: '   ',
          authors: 'Robert C. Martin'
        })
      }).toThrow(InvalidBookError)
    })

    it('should reject empty or whitespace-only authors', () => {
      expect(() => {
        Book.create({
          title: 'Clean Code',
          authors: '   '
        })
      }).toThrow(InvalidBookError)
    })

    it('should reject invalid book status', () => {
      expect(() => {
        new Book({
          title: 'Clean Code',
          authors: 'Robert C. Martin',
          // @ts-expect-error testing invalid runtime status
          status: 'INVALID_STATUS'
        })
      }).toThrow(InvalidBookError)
    })

    it('should validate rating between 1 and 5', () => {
      expect(() => {
        Book.create({
          title: 'Clean Code',
          authors: 'Robert C. Martin',
          rating: 0
        })
      }).toThrow(InvalidBookError)

      expect(() => {
        Book.create({
          title: 'Clean Code',
          authors: 'Robert C. Martin',
          rating: 6
        })
      }).toThrow(InvalidBookError)

      expect(() => {
        Book.create({
          title: 'Clean Code',
          authors: 'Robert C. Martin',
          rating: 3.5
        })
      }).toThrow(InvalidBookError)

      const book = Book.create({
        title: 'Clean Code',
        authors: 'Robert C. Martin',
        rating: 5
      })
      expect(book.rating).toBe(5)

      book.updateRating(4)
      expect(book.rating).toBe(4)

      book.updateRating(null)
      expect(book.rating).toBeNull()
    })

    it('should validate pageCount must be an integer >= 1', () => {
      expect(() => {
        Book.create({
          title: 'Clean Code',
          authors: 'Robert C. Martin',
          pageCount: 0
        })
      }).toThrow(InvalidProgressError)

      expect(() => {
        Book.create({
          title: 'Clean Code',
          authors: 'Robert C. Martin',
          pageCount: -10
        })
      }).toThrow(InvalidProgressError)

      expect(() => {
        Book.create({
          title: 'Clean Code',
          authors: 'Robert C. Martin',
          pageCount: 12.5
        })
      }).toThrow(InvalidProgressError)
    })
  })

  describe('Bidirectional Progress Synchronization', () => {
    it('should calculate progressPercentage when updating by page with pageCount', () => {
      const book = Book.create({
        title: 'Domain-Driven Design',
        authors: 'Eric Evans',
        pageCount: 500,
        status: BookStatus.READING
      })

      book.updateProgressByPage(250)
      expect(book.currentPage).toBe(250)
      expect(book.progressPercentage).toBe(50)

      book.updateProgressByPage(167)
      expect(book.currentPage).toBe(167)
      expect(book.progressPercentage).toBe(33) // Math.round((167 / 500) * 100) = 33
    })

    it('should reject currentPage < 0 or > pageCount', () => {
      const book = Book.create({
        title: 'Domain-Driven Design',
        authors: 'Eric Evans',
        pageCount: 300
      })

      expect(() => {
        book.updateProgressByPage(-1)
      }).toThrow(InvalidProgressError)

      expect(() => {
        book.updateProgressByPage(301)
      }).toThrow(InvalidProgressError)

      expect(() => {
        book.updateProgressByPage(15.5)
      }).toThrow(InvalidProgressError)
    })

    it('should calculate currentPage when updating by percentage with pageCount', () => {
      const book = Book.create({
        title: 'The Pragmatic Programmer',
        authors: 'David Thomas, Andrew Hunt',
        pageCount: 352,
        status: BookStatus.READING
      })

      book.updateProgressByPercentage(50)
      expect(book.progressPercentage).toBe(50)
      expect(book.currentPage).toBe(176) // Math.round((50 / 100) * 352) = 176

      book.updateProgressByPercentage(25)
      expect(book.progressPercentage).toBe(25)
      expect(book.currentPage).toBe(88) // Math.round((25 / 100) * 352) = 88
    })

    it('should reject progressPercentage < 0 or > 100', () => {
      const book = Book.create({
        title: 'Refactoring',
        authors: 'Martin Fowler',
        pageCount: 400
      })

      expect(() => {
        book.updateProgressByPercentage(-5)
      }).toThrow(InvalidProgressError)

      expect(() => {
        book.updateProgressByPercentage(101)
      }).toThrow(InvalidProgressError)
    })

    it('should handle books without pageCount without crashing', () => {
      const book = Book.create({
        title: 'Audiobook or Pamphlet',
        authors: 'Unknown'
      })

      book.updateProgressByPercentage(40)
      expect(book.progressPercentage).toBe(40)
      expect(book.currentPage).toBeNull()

      book.updateProgressByPage(15)
      expect(book.currentPage).toBe(15)
      expect(book.progressPercentage).toBe(40)
    })
  })

  describe('Status Transitions', () => {
    it('should automatically set progressPercentage = 100 and currentPage = pageCount when transitioning to FINISHED', () => {
      const book = Book.create({
        title: 'Clean Architecture',
        authors: 'Robert C. Martin',
        pageCount: 300,
        currentPage: 50,
        status: BookStatus.READING
      })

      expect(book.currentPage).toBe(50)
      expect(book.progressPercentage).toBe(17)

      book.updateStatus(BookStatus.FINISHED)

      expect(book.status).toBe(BookStatus.FINISHED)
      expect(book.progressPercentage).toBe(100)
      expect(book.currentPage).toBe(300)
    })

    it('should set progressPercentage = 100 on FINISHED even without pageCount', () => {
      const book = Book.create({
        title: 'Uncounted Book',
        authors: 'Some Author',
        status: BookStatus.READING
      })

      book.updateStatus(BookStatus.FINISHED)

      expect(book.status).toBe(BookStatus.FINISHED)
      expect(book.progressPercentage).toBe(100)
      expect(book.currentPage).toBeNull()
    })

    it('should preserve existing progress and page when transitioning to TO_READ', () => {
      const book = Book.create({
        title: 'Structure and Interpretation of Computer Programs',
        authors: 'Harold Abelson, Gerald Jay Sussman',
        pageCount: 600,
        currentPage: 150,
        status: BookStatus.READING
      })

      expect(book.currentPage).toBe(150)
      expect(book.progressPercentage).toBe(25)

      // Transition to TO_READ
      book.updateStatus(BookStatus.TO_READ)

      expect(book.status).toBe(BookStatus.TO_READ)
      expect(book.currentPage).toBe(150)
      expect(book.progressPercentage).toBe(25)
    })

    it('should preserve progress when transitioning between PAUSED and READING', () => {
      const book = Book.create({
        title: 'Design Patterns',
        authors: 'Gang of Four',
        pageCount: 400,
        currentPage: 200,
        status: BookStatus.READING
      })

      book.updateStatus(BookStatus.PAUSED)
      expect(book.status).toBe(BookStatus.PAUSED)
      expect(book.currentPage).toBe(200)
      expect(book.progressPercentage).toBe(50)

      book.updateStatus(BookStatus.READING)
      expect(book.status).toBe(BookStatus.READING)
      expect(book.currentPage).toBe(200)
      expect(book.progressPercentage).toBe(50)
    })
  })

  describe('Notes Management', () => {
    it('should add notes and update notes array', () => {
      const book = Book.create({
        title: 'Clean Architecture',
        authors: 'Robert C. Martin'
      })

      const note1 = Note.create({ bookId: 1, content: 'Nota 1', page: 10 })
      const note2 = Note.create({ bookId: 1, content: 'Nota 2', page: 25 })

      book.addNote(note1)
      expect(book.notes).toHaveLength(1)
      expect(book.notes[0]?.content).toBe('Nota 1')

      book.updateNotes([note1, note2])
      expect(book.notes).toHaveLength(2)
      expect(book.notes[1]?.content).toBe('Nota 2')
    })
  })

  describe('Serialization to and from Primitives', () => {
    it('should serialize to primitives and reconstruct from primitives accurately', () => {
      const createdAt = new Date('2026-01-01T10:00:00Z')
      const updatedAt = new Date('2026-01-02T12:00:00Z')

      const originalBook = new Book({
        id: 42,
        googleBooksId: 'gbook-xyz',
        title: 'Test-Driven Development',
        authors: 'Kent Beck',
        coverUrl: 'https://example.com/cover.png',
        coverPath: 'C:\\covers\\tdd.png',
        pageCount: 220,
        currentPage: 110,
        progressPercentage: 50,
        isbn: '978-0321146533',
        status: BookStatus.READING,
        rating: 5,
        createdAt,
        updatedAt,
        notes: [
          new Note({
            id: 1,
            bookId: 42,
            content: 'Red, Green, Refactor cycle.',
            createdAt,
            updatedAt
          })
        ]
      })

      const primitives = originalBook.toPrimitives()
      expect(primitives).toEqual({
        id: 42,
        googleBooksId: 'gbook-xyz',
        title: 'Test-Driven Development',
        authors: 'Kent Beck',
        coverUrl: 'https://example.com/cover.png',
        coverPath: 'C:\\covers\\tdd.png',
        pageCount: 220,
        currentPage: 110,
        progressPercentage: 50,
        isbn: '978-0321146533',
        status: BookStatus.READING,
        rating: 5,
        createdAt,
        updatedAt,
        notes: [
          {
            id: 1,
            bookId: 42,
            content: 'Red, Green, Refactor cycle.',
            createdAt,
            updatedAt
          }
        ]
      })

      const reconstructedBook = Book.fromPrimitives(primitives)
      expect(reconstructedBook).toBeInstanceOf(Book)
      expect(reconstructedBook.id).toBe(42)
      expect(reconstructedBook.title).toBe('Test-Driven Development')
      expect(reconstructedBook.notes).toHaveLength(1)
      expect(reconstructedBook.notes[0]).toBeInstanceOf(Note)
      expect(reconstructedBook.notes[0]?.content).toBe('Red, Green, Refactor cycle.')
    })
  })
})

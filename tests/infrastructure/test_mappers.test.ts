import { describe, it, expect } from 'vitest'
import { Book as PrismaBook, Note as PrismaNote, BookStatus as PrismaBookStatus } from '@prisma/client'
import { Book, BookStatus, Note } from '../../src/shared/domain/index.js'
import { BookMapper, NoteMapper } from '../../src/shared/infrastructure/persistence/index.js'

describe('Persistence Mappers', () => {
  describe('BookMapper', () => {
    it('should map a PrismaBook with JSON array authors to a domain Book entity', () => {
      const now = new Date()
      const raw: PrismaBook = {
        id: 1,
        googleBooksId: 'gbook-123',
        title: 'Clean Architecture',
        authors: JSON.stringify(['Robert C. Martin']),
        coverUrl: 'https://example.com/cover.jpg',
        coverPath: '/local/path/cover.jpg',
        pageCount: 350,
        currentPage: 175,
        progressPercentage: 50,
        isbn: '9780134494166',
        status: PrismaBookStatus.READING,
        rating: 5,
        createdAt: now,
        updatedAt: now
      }

      const domainBook = BookMapper.toDomain(raw)

      expect(domainBook.id).toBe(1)
      expect(domainBook.googleBooksId).toBe('gbook-123')
      expect(domainBook.title).toBe('Clean Architecture')
      expect(domainBook.authors).toBe('Robert C. Martin')
      expect(domainBook.coverUrl).toBe('https://example.com/cover.jpg')
      expect(domainBook.coverPath).toBe('/local/path/cover.jpg')
      expect(domainBook.pageCount).toBe(350)
      expect(domainBook.currentPage).toBe(175)
      expect(domainBook.progressPercentage).toBe(50)
      expect(domainBook.isbn).toBe('9780134494166')
      expect(domainBook.status).toBe(BookStatus.READING)
      expect(domainBook.rating).toBe(5)
      expect(domainBook.notes).toEqual([])
      expect(domainBook.createdAt).toEqual(now)
      expect(domainBook.updatedAt).toEqual(now)
    })

    it('should safely parse authors when raw string is not JSON', () => {
      const raw: PrismaBook = {
        id: 2,
        googleBooksId: null,
        title: 'Refactoring',
        authors: 'Martin Fowler, Kent Beck',
        coverUrl: null,
        coverPath: null,
        pageCount: 448,
        currentPage: null,
        progressPercentage: null,
        isbn: null,
        status: PrismaBookStatus.TO_READ,
        rating: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const domainBook = BookMapper.toDomain(raw)

      expect(domainBook.authors).toBe('Martin Fowler, Kent Beck')
    })

    it('should safely deserialize single string JSON authors', () => {
      const raw: PrismaBook = {
        id: 3,
        googleBooksId: null,
        title: 'Domain-Driven Design',
        authors: JSON.stringify('Eric Evans'),
        coverUrl: null,
        coverPath: null,
        pageCount: 560,
        currentPage: null,
        progressPercentage: null,
        isbn: null,
        status: PrismaBookStatus.TO_READ,
        rating: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const domainBook = BookMapper.toDomain(raw)

      expect(domainBook.authors).toBe('Eric Evans')
    })

    it('should map domain Book entity to Prisma persistence input with serialized authors', () => {
      const domainBook = Book.create({
        title: 'Design Patterns',
        authors: 'Erich Gamma, Richard Helm, Ralph Johnson, John Vlissides',
        pageCount: 395,
        status: BookStatus.TO_READ
      })

      const persistencePayload = BookMapper.toPersistence(domainBook)

      expect(persistencePayload.title).toBe('Design Patterns')
      expect(JSON.parse(persistencePayload.authors)).toEqual([
        'Erich Gamma',
        'Richard Helm',
        'Ralph Johnson',
        'John Vlissides'
      ])
      expect(persistencePayload.status).toBe('TO_READ')
      expect(persistencePayload.pageCount).toBe(395)
      expect(persistencePayload.currentPage).toBeNull()
      expect(persistencePayload.progressPercentage).toBeNull()
    })

    it('should map notes when included in raw PrismaBook', () => {
      const rawWithNotes: PrismaBook & { notes: PrismaNote[] } = {
        id: 10,
        googleBooksId: null,
        title: 'Test With Notes',
        authors: JSON.stringify(['Author One']),
        coverUrl: null,
        coverPath: null,
        pageCount: 200,
        currentPage: 50,
        progressPercentage: 25,
        isbn: null,
        status: PrismaBookStatus.READING,
        rating: 4,
        createdAt: new Date(),
        updatedAt: new Date(),
        notes: [
          {
            id: 101,
            bookId: 10,
            content: 'First observation',
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ]
      }

      const domainBook = BookMapper.toDomain(rawWithNotes)

      expect(domainBook.notes).toHaveLength(1)
      expect(domainBook.notes[0]?.id).toBe(101)
      expect(domainBook.notes[0]?.content).toBe('First observation')
    })
  })

  describe('NoteMapper', () => {
    it('should map PrismaNote to domain Note', () => {
      const now = new Date()
      const rawNote: PrismaNote = {
        id: 5,
        bookId: 42,
        content: 'Crucial insight on architectural boundaries.',
        createdAt: now,
        updatedAt: now
      }

      const domainNote = NoteMapper.toDomain(rawNote)

      expect(domainNote.id).toBe(5)
      expect(domainNote.bookId).toBe(42)
      expect(domainNote.content).toBe('Crucial insight on architectural boundaries.')
      expect(domainNote.createdAt).toEqual(now)
      expect(domainNote.updatedAt).toEqual(now)
    })

    it('should map domain Note to Prisma persistence input', () => {
      const note = Note.create({
        bookId: 99,
        content: 'New quick note'
      })

      const persistencePayload = NoteMapper.toPersistence(note)

      expect(persistencePayload.bookId).toBe(99)
      expect(persistencePayload.content).toBe('New quick note')
      expect(persistencePayload.id).toBeUndefined()
    })
  })
})

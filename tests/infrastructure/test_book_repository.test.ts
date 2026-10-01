import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { Book, BookStatus } from '../../src/shared/domain/index.js'
import {
  createPrismaClient,
  PrismaBookRepository
} from '../../src/shared/infrastructure/persistence/index.js'

describe('PrismaBookRepository Integration Tests', () => {
  let tempDbPath: string
  let testDbUrl: string
  let prisma: PrismaClient
  let repository: PrismaBookRepository

  beforeAll(async () => {
    // Generate a unique temporary database file in os.tmpdir() to guarantee isolation
    tempDbPath = path.join(
      os.tmpdir(),
      `booklog_test_bookrepo_${Date.now()}_${Math.random().toString(36).substring(7)}.db`
    )
    testDbUrl = `file:${tempDbPath}`
    prisma = createPrismaClient(testDbUrl)
    repository = new PrismaBookRepository(prisma)

    // Apply all migration files in order
    const migrationsDir = path.resolve(__dirname, '../../prisma/migrations')
    const migrationFolders = fs
      .readdirSync(migrationsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()

    for (const folder of migrationFolders) {
      const sqlFile = path.join(migrationsDir, folder, 'migration.sql')
      if (fs.existsSync(sqlFile)) {
        const migrationSql = fs.readFileSync(sqlFile, 'utf-8')
        const statements = migrationSql
          .split(';')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)

        for (const statement of statements) {
          await prisma.$executeRawUnsafe(statement)
        }
      }
    }

    // Ensure foreign key constraints are strictly enforced in SQLite
    await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON;')
  })

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect()
    }

    try {
      if (fs.existsSync(tempDbPath)) {
        fs.unlinkSync(tempDbPath)
      }
      const journalPath = `${tempDbPath}-journal`
      if (fs.existsSync(journalPath)) {
        fs.unlinkSync(journalPath)
      }
    } catch {
      // Ignore cleanup error if already removed
    }
  })

  it('should create a book and retrieve it by ID verifying all domain and persistence fields', async () => {
    const newBook = Book.create({
      googleBooksId: 'gbook-full-001',
      title: 'Domain-Driven Design: Tackling Complexity in Software',
      authors: 'Eric Evans',
      coverUrl: 'https://books.google.com/cover-001.jpg',
      coverPath: 'C:\\Users\\Tomas\\AppData\\Roaming\\BookLog\\covers\\ddd.jpg',
      pageCount: 560,
      currentPage: 140,
      isbn: '9780321125217',
      status: BookStatus.READING,
      rating: 5
    })

    const created = await repository.create(newBook)
    expect(created.id).toBeDefined()
    expect(created.title).toBe('Domain-Driven Design: Tackling Complexity in Software')
    expect(created.authors).toBe('Eric Evans')

    const retrieved = await repository.findById(created.id!)
    expect(retrieved).not.toBeNull()
    expect(retrieved?.id).toBe(created.id)
    expect(retrieved?.googleBooksId).toBe('gbook-full-001')
    expect(retrieved?.title).toBe('Domain-Driven Design: Tackling Complexity in Software')
    expect(retrieved?.authors).toBe('Eric Evans')
    expect(retrieved?.coverUrl).toBe('https://books.google.com/cover-001.jpg')
    expect(retrieved?.coverPath).toBe(
      'C:\\Users\\Tomas\\AppData\\Roaming\\BookLog\\covers\\ddd.jpg'
    )
    expect(retrieved?.pageCount).toBe(560)
    expect(retrieved?.currentPage).toBe(140)
    expect(retrieved?.progressPercentage).toBe(25)
    expect(retrieved?.isbn).toBe('9780321125217')
    expect(retrieved?.status).toBe(BookStatus.READING)
    expect(retrieved?.rating).toBe(5)
    expect(retrieved?.notes).toEqual([])

    // Verify low-level SQLite JSON serialization for authors
    const rawInDb = await prisma.book.findUnique({ where: { id: created.id } })
    expect(rawInDb).not.toBeNull()
    expect(JSON.parse(rawInDb!.authors)).toEqual(['Eric Evans'])
  })

  it('should return books sorted by updatedAt in descending order in findAll()', async () => {
    const bookA = await repository.create(
      Book.create({
        title: 'Book A (Oldest update)',
        authors: 'Author Alpha',
        status: BookStatus.TO_READ
      })
    )

    const bookB = await repository.create(
      Book.create({
        title: 'Book B (Middle update)',
        authors: 'Author Beta',
        status: BookStatus.READING
      })
    )

    const bookC = await repository.create(
      Book.create({
        title: 'Book C (Newest update)',
        authors: 'Author Gamma',
        status: BookStatus.PAUSED
      })
    )

    // Touch bookA to make it the most recently updated
    await new Promise((resolve) => setTimeout(resolve, 50))
    bookA.updateProgressByPercentage(10)
    await repository.update(bookA)

    const allBooks = await repository.findAll()
    expect(allBooks.length).toBeGreaterThanOrEqual(3)

    const indexA = allBooks.findIndex((b) => b.id === bookA.id)
    const indexB = allBooks.findIndex((b) => b.id === bookB.id)
    const indexC = allBooks.findIndex((b) => b.id === bookC.id)

    expect(indexA).toBeLessThan(indexB)
    expect(indexA).toBeLessThan(indexC)

    // Verify global descending order by updatedAt
    for (let i = 0; i < allBooks.length - 1; i++) {
      expect(allBooks[i]!.updatedAt.getTime()).toBeGreaterThanOrEqual(
        allBooks[i + 1]!.updatedAt.getTime()
      )
    }
  })

  it('should filter correctly by status in findByStatus() with descending order', async () => {
    const readingBook1 = await repository.create(
      Book.create({
        title: 'Concurrent Programming in Java',
        authors: 'Doug Lea',
        status: BookStatus.READING
      })
    )

    const pausedBook = await repository.create(
      Book.create({
        title: 'Structure and Interpretation of Computer Programs',
        authors: 'Harold Abelson, Gerald Jay Sussman',
        status: BookStatus.PAUSED
      })
    )

    const readingBooks = await repository.findByStatus(BookStatus.READING)
    const pausedBooks = await repository.findByStatus(BookStatus.PAUSED)

    expect(readingBooks.some((b) => b.id === readingBook1.id)).toBe(true)
    expect(readingBooks.every((b) => b.status === BookStatus.READING)).toBe(true)

    expect(pausedBooks.some((b) => b.id === pausedBook.id)).toBe(true)
    expect(pausedBooks.every((b) => b.status === BookStatus.PAUSED)).toBe(true)
    expect(pausedBooks.some((b) => b.id === readingBook1.id)).toBe(false)
  })

  it('should update book data, progress and status correctly with update()', async () => {
    const book = await repository.create(
      Book.create({
        title: 'Working Effectively with Legacy Code',
        authors: 'Michael Feathers',
        pageCount: 400,
        status: BookStatus.TO_READ
      })
    )

    expect(book.status).toBe(BookStatus.TO_READ)
    expect(book.currentPage).toBeNull()
    expect(book.progressPercentage).toBeNull()

    // Update progress and status
    book.updateProgressByPage(200)
    book.updateStatus(BookStatus.READING)
    book.updateRating(5)

    const updated = await repository.update(book)

    expect(updated.id).toBe(book.id)
    expect(updated.currentPage).toBe(200)
    expect(updated.progressPercentage).toBe(50)
    expect(updated.status).toBe(BookStatus.READING)
    expect(updated.rating).toBe(5)

    // Re-query from database to verify persistence
    const reloaded = await repository.findById(book.id!)
    expect(reloaded).not.toBeNull()
    expect(reloaded?.currentPage).toBe(200)
    expect(reloaded?.progressPercentage).toBe(50)
    expect(reloaded?.status).toBe(BookStatus.READING)
    expect(reloaded?.rating).toBe(5)
  })

  it('should delete a book and verify findById returns null', async () => {
    const book = await repository.create(
      Book.create({
        title: 'To Be Deleted',
        authors: 'Ephemeral Author',
        status: BookStatus.ABANDONED
      })
    )

    expect(await repository.findById(book.id!)).not.toBeNull()

    await repository.delete(book.id!)

    const deleted = await repository.findById(book.id!)
    expect(deleted).toBeNull()
  })

  it('should not load notes by default in findAll and findById (decoupled loading)', async () => {
    const book = await repository.create(
      Book.create({
        title: 'Book for Notes Decoupling Test',
        authors: 'Martin Fowler',
        status: BookStatus.READING
      })
    )

    // Directly insert a note into the database for this book
    await prisma.note.create({
      data: {
        bookId: book.id!,
        content: 'Direct note in database'
      }
    })

    const foundById = await repository.findById(book.id!)
    expect(foundById).not.toBeNull()
    expect(foundById?.notes).toEqual([])

    const allBooks = await repository.findAll()
    const target = allBooks.find((b) => b.id === book.id)
    expect(target).toBeDefined()
    expect(target?.notes).toEqual([])
  })
})

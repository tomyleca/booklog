import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient, BookStatus } from '@prisma/client'
import {
  createPrismaClient,
  resolveDatabaseUrl
} from '../../src/shared/infrastructure/persistence/prismaClient.js'

describe('Prisma SQLite Database Infrastructure', () => {
  let tempDbPath: string
  let testDbUrl: string
  let prisma: PrismaClient

  beforeAll(async () => {
    // Generate a unique temporary database file in os.tmpdir to prevent touching user/production data
    tempDbPath = path.join(
      os.tmpdir(),
      `booklog_test_${Date.now()}_${Math.random().toString(36).substring(7)}.db`
    )
    testDbUrl = `file:${tempDbPath}`
    prisma = createPrismaClient(testDbUrl)

    // Read and apply all migration SQL files in order to temporary database
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

    // Clean up temporary database files
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

  describe('resolveDatabaseUrl', () => {
    it('should prioritize explicitly passed customUrl', () => {
      const custom = 'file:./custom_test.db'
      expect(resolveDatabaseUrl(custom)).toBe(custom)
    })

    it('should use DATABASE_URL env var if no custom url provided', () => {
      const originalEnv = process.env['DATABASE_URL']
      process.env['DATABASE_URL'] = 'file:./env_test.db'
      try {
        expect(resolveDatabaseUrl()).toBe('file:./env_test.db')
      } finally {
        if (originalEnv !== undefined) {
          process.env['DATABASE_URL'] = originalEnv
        } else {
          delete process.env['DATABASE_URL']
        }
      }
    })
  })

  describe('Database CRUD and relationships', () => {
    it('should create a book with new fields (coverPath, currentPage, progressPercentage, PAUSED status)', async () => {
      const book = await prisma.book.create({
        data: {
          googleBooksId: 'gbook-12345',
          title: 'Cien años de soledad',
          authors: JSON.stringify(['Gabriel García Márquez']),
          coverUrl: 'https://example.com/cover.jpg',
          coverPath: 'C:\\Users\\Tomas\\AppData\\Roaming\\BookLog\\covers\\cover_123.jpg',
          pageCount: 417,
          currentPage: 200,
          progressPercentage: 48,
          isbn: '978-0307474728',
          status: BookStatus.PAUSED,
          rating: 5
        }
      })

      expect(book.id).toBeDefined()
      expect(typeof book.id).toBe('number')
      expect(book.title).toBe('Cien años de soledad')
      expect(JSON.parse(book.authors)).toEqual(['Gabriel García Márquez'])
      expect(book.coverPath).toBe('C:\\Users\\Tomas\\AppData\\Roaming\\BookLog\\covers\\cover_123.jpg')
      expect(book.currentPage).toBe(200)
      expect(book.progressPercentage).toBe(48)
      expect(book.status).toBe('PAUSED')
      expect(book.rating).toBe(5)
      expect(book.createdAt).toBeInstanceOf(Date)
      expect(book.updatedAt).toBeInstanceOf(Date)

      const fetchedBook = await prisma.book.findUnique({
        where: { id: book.id }
      })
      expect(fetchedBook).not.toBeNull()
      expect(fetchedBook?.googleBooksId).toBe('gbook-12345')
      expect(fetchedBook?.pageCount).toBe(417)
      expect(fetchedBook?.currentPage).toBe(200)
      expect(fetchedBook?.progressPercentage).toBe(48)
      expect(fetchedBook?.coverPath).toBe('C:\\Users\\Tomas\\AppData\\Roaming\\BookLog\\covers\\cover_123.jpg')
      expect(fetchedBook?.status).toBe(BookStatus.PAUSED)
    })

    it('should create notes linked to a book and retrieve them', async () => {
      const book = await prisma.book.create({
        data: {
          title: 'El amor en los tiempos del cólera',
          authors: JSON.stringify(['Gabriel García Márquez']),
          status: BookStatus.READING,
          pageCount: 368,
          currentPage: 45,
          progressPercentage: 12
        }
      })

      const note1 = await prisma.note.create({
        data: {
          bookId: book.id,
          content: 'Cita memorable en el capítulo 1 sobre el olor a almendras amargas.'
        }
      })

      const note2 = await prisma.note.create({
        data: {
          bookId: book.id,
          content: 'Reflexión sobre el paso del tiempo y la persistencia del amor.'
        }
      })

      expect(note1.id).toBeDefined()
      expect(note1.bookId).toBe(book.id)
      expect(note1.content).toContain('almendras amargas')
      expect(note1.createdAt).toBeInstanceOf(Date)
      expect(note1.updatedAt).toBeInstanceOf(Date)

      expect(note2.id).toBeDefined()
      expect(note2.bookId).toBe(book.id)

      // Query through Book relation
      const bookWithNotes = await prisma.book.findUnique({
        where: { id: book.id },
        include: { notes: true }
      })

      expect(bookWithNotes).not.toBeNull()
      expect(bookWithNotes?.notes).toHaveLength(2)
      expect(bookWithNotes?.notes.map((n) => n.content)).toEqual([
        'Cita memorable en el capítulo 1 sobre el olor a almendras amargas.',
        'Reflexión sobre el paso del tiempo y la persistencia del amor.'
      ])

      // Query notes directly
      const directNotes = await prisma.note.findMany({
        where: { bookId: book.id }
      })
      expect(directNotes).toHaveLength(2)
    })

    it('should enforce ON DELETE CASCADE when a book is deleted', async () => {
      const book = await prisma.book.create({
        data: {
          title: 'Crónica de una muerte anunciada',
          authors: JSON.stringify(['Gabriel García Márquez']),
          status: BookStatus.FINISHED,
          progressPercentage: 100
        }
      })

      await prisma.note.create({
        data: {
          bookId: book.id,
          content: 'El fatalismo y la inevitabilidad del destino en el relato.'
        }
      })

      // Verify note exists
      const initialNotes = await prisma.note.findMany({
        where: { bookId: book.id }
      })
      expect(initialNotes).toHaveLength(1)

      // Delete the book
      await prisma.book.delete({
        where: { id: book.id }
      })

      // Verify book is gone
      const deletedBook = await prisma.book.findUnique({
        where: { id: book.id }
      })
      expect(deletedBook).toBeNull()

      // Verify notes were deleted in cascade
      const remainingNotes = await prisma.note.findMany({
        where: { bookId: book.id }
      })
      expect(remainingNotes).toHaveLength(0)
    })

    it('should reject duplicate googleBooksId due to unique constraint', async () => {
      const uniqueGId = 'unique-google-id-999'

      await prisma.book.create({
        data: {
          googleBooksId: uniqueGId,
          title: 'Primer libro',
          authors: 'Autor A',
          status: BookStatus.TO_READ
        }
      })

      await expect(
        prisma.book.create({
          data: {
            googleBooksId: uniqueGId,
            title: 'Segundo libro duplicado',
            authors: 'Autor B',
            status: BookStatus.TO_READ
          }
        })
      ).rejects.toThrow()
    })
  })
})

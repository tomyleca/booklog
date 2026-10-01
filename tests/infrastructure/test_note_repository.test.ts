import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { Book, BookStatus, Note } from '../../src/shared/domain/index.js'
import {
  createPrismaClient,
  PrismaBookRepository,
  PrismaNoteRepository
} from '../../src/shared/infrastructure/persistence/index.js'

describe('PrismaNoteRepository Integration Tests', () => {
  let tempDbPath: string
  let testDbUrl: string
  let prisma: PrismaClient
  let bookRepository: PrismaBookRepository
  let noteRepository: PrismaNoteRepository

  beforeAll(async () => {
    // Generate a unique temporary database file in os.tmpdir() to guarantee isolation
    tempDbPath = path.join(
      os.tmpdir(),
      `booklog_test_noterepo_${Date.now()}_${Math.random().toString(36).substring(7)}.db`
    )
    testDbUrl = `file:${tempDbPath}`
    prisma = createPrismaClient(testDbUrl)
    bookRepository = new PrismaBookRepository(prisma)
    noteRepository = new PrismaNoteRepository(prisma)

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

    // Ensure foreign key constraints and cascades are strictly enforced in SQLite
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

  it('should create a note associated with a book and retrieve it by ID', async () => {
    const book = await bookRepository.create(
      Book.create({
        title: 'The Pragmatic Programmer',
        authors: 'Andrew Hunt, David Thomas',
        status: BookStatus.READING
      })
    )

    const note = Note.create({
      bookId: book.id!,
      content: 'Care about your craft. Why spend your life developing software unless you care?'
    })

    const createdNote = await noteRepository.create(note)

    expect(createdNote.id).toBeDefined()
    expect(createdNote.bookId).toBe(book.id)
    expect(createdNote.content).toBe(
      'Care about your craft. Why spend your life developing software unless you care?'
    )
    expect(createdNote.createdAt).toBeInstanceOf(Date)
    expect(createdNote.updatedAt).toBeInstanceOf(Date)

    const retrievedNote = await noteRepository.findById(createdNote.id!)
    expect(retrievedNote).not.toBeNull()
    expect(retrievedNote?.id).toBe(createdNote.id)
    expect(retrievedNote?.bookId).toBe(book.id)
    expect(retrievedNote?.content).toBe(createdNote.content)
  })

  it('should return notes sorted chronologically (createdAt ASC) in findByBookId()', async () => {
    const book = await bookRepository.create(
      Book.create({
        title: 'Clean Code',
        authors: 'Robert C. Martin',
        status: BookStatus.READING
      })
    )

    const note1 = await noteRepository.create(
      Note.create({
        bookId: book.id!,
        content: 'Note 1 - Meaningful Names chapter'
      })
    )

    await new Promise((resolve) => setTimeout(resolve, 30))

    const note2 = await noteRepository.create(
      Note.create({
        bookId: book.id!,
        content: 'Note 2 - Functions should do one thing'
      })
    )

    await new Promise((resolve) => setTimeout(resolve, 30))

    const note3 = await noteRepository.create(
      Note.create({
        bookId: book.id!,
        content: 'Note 3 - Comments do not make up for bad code'
      })
    )

    const notes = await noteRepository.findByBookId(book.id!)

    expect(notes).toHaveLength(3)
    expect(notes[0]?.id).toBe(note1.id)
    expect(notes[1]?.id).toBe(note2.id)
    expect(notes[2]?.id).toBe(note3.id)

    // Verify chronological order
    expect(notes[0]!.createdAt.getTime()).toBeLessThanOrEqual(notes[1]!.createdAt.getTime())
    expect(notes[1]!.createdAt.getTime()).toBeLessThanOrEqual(notes[2]!.createdAt.getTime())
  })

  it('should update content of an existing note with update()', async () => {
    const book = await bookRepository.create(
      Book.create({
        title: 'Refactoring: Improving the Design of Existing Code',
        authors: 'Martin Fowler',
        status: BookStatus.READING
      })
    )

    const note = await noteRepository.create(
      Note.create({
        bookId: book.id!,
        content: 'Draft observation on code smells'
      })
    )

    // Update note domain entity
    note.updateContent('Polished insight: Extract method is the most frequent refactoring')

    const updatedNote = await noteRepository.update(note)

    expect(updatedNote.id).toBe(note.id)
    expect(updatedNote.content).toBe(
      'Polished insight: Extract method is the most frequent refactoring'
    )

    // Re-query from database
    const reloaded = await noteRepository.findById(note.id!)
    expect(reloaded).not.toBeNull()
    expect(reloaded?.content).toBe(
      'Polished insight: Extract method is the most frequent refactoring'
    )
  })

  it('should delete an individual note with delete()', async () => {
    const book = await bookRepository.create(
      Book.create({
        title: 'Test-Driven Development by Example',
        authors: 'Kent Beck',
        status: BookStatus.READING
      })
    )

    const note = await noteRepository.create(
      Note.create({
        bookId: book.id!,
        content: 'Red, Green, Refactor rhythm'
      })
    )

    expect(await noteRepository.findById(note.id!)).not.toBeNull()

    await noteRepository.delete(note.id!)

    const deleted = await noteRepository.findById(note.id!)
    expect(deleted).toBeNull()
  })

  it('should cascade delete associated notes when a book is deleted via PrismaBookRepository.delete()', async () => {
    const book = await bookRepository.create(
      Book.create({
        title: 'Designing Data-Intensive Applications',
        authors: 'Martin Kleppmann',
        status: BookStatus.READING
      })
    )

    const noteA = await noteRepository.create(
      Note.create({
        bookId: book.id!,
        content: 'Reliability, Scalability, Maintainability'
      })
    )

    const noteB = await noteRepository.create(
      Note.create({
        bookId: book.id!,
        content: 'Data models: Relational vs Document'
      })
    )

    // Verify notes exist
    const notesBefore = await noteRepository.findByBookId(book.id!)
    expect(notesBefore).toHaveLength(2)

    // Delete the parent book
    await bookRepository.delete(book.id!)

    // Book should be gone
    const deletedBook = await bookRepository.findById(book.id!)
    expect(deletedBook).toBeNull()

    // Notes associated with the book should be deleted by foreign key cascade
    const notesAfter = await noteRepository.findByBookId(book.id!)
    expect(notesAfter).toHaveLength(0)

    const checkNoteA = await noteRepository.findById(noteA.id!)
    expect(checkNoteA).toBeNull()

    const checkNoteB = await noteRepository.findById(noteB.id!)
    expect(checkNoteB).toBeNull()
  })
})

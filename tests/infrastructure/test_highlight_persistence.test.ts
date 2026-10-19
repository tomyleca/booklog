import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import {
  Book,
  BookStatus,
  Highlight,
  LocationKind,
  Note,
  NoteOrigin
} from '../../src/shared/domain/index.js'
import {
  createPrismaClient,
  PrismaBookRepository,
  PrismaHighlightRepository,
  PrismaNoteRepository
} from '../../src/shared/infrastructure/persistence/index.js'

const MIGRATIONS_DIR = path.resolve(__dirname, '../../prisma/migrations')
const HIGHLIGHTS_MIGRATION = '20261019120000_add_highlights_and_note_origin'

function migrationFolders(): string[] {
  return fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

async function applyMigration(prisma: PrismaClient, folder: string): Promise<void> {
  const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, folder, 'migration.sql'), 'utf-8')
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement)
  }
}

function createTempDb(label: string): { prisma: PrismaClient; file: string } {
  const file = path.join(
    os.tmpdir(),
    `booklog_test_${label}_${Date.now()}_${Math.random().toString(36).substring(7)}.db`
  )
  return { prisma: createPrismaClient(`file:${file}`), file }
}

async function disposeTempDb(prisma: PrismaClient, file: string): Promise<void> {
  await prisma.$disconnect()
  for (const candidate of [file, `${file}-journal`]) {
    try {
      if (fs.existsSync(candidate)) fs.unlinkSync(candidate)
    } catch {
      // Ignore cleanup errors in temp dir
    }
  }
}

function newBook(title: string): Book {
  return Book.create({ title, authors: 'Autor de prueba', status: BookStatus.READING })
}

function kindleHighlight(bookId: number, fingerprint: string, start: number): Highlight {
  return Highlight.create({
    bookId,
    content: `Subrayado en ${start}`,
    location: { kind: LocationKind.LOCATION, start, end: start + 3 },
    capturedAt: new Date(2026, 6, 14, 22, 15, 3),
    fingerprint
  })
}

describe('Feature #22 — migration keeps existing notes as MANUAL', () => {
  let prisma: PrismaClient
  let file: string

  beforeAll(async () => {
    const db = createTempDb('highlights_migration')
    prisma = db.prisma
    file = db.file

    const folders = migrationFolders()
    const index = folders.indexOf(HIGHLIGHTS_MIGRATION)
    expect(index).toBeGreaterThan(0)

    for (const folder of folders.slice(0, index)) {
      await applyMigration(prisma, folder)
    }
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Book" ("id", "title", "authors", "status", "updatedAt") VALUES (1, 'Viejo', 'A', 'READING', CURRENT_TIMESTAMP)`
    )
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Note" ("id", "bookId", "content", "updatedAt") VALUES (10, 1, 'Nota previa', CURRENT_TIMESTAMP)`
    )
    for (const folder of folders.slice(index)) {
      await applyMigration(prisma, folder)
    }
  })

  afterAll(async () => {
    await disposeTempDb(prisma, file)
  })

  it('should preserve the note content and default its origin to MANUAL', async () => {
    const notes = await new PrismaNoteRepository(prisma).findByBookId(1)
    expect(notes).toHaveLength(1)
    expect(notes[0]?.id).toBe(10)
    expect(notes[0]?.content).toBe('Nota previa')
    expect(notes[0]?.origin).toBe(NoteOrigin.MANUAL)
    expect(notes[0]?.highlightId).toBeNull()
    expect(notes[0]?.fingerprint).toBeNull()
  })
})

describe('Feature #22 — PrismaHighlightRepository and Note origin persistence', () => {
  let prisma: PrismaClient
  let file: string
  let books: PrismaBookRepository
  let highlights: PrismaHighlightRepository
  let notes: PrismaNoteRepository

  beforeAll(async () => {
    const db = createTempDb('highlights_repo')
    prisma = db.prisma
    file = db.file
    for (const folder of migrationFolders()) {
      await applyMigration(prisma, folder)
    }
    await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON;')
    books = new PrismaBookRepository(prisma)
    highlights = new PrismaHighlightRepository(prisma)
    notes = new PrismaNoteRepository(prisma)
  })

  afterAll(async () => {
    await disposeTempDb(prisma, file)
  })

  it('should create and list highlights ordered by location', async () => {
    const book = await books.create(newBook('Orden'))
    const bookId = book.id as number
    await highlights.create(kindleHighlight(bookId, 'h-late', 900))
    await highlights.create(kindleHighlight(bookId, 'h-early', 15))

    const list = await highlights.findByBookId(bookId)
    expect(list.map((h) => h.fingerprint)).toEqual(['h-early', 'h-late'])
    expect(list[0]?.location).toEqual({ kind: 'LOCATION', start: 15, end: 18 })
    expect(list[0]?.capturedAt).toEqual(new Date(2026, 6, 14, 22, 15, 3))
  })

  it('should persist a page highlight without range or date', async () => {
    const book = await books.create(newBook('Página'))
    const saved = await highlights.create(
      Highlight.create({
        bookId: book.id as number,
        content: 'Una frase',
        location: { kind: LocationKind.PAGE, start: 42 },
        fingerprint: 'p-42'
      })
    )
    const found = await highlights.findById(saved.id as number)
    expect(found?.location).toEqual({ kind: 'PAGE', start: 42, end: null })
    expect(found?.capturedAt).toBeNull()
  })

  it('should reject a duplicated fingerprint in the same book but allow it in another', async () => {
    const first = await books.create(newBook('Huella A'))
    const second = await books.create(newBook('Huella B'))
    await highlights.create(kindleHighlight(first.id as number, 'dup', 1))

    await expect(highlights.create(kindleHighlight(first.id as number, 'dup', 2))).rejects.toThrow()
    const other = await highlights.create(kindleHighlight(second.id as number, 'dup', 1))
    expect(other.id).toBeDefined()
  })

  it('should persist Kindle notes with origin, location, date, fingerprint and link', async () => {
    const book = await books.create(newBook('Notas Kindle'))
    const bookId = book.id as number
    const highlight = await highlights.create(kindleHighlight(bookId, 'h1', 100))

    const saved = await notes.create(
      Note.createImported({
        bookId,
        content: 'Mi comentario en el Kindle',
        location: { kind: LocationKind.LOCATION, start: 103 },
        capturedAt: new Date(2026, 6, 14, 22, 16, 0),
        fingerprint: 'n1',
        highlightId: highlight.id as number
      })
    )

    const found = await notes.findById(saved.id as number)
    expect(found?.origin).toBe(NoteOrigin.KINDLE)
    expect(found?.highlightId).toBe(highlight.id)
    expect(found?.location).toEqual({ kind: 'LOCATION', start: 103, end: null })
    expect(found?.capturedAt).toEqual(new Date(2026, 6, 14, 22, 16, 0))
    expect(found?.fingerprint).toBe('n1')

    found?.updateContent('Editado')
    const updated = await notes.update(found as Note)
    expect(updated.content).toBe('Editado')
    expect(updated.origin).toBe(NoteOrigin.KINDLE)
    expect(updated.highlightId).toBe(highlight.id)
  })

  it('should allow many manual notes (null fingerprint) but not duplicated Kindle fingerprints', async () => {
    const book = await books.create(newBook('Únicos'))
    const bookId = book.id as number
    await notes.create(Note.create({ bookId, content: 'Manual 1' }))
    await notes.create(Note.create({ bookId, content: 'Manual 2' }))

    const imported = (): Note =>
      Note.createImported({
        bookId,
        content: 'Repetida',
        location: { kind: LocationKind.PAGE, start: 5 },
        fingerprint: 'same'
      })
    await notes.create(imported())
    await expect(notes.create(imported())).rejects.toThrow()

    expect(await notes.findByBookId(bookId)).toHaveLength(3)
  })

  it('should keep linked notes and unlink them when their highlight is deleted', async () => {
    const book = await books.create(newBook('Set null'))
    const bookId = book.id as number
    const highlight = await highlights.create(kindleHighlight(bookId, 'h-del', 10))
    const note = await notes.create(
      Note.createImported({
        bookId,
        content: 'Sobrevive',
        location: { kind: LocationKind.LOCATION, start: 13 },
        fingerprint: 'n-del',
        highlightId: highlight.id as number
      })
    )

    await highlights.delete(highlight.id as number)

    expect(await highlights.findById(highlight.id as number)).toBeNull()
    const survivor = await notes.findById(note.id as number)
    expect(survivor?.content).toBe('Sobrevive')
    expect(survivor?.highlightId).toBeNull()
  })

  it('should ignore deleting a highlight that does not exist', async () => {
    await expect(highlights.delete(999_999)).resolves.toBeUndefined()
  })

  it('should cascade-delete highlights and notes when the book is deleted', async () => {
    const book = await books.create(newBook('Cascada'))
    const bookId = book.id as number
    const highlight = await highlights.create(kindleHighlight(bookId, 'h-c', 1))
    await notes.create(Note.create({ bookId, content: 'Se va con el libro' }))

    await books.delete(bookId)

    expect(await highlights.findById(highlight.id as number)).toBeNull()
    expect(await highlights.findByBookId(bookId)).toEqual([])
    expect(await notes.findByBookId(bookId)).toEqual([])
  })
})

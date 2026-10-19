import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { Book, BookStatus, NoteOrigin } from '../../src/shared/domain/index.js'
import { CommitKindleImport } from '../../src/shared/application/index.js'
import {
  createPrismaClient,
  PrismaBookRepository,
  PrismaHighlightRepository,
  PrismaNoteRepository
} from '../../src/shared/infrastructure/persistence/index.js'
import { KINDLE_FIXTURE_TEXT, KINDLE_TITLES } from '../fixtures/kindleClippings.js'

const MIGRATIONS_DIR = path.resolve(__dirname, '../../prisma/migrations')
const LOCATION_MIGRATION = '20261019150000_annotation_page_and_position'

function migrationFolders(): string[] {
  return fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

async function applyMigration(prisma: PrismaClient, folder: string): Promise<void> {
  const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, folder, 'migration.sql'), 'utf-8')
  for (const statement of sql
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)) {
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

describe('Feature #23 — migration to page + position keeps existing locations', () => {
  let prisma: PrismaClient
  let file: string

  beforeAll(async () => {
    const db = createTempDb('location_migration')
    prisma = db.prisma
    file = db.file
    const folders = migrationFolders()
    const index = folders.indexOf(LOCATION_MIGRATION)
    expect(index).toBeGreaterThan(0)
    for (const folder of folders.slice(0, index)) await applyMigration(prisma, folder)

    await prisma.$executeRawUnsafe(
      `INSERT INTO "Book" ("id", "title", "authors", "status", "updatedAt") VALUES (1, 'Viejo', 'A', 'READING', CURRENT_TIMESTAMP)`
    )
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Highlight" ("id", "bookId", "content", "locationKind", "locationStart", "locationEnd", "fingerprint") VALUES (5, 1, 'Por página', 'PAGE', 12, 13, 'h-page')`
    )
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Highlight" ("id", "bookId", "content", "locationKind", "locationStart", "fingerprint") VALUES (6, 1, 'Por posición', 'LOCATION', 1200, 'h-pos')`
    )
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Note" ("id", "bookId", "content", "origin", "highlightId", "locationKind", "locationStart", "fingerprint", "updatedAt") VALUES (7, 1, 'Nota Kindle', 'KINDLE', 6, 'LOCATION', 1200, 'n-1', CURRENT_TIMESTAMP)`
    )
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Note" ("id", "bookId", "content", "updatedAt") VALUES (8, 1, 'Nota manual', CURRENT_TIMESTAMP)`
    )

    for (const folder of folders.slice(index)) await applyMigration(prisma, folder)
  })

  afterAll(async () => {
    await disposeTempDb(prisma, file)
  })

  it('should move PAGE locations to the page columns and LOCATION to the position ones', async () => {
    const highlights = await new PrismaHighlightRepository(prisma).findByBookId(1)
    const byId = new Map(highlights.map((h) => [h.id, h]))
    expect(byId.get(5)?.location).toEqual({ page: { start: 12, end: 13 }, position: null })
    expect(byId.get(6)?.location).toEqual({ page: null, position: { start: 1200, end: null } })
  })

  it('should keep notes, their link and their origin', async () => {
    const notes = await new PrismaNoteRepository(prisma).findByBookId(1)
    const kindle = notes.find((n) => n.id === 7)
    expect(kindle?.origin).toBe(NoteOrigin.KINDLE)
    expect(kindle?.highlightId).toBe(6)
    expect(kindle?.location).toEqual({ page: null, position: { start: 1200, end: null } })
    const manual = notes.find((n) => n.id === 8)
    expect(manual?.origin).toBe(NoteOrigin.MANUAL)
    expect(manual?.location).toBeNull()
  })
})

describe('Feature #23 — CommitKindleImport against SQLite', () => {
  let prisma: PrismaClient
  let file: string

  beforeAll(async () => {
    const db = createTempDb('kindle_commit')
    prisma = db.prisma
    file = db.file
    for (const folder of migrationFolders()) await applyMigration(prisma, folder)
    await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON;')
  })

  afterAll(async () => {
    await disposeTempDb(prisma, file)
  })

  it('should persist page and position, link notes and skip everything on reimport', async () => {
    const books = new PrismaBookRepository(prisma)
    const highlights = new PrismaHighlightRepository(prisma)
    const notes = new PrismaNoteRepository(prisma)
    const book = await books.create(
      Book.create({ title: 'AI Engineering', authors: 'Chip Huyen', status: BookStatus.READING })
    )
    const bookId = book.id as number
    const useCase = new CommitKindleImport(books, highlights, notes)
    const assignments = [
      { groupKey: KINDLE_TITLES.annasArchive, bookId },
      { groupKey: KINDLE_TITLES.zLibrary, bookId }
    ]

    const first = await useCase.execute({ text: KINDLE_FIXTURE_TEXT, assignments })
    expect(first).toMatchObject({ highlightsImported: 4, notesImported: 3 })

    const saved = await highlights.findByBookId(bookId)
    expect(saved.map((h) => h.location.position?.start)).toEqual([98, 180, 300, 512])
    expect(saved[1]?.location).toEqual({
      page: { start: 12, end: null },
      position: { start: 180, end: 183 }
    })

    const savedNotes = await notes.findByBookId(bookId)
    expect(savedNotes.every((n) => n.origin === NoteOrigin.KINDLE)).toBe(true)
    expect(savedNotes.every((n) => n.highlightId !== null)).toBe(true)

    const again = await useCase.execute({ text: KINDLE_FIXTURE_TEXT, assignments })
    expect(again).toMatchObject({
      highlightsImported: 0,
      notesImported: 0,
      highlightsSkipped: 4,
      notesSkipped: 3
    })
    expect(await prisma.highlight.count({ where: { bookId } })).toBe(4)
    expect(await prisma.note.count({ where: { bookId } })).toBe(3)
  })
})

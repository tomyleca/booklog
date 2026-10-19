import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import {
  Book,
  BookStatus,
  Highlight,
  HighlightColor,
  ImportedNotebookFile
} from '../../src/shared/domain/index.js'
import { CommitKindleNotebookImport } from '../../src/shared/application/index.js'
import {
  createPrismaClient,
  PrismaBookRepository,
  PrismaHighlightRepository,
  PrismaImportedNotebookFileRepository,
  PrismaNoteRepository
} from '../../src/shared/infrastructure/persistence/index.js'
import { NOTEBOOK_ES_FILE_NAME, NOTEBOOK_ES_HTML } from '../fixtures/kindleNotebooks.js'

const MIGRATIONS_DIR = path.resolve(__dirname, '../../prisma/migrations')
const COLOR_MIGRATION = '20261019200000_highlight_color_and_notebook_imports'

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

describe('Feature #26 — migration adds the highlight color without touching data', () => {
  let prisma: PrismaClient
  let file: string

  beforeAll(async () => {
    const db = createTempDb('notebook_migration')
    prisma = db.prisma
    file = db.file
    const folders = migrationFolders()
    const index = folders.indexOf(COLOR_MIGRATION)
    expect(index).toBeGreaterThan(0)
    for (const folder of folders.slice(0, index)) await applyMigration(prisma, folder)

    await prisma.$executeRawUnsafe(
      `INSERT INTO "Book" ("id", "title", "authors", "status", "updatedAt") VALUES (1, 'Viejo', 'A', 'READING', CURRENT_TIMESTAMP)`
    )
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Highlight" ("id", "bookId", "content", "positionStart", "positionEnd", "capturedAt", "fingerprint") VALUES (5, 1, 'De My Clippings', 1200, 1203, 1752531303000, 'kindle-v1:abc')`
    )

    for (const folder of folders.slice(index)) await applyMigration(prisma, folder)
  })

  afterAll(async () => {
    await disposeTempDb(prisma, file)
  })

  it('should keep existing highlights, without color', async () => {
    const [highlight] = await new PrismaHighlightRepository(prisma).findByBookId(1)
    expect(highlight?.content).toBe('De My Clippings')
    expect(highlight?.location.position).toEqual({ start: 1200, end: 1203 })
    expect(highlight?.capturedAt).not.toBeNull()
    expect(highlight?.color).toBeNull()
  })

  it('should create the imported files table empty', async () => {
    expect(await prisma.importedNotebookFile.count()).toBe(0)
  })
})

describe('Feature #26 — notebook import against SQLite', () => {
  let prisma: PrismaClient
  let file: string

  beforeAll(async () => {
    const db = createTempDb('notebook_commit')
    prisma = db.prisma
    file = db.file
    for (const folder of migrationFolders()) await applyMigration(prisma, folder)
    await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON;')
  })

  afterAll(async () => {
    await disposeTempDb(prisma, file)
  })

  it('should persist the color of a highlight', async () => {
    const books = new PrismaBookRepository(prisma)
    const book = await books.create(
      Book.create({ title: 'Color', authors: 'A', status: BookStatus.READING })
    )
    const repository = new PrismaHighlightRepository(prisma)
    const saved = await repository.create(
      Highlight.create({
        bookId: book.id as number,
        content: 'Azul',
        location: { position: { start: 10 } },
        fingerprint: 'kindle-nb-v1:color',
        color: HighlightColor.BLUE
      })
    )
    expect(saved.color).toBe('BLUE')
    expect((await repository.findById(saved.id as number))?.color).toBe('BLUE')
  })

  it('should upsert imported files by path', async () => {
    const repository = new PrismaImportedNotebookFileRepository(prisma)
    const first = new Date('2026-10-19T15:40:00.123Z')
    const second = new Date('2026-10-20T09:00:00.456Z')
    await repository.save(new ImportedNotebookFile({ path: 'E:\\Docs\\a.html', modifiedAt: first }))
    await repository.save(
      new ImportedNotebookFile({ path: 'E:\\Docs\\a.html', modifiedAt: second })
    )
    expect(await repository.findByPaths([])).toEqual([])
    const found = await repository.findByPaths(['E:\\Docs\\a.html', 'E:\\Docs\\b.html'])
    expect(found).toHaveLength(1)
    expect(found[0]?.matches(second)).toBe(true)
    expect(found[0]?.matches(first)).toBe(false)
  })

  it('should import an export, remember it and skip everything on reimport', async () => {
    const books = new PrismaBookRepository(prisma)
    const book = await books.create(
      Book.create({ title: 'El crepúsculo de los ídolos', authors: 'Friedrich Nietzsche' })
    )
    const bookId = book.id as number
    const files = [
      {
        fileName: NOTEBOOK_ES_FILE_NAME,
        path: `E:\\Docs\\${NOTEBOOK_ES_FILE_NAME}`,
        modifiedAt: new Date('2026-10-19T15:40:00.123Z'),
        html: NOTEBOOK_ES_HTML
      }
    ]
    const importedFiles = new PrismaImportedNotebookFileRepository(prisma)
    const useCase = new CommitKindleNotebookImport(
      books,
      new PrismaHighlightRepository(prisma),
      new PrismaNoteRepository(prisma),
      importedFiles
    )
    const assignments = [{ groupKey: NOTEBOOK_ES_FILE_NAME, bookId }]

    expect(await useCase.execute({ files, assignments })).toMatchObject({
      highlightsImported: 10,
      notesImported: 5
    })
    const colors = await prisma.highlight.findMany({ where: { bookId }, select: { color: true } })
    expect(new Set(colors.map((c) => c.color))).toEqual(
      new Set(['YELLOW', 'BLUE', 'PINK', 'ORANGE'])
    )
    expect(await prisma.highlight.count({ where: { bookId, capturedAt: { not: null } } })).toBe(0)
    expect(await prisma.note.count({ where: { bookId, highlightId: { not: null } } })).toBe(4)
    expect(
      (await importedFiles.findByPaths([files[0]!.path]))[0]?.matches(files[0]!.modifiedAt)
    ).toBe(true)

    expect(await useCase.execute({ files, assignments })).toMatchObject({
      highlightsImported: 0,
      notesImported: 0,
      highlightsSkipped: 10,
      notesSkipped: 5
    })
  })
})

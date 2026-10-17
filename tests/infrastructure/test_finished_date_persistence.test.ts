import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { Book, BookStatus, toIsoDate } from '../../src/shared/domain/index.js'
import {
  BookMapper,
  createPrismaClient,
  PrismaBookRepository
} from '../../src/shared/infrastructure/persistence/index.js'

const MIGRATIONS_DIR = path.resolve(__dirname, '../../prisma/migrations')
const FINISHED_AT_MIGRATION = '20261017212053_add_book_finished_at'

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

describe('Feature #20 — finishedAt migration backfill', () => {
  let prisma: PrismaClient
  let file: string

  beforeAll(async () => {
    const db = createTempDb('finished_backfill')
    prisma = db.prisma
    file = db.file
    const folders = migrationFolders()
    expect(folders).toContain(FINISHED_AT_MIGRATION)

    for (const folder of folders.filter((f) => f < FINISHED_AT_MIGRATION)) {
      await applyMigration(prisma, folder)
    }

    // Datos "viejos": existen antes de que exista la columna finishedAt
    const finishedUpdatedAt = new Date('2026-05-20T15:30:00.000Z')
    const readingUpdatedAt = new Date('2026-06-01T10:00:00.000Z')
    await prisma.$executeRaw`INSERT INTO "Book" ("title", "authors", "status", "updatedAt")
      VALUES ('Terminado viejo', '["Autor"]', 'FINISHED', ${finishedUpdatedAt})`
    await prisma.$executeRaw`INSERT INTO "Book" ("title", "authors", "status", "updatedAt")
      VALUES ('Leyendo viejo', '["Autor"]', 'READING', ${readingUpdatedAt})`

    for (const folder of folders.filter((f) => f >= FINISHED_AT_MIGRATION)) {
      await applyMigration(prisma, folder)
    }
  })

  afterAll(async () => {
    await disposeTempDb(prisma, file)
  })

  it('should set finishedAt = updatedAt for books that were already FINISHED', async () => {
    const finished = await prisma.book.findFirstOrThrow({ where: { title: 'Terminado viejo' } })
    expect(finished.finishedAt).not.toBeNull()
    expect(finished.finishedAt?.getTime()).toBe(finished.updatedAt.getTime())
    expect(finished.finishedAt?.toISOString()).toBe('2026-05-20T15:30:00.000Z')
  })

  it('should leave finishedAt null for books that were not FINISHED', async () => {
    const reading = await prisma.book.findFirstOrThrow({ where: { title: 'Leyendo viejo' } })
    expect(reading.finishedAt).toBeNull()
  })

  it('should map the backfilled date into the domain entity', async () => {
    const raw = await prisma.book.findFirstOrThrow({ where: { title: 'Terminado viejo' } })
    const book = BookMapper.toDomain(raw)
    expect(book.finishedAt?.getTime()).toBe(raw.updatedAt.getTime())
  })
})

describe('Feature #20 — PrismaBookRepository with finishedAt', () => {
  let prisma: PrismaClient
  let file: string
  let repository: PrismaBookRepository

  beforeAll(async () => {
    const db = createTempDb('finished_repo')
    prisma = db.prisma
    file = db.file
    for (const folder of migrationFolders()) {
      await applyMigration(prisma, folder)
    }
    repository = new PrismaBookRepository(prisma)
  })

  afterAll(async () => {
    await disposeTempDb(prisma, file)
  })

  it('should persist finishedAt when creating a FINISHED book', async () => {
    const created = await repository.create(
      Book.create({
        title: 'Pedro Páramo',
        authors: 'Juan Rulfo',
        status: BookStatus.FINISHED,
        finishedAt: new Date(2026, 1, 14)
      })
    )
    const found = await repository.findById(created.id as number)
    expect(found?.finishedAt).not.toBeNull()
    expect(toIsoDate(found?.finishedAt as Date)).toBe('2026-02-14')
    expect(found?.finishedAt?.getHours()).toBe(12)
  })

  it('should persist status transitions preserving and overwriting finishedAt', async () => {
    const created = await repository.create(
      Book.create({ title: 'El llano en llamas', authors: 'Juan Rulfo', pageCount: 200 })
    )
    expect(created.finishedAt).toBeNull()

    created.updateStatus(BookStatus.FINISHED, new Date(2026, 3, 2))
    const finished = await repository.update(created)
    expect(toIsoDate(finished.finishedAt as Date)).toBe('2026-04-02')

    finished.updateStatus(BookStatus.READING)
    const reopened = await repository.update(finished)
    expect(reopened.status).toBe(BookStatus.READING)
    expect(toIsoDate(reopened.finishedAt as Date)).toBe('2026-04-02')

    reopened.updateStatus(BookStatus.FINISHED, new Date(2026, 4, 9))
    await repository.update(reopened)
    const reloaded = await repository.findById(created.id as number)
    expect(toIsoDate(reloaded?.finishedAt as Date)).toBe('2026-05-09')
  })

  it('should persist an edited finished date', async () => {
    const created = await repository.create(
      Book.create({ title: 'Ficciones', authors: 'Borges', status: BookStatus.FINISHED })
    )
    created.setFinishedDate(new Date(2025, 10, 30))
    await repository.update(created)
    const reloaded = await repository.findById(created.id as number)
    expect(toIsoDate(reloaded?.finishedAt as Date)).toBe('2025-11-30')
  })
})

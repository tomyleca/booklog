import { describe, it, expect, beforeEach } from 'vitest'
import {
  Book,
  BookStatus,
  Highlight,
  InvalidKindleImportError,
  Note,
  NoteOrigin
} from '../../src/shared/domain/index.js'
import type {
  BookRepository,
  HighlightRepository,
  NoteRepository
} from '../../src/shared/domain/index.js'
import {
  BookNotFoundError,
  CommitKindleImport,
  PreviewKindleImport
} from '../../src/shared/application/index.js'
import { KINDLE_FIXTURE_TEXT, KINDLE_TITLES } from '../fixtures/kindleClippings.js'

class InMemoryBooks implements BookRepository {
  public books = new Map<number, Book>()
  async findAll(): Promise<Book[]> {
    return [...this.books.values()]
  }
  async findById(id: number): Promise<Book | null> {
    return this.books.get(id) ?? null
  }
  async findByStatus(status: BookStatus): Promise<Book[]> {
    return [...this.books.values()].filter((b) => b.status === status)
  }
  async create(book: Book): Promise<Book> {
    this.books.set(book.id as number, book)
    return book
  }
  async update(book: Book): Promise<Book> {
    this.books.set(book.id as number, book)
    return book
  }
  async delete(id: number): Promise<void> {
    this.books.delete(id)
  }
}

class InMemoryHighlights implements HighlightRepository {
  public items = new Map<number, Highlight>()
  private nextId = 1
  async findByBookId(bookId: number): Promise<Highlight[]> {
    return [...this.items.values()].filter((h) => h.bookId === bookId)
  }
  async findById(id: number): Promise<Highlight | null> {
    return this.items.get(id) ?? null
  }
  async create(highlight: Highlight): Promise<Highlight> {
    const duplicated = [...this.items.values()].some(
      (h) => h.bookId === highlight.bookId && h.fingerprint === highlight.fingerprint
    )
    if (duplicated) throw new Error('UNIQUE constraint failed')
    const id = this.nextId++
    const saved = Highlight.fromPrimitives({ ...highlight.toPrimitives(), id })
    this.items.set(id, saved)
    return saved
  }
  async delete(id: number): Promise<void> {
    this.items.delete(id)
  }
}

class InMemoryNotes implements NoteRepository {
  public items = new Map<number, Note>()
  private nextId = 1
  async findByBookId(bookId: number): Promise<Note[]> {
    return [...this.items.values()].filter((n) => n.bookId === bookId)
  }
  async findById(id: number): Promise<Note | null> {
    return this.items.get(id) ?? null
  }
  async create(note: Note): Promise<Note> {
    const duplicated = [...this.items.values()].some(
      (n) =>
        n.bookId === note.bookId && n.fingerprint !== null && n.fingerprint === note.fingerprint
    )
    if (duplicated) throw new Error('UNIQUE constraint failed')
    const id = this.nextId++
    const saved = Note.fromPrimitives({ ...note.toPrimitives(), id })
    this.items.set(id, saved)
    return saved
  }
  async update(note: Note): Promise<Note> {
    this.items.set(note.id as number, note)
    return note
  }
  async delete(id: number): Promise<void> {
    this.items.delete(id)
  }
}

function groupKey(raw: string): string {
  return raw.replace(/\s+/gu, ' ').trim()
}

describe('Feature #23 — PreviewKindleImport', () => {
  it('should group by Kindle title with real counts and a proposed book', async () => {
    const books = new InMemoryBooks()
    await books.create(new Book({ id: 1, title: 'Legado de cenizas', authors: 'Tim Weiner' }))
    await books.create(
      new Book({ id: 2, title: 'AI Engineering', authors: 'Chip Huyen', isbn: '9781098166304' })
    )

    const preview = await new PreviewKindleImport(books).execute({ text: KINDLE_FIXTURE_TEXT })

    expect(preview).toMatchObject({
      totalEntries: 28,
      ignoredBookmarks: 2,
      ignoredEmpty: 1,
      unrecognizedEntries: 0
    })
    expect(preview.groups).toHaveLength(12)

    const ai = preview.groups.find((g) => g.key === groupKey(KINDLE_TITLES.annasArchive))
    expect(ai).toMatchObject({
      title: 'AI Engineering: Building Applications with Foundation Models',
      author: 'Chip Huyen',
      highlightCount: 2,
      noteCount: 3,
      supersededHighlights: 1,
      supersededNotes: 3,
      match: { bookId: 2, method: 'ISBN', confidence: 'HIGH' }
    })
    expect(ai?.lastCapturedAt).toEqual(new Date(2025, 6, 15, 10, 3, 0))

    const legado = preview.groups.filter((g) => g.match?.bookId === 1)
    expect(legado.map((g) => g.title).sort()).toEqual([
      'Legado de cenizas',
      'Legado de cenizas: La historia de la CIA'
    ])

    const unmatched = preview.groups.find((g) => g.key === groupKey(KINDLE_TITLES.oceanOfPdf))
    expect(unmatched?.match).toBeNull()
  })
})

describe('Feature #23 — CommitKindleImport', () => {
  let books: InMemoryBooks
  let highlights: InMemoryHighlights
  let notes: InMemoryNotes
  let useCase: CommitKindleImport

  beforeEach(async () => {
    books = new InMemoryBooks()
    highlights = new InMemoryHighlights()
    notes = new InMemoryNotes()
    await books.create(new Book({ id: 1, title: 'Legado de cenizas', authors: 'Tim Weiner' }))
    await books.create(new Book({ id: 2, title: 'AI Engineering', authors: 'Chip Huyen' }))
    useCase = new CommitKindleImport(books, highlights, notes)
  })

  const assignments = [
    { groupKey: groupKey(KINDLE_TITLES.annasArchive), bookId: 2 },
    { groupKey: groupKey(KINDLE_TITLES.dashAuthor), bookId: 1 },
    { groupKey: groupKey(KINDLE_TITLES.annasArchiveIsbn13), bookId: 1 }
  ]

  it('should create KINDLE highlights and notes, linking notes to their highlight', async () => {
    const report = await useCase.execute({ text: KINDLE_FIXTURE_TEXT, assignments })

    expect(report).toMatchObject({
      highlightsImported: 5,
      notesImported: 5,
      highlightsSkipped: 0,
      notesSkipped: 0,
      groupsNotImported: 9
    })
    expect(report.books).toEqual([
      expect.objectContaining({
        bookId: 2,
        title: 'AI Engineering',
        highlightsImported: 2,
        notesImported: 3
      }),
      expect.objectContaining({ bookId: 1, highlightsImported: 3, notesImported: 2 })
    ])

    const aiNotes = await notes.findByBookId(2)
    expect(aiNotes.every((n) => n.origin === NoteOrigin.KINDLE)).toBe(true)
    const aiHighlights = await highlights.findByBookId(2)
    const extended = aiHighlights.find((h) => h.content.includes('extendió'))
    expect(aiNotes.filter((n) => n.highlightId === extended?.id)).toHaveLength(2)
    expect(aiHighlights[0]?.location).toEqual({
      page: { start: 12, end: null },
      position: { start: 180, end: 183 }
    })
    expect(aiHighlights[0]?.capturedAt).toEqual(new Date(2025, 6, 14, 22, 15, 3))

    const loose = (await notes.findByBookId(1)).find((n) => n.content === 'Nota suelta inventada.')
    expect(loose?.highlightId).toBeNull()
  })

  it('should not duplicate anything when the same file is imported again', async () => {
    await useCase.execute({ text: KINDLE_FIXTURE_TEXT, assignments })
    const again = await useCase.execute({ text: KINDLE_FIXTURE_TEXT, assignments })

    expect(again).toMatchObject({
      highlightsImported: 0,
      notesImported: 0,
      highlightsSkipped: 5,
      notesSkipped: 5
    })
    expect(highlights.items.size).toBe(5)
    expect(notes.items.size).toBe(5)
  })

  it('should link a new note to a highlight imported in a previous run', async () => {
    const onlyHighlight = KINDLE_FIXTURE_TEXT.split('==========')
      .filter((block) => !block.includes('La nota en la posición 1204'))
      .join('==========')
    const dash = [{ groupKey: groupKey(KINDLE_TITLES.dashAuthor), bookId: 1 }]
    await useCase.execute({ text: onlyHighlight, assignments: dash })
    expect(await notes.findByBookId(1)).toHaveLength(0)

    await useCase.execute({ text: KINDLE_FIXTURE_TEXT, assignments: dash })
    const [note] = await notes.findByBookId(1)
    const target = (await highlights.findByBookId(1)).find((h) => h.content.includes('agencia'))
    expect(note?.highlightId).toBe(target?.id)
  })

  it('should reject unknown groups or repeated assignments', async () => {
    await expect(
      useCase.execute({ text: KINDLE_FIXTURE_TEXT, assignments: [{ groupKey: 'Nada', bookId: 1 }] })
    ).rejects.toThrow(InvalidKindleImportError)
    await expect(
      useCase.execute({
        text: KINDLE_FIXTURE_TEXT,
        assignments: [assignments[0]!, { ...assignments[0]!, bookId: 1 }]
      })
    ).rejects.toThrow(InvalidKindleImportError)
    await expect(
      useCase.execute({
        text: KINDLE_FIXTURE_TEXT,
        assignments: [{ groupKey: assignments[0]!.groupKey, bookId: 0 }]
      })
    ).rejects.toThrow(InvalidKindleImportError)
  })

  it('should validate every book before writing anything', async () => {
    await expect(
      useCase.execute({
        text: KINDLE_FIXTURE_TEXT,
        assignments: [assignments[0]!, { groupKey: assignments[1]!.groupKey, bookId: 99 }]
      })
    ).rejects.toThrow(BookNotFoundError)
    expect(highlights.items.size).toBe(0)
    expect(notes.items.size).toBe(0)
  })
})

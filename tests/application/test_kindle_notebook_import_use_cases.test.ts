import { describe, it, expect, beforeEach } from 'vitest'
import {
  Book,
  Highlight,
  ImportedNotebookFile,
  InvalidKindleImportError,
  Note,
  NoteOrigin
} from '../../src/shared/domain/index.js'
import type {
  BookRepository,
  HighlightRepository,
  ImportedNotebookFileRepository,
  NoteRepository
} from '../../src/shared/domain/index.js'
import {
  BookNotFoundError,
  CommitKindleImport,
  CommitKindleNotebookImport,
  PreviewKindleNotebookImport
} from '../../src/shared/application/index.js'
import type { KindleNotebookFileInput } from '../../src/shared/application/index.js'
import {
  NOTEBOOK_CHAPTERS_FILE_NAME,
  NOTEBOOK_CHAPTERS_HTML,
  NOTEBOOK_EN_FILE_NAME,
  NOTEBOOK_EN_HTML,
  NOTEBOOK_ES_FILE_NAME,
  NOTEBOOK_ES_HTML,
  NOTEBOOK_ES_TEXTS
} from '../fixtures/kindleNotebooks.js'

const ES = NOTEBOOK_ES_TEXTS

class InMemoryBooks implements BookRepository {
  constructor(public books: Book[]) {}
  async findAll(): Promise<Book[]> {
    return this.books
  }
  async findById(id: number): Promise<Book | null> {
    return this.books.find((b) => b.id === id) ?? null
  }
  async findByStatus(): Promise<Book[]> {
    return this.books
  }
  async create(book: Book): Promise<Book> {
    return book
  }
  async update(book: Book): Promise<Book> {
    return book
  }
  async delete(): Promise<void> {}
}

class InMemoryHighlights implements HighlightRepository {
  public items: Highlight[] = []
  async findByBookId(bookId: number): Promise<Highlight[]> {
    return this.items.filter((h) => h.bookId === bookId)
  }
  async findById(id: number): Promise<Highlight | null> {
    return this.items.find((h) => h.id === id) ?? null
  }
  async create(highlight: Highlight): Promise<Highlight> {
    if (
      this.items.some(
        (h) => h.bookId === highlight.bookId && h.fingerprint === highlight.fingerprint
      )
    ) {
      throw new Error('UNIQUE constraint failed')
    }
    const saved = Highlight.fromPrimitives({
      ...highlight.toPrimitives(),
      id: this.items.length + 1
    })
    this.items.push(saved)
    return saved
  }
  async delete(): Promise<void> {}
}

class InMemoryNotes implements NoteRepository {
  public items: Note[] = []
  async findByBookId(bookId: number): Promise<Note[]> {
    return this.items.filter((n) => n.bookId === bookId)
  }
  async findById(id: number): Promise<Note | null> {
    return this.items.find((n) => n.id === id) ?? null
  }
  async create(note: Note): Promise<Note> {
    if (
      this.items.some(
        (n) =>
          n.bookId === note.bookId && n.fingerprint !== null && n.fingerprint === note.fingerprint
      )
    ) {
      throw new Error('UNIQUE constraint failed')
    }
    const saved = Note.fromPrimitives({ ...note.toPrimitives(), id: this.items.length + 1 })
    this.items.push(saved)
    return saved
  }
  async update(note: Note): Promise<Note> {
    return note
  }
  async delete(): Promise<void> {}
}

class InMemoryImportedFiles implements ImportedNotebookFileRepository {
  public items = new Map<string, ImportedNotebookFile>()
  async findByPaths(paths: string[]): Promise<ImportedNotebookFile[]> {
    return paths.flatMap((p) =>
      this.items.has(p) ? [this.items.get(p) as ImportedNotebookFile] : []
    )
  }
  async save(file: ImportedNotebookFile): Promise<ImportedNotebookFile> {
    this.items.set(file.path, file)
    return file
  }
}

const MODIFIED = new Date('2026-10-19T15:40:00.123Z')

function file(fileName: string, html: string, modifiedAt = MODIFIED): KindleNotebookFileInput {
  return { fileName, path: `E:\\Docs\\${fileName}`, modifiedAt, html }
}

const ES_FILE = file(NOTEBOOK_ES_FILE_NAME, NOTEBOOK_ES_HTML)
const CHAPTERS_FILE = file(NOTEBOOK_CHAPTERS_FILE_NAME, NOTEBOOK_CHAPTERS_HTML)
const EN_FILE = file(NOTEBOOK_EN_FILE_NAME, NOTEBOOK_EN_HTML)
const EMPTY_FILE = file('Vacío-Bloc de notas.html', '<html><body></body></html>')

/** My Clippings con la misma anotación que la exportación (posición 640, mismo texto). */
const CLIPPINGS_SHARED = [
  'El crepúsculo de los ídolos -- Friedrich Nietzsche (Friedrich Nietzsche)',
  '- Tu resaltado en la posición 640-642 | Añadido el lunes, 14 de julio de 2025 22:15:03',
  '',
  `  ${ES.withNoteNext.replace(/ /gu, '  ')}`,
  '==========',
  'El crepúsculo de los ídolos -- Friedrich Nietzsche (Friedrich Nietzsche)',
  '- La nota en la posición 1427 | Añadido el lunes, 14 de julio de 2025 22:16:00',
  '',
  ES.noteSame,
  '==========',
  'El crepúsculo de los ídolos -- Friedrich Nietzsche (Friedrich Nietzsche)',
  '- Tu resaltado en la posición 52-54 | Añadido el lunes, 14 de julio de 2025 22:10:00',
  '',
  'Una versión distinta del primer subrayado.',
  '=========='
].join('\r\n')
const CLIPPINGS_KEY = 'El crepúsculo de los ídolos -- Friedrich Nietzsche (Friedrich Nietzsche)'

describe('Feature #26 — PreviewKindleNotebookImport', () => {
  let books: InMemoryBooks
  let imported: InMemoryImportedFiles

  beforeEach(() => {
    books = new InMemoryBooks([
      new Book({ id: 1, title: 'El crepúsculo de los ídolos', authors: 'Friedrich Nietzsche' }),
      new Book({ id: 2, title: 'Frankenstein', authors: 'Mary Shelley' })
    ])
    imported = new InMemoryImportedFiles()
  })

  it('should build one group per file with counts, match and file name', async () => {
    const preview = await new PreviewKindleNotebookImport(books, imported).execute({
      files: [ES_FILE, CHAPTERS_FILE, EN_FILE, EMPTY_FILE]
    })
    expect(preview.fileCount).toBe(4)
    expect(preview.totalEntries).toBe(15 + 4 + 8)
    expect(preview.ignoredBookmarks).toBe(1)
    expect(preview.ignoredEmpty).toBe(1)
    expect(preview.unrecognizedEntries).toBe(1)
    expect(preview.groups.map((g) => g.key)).toEqual([
      NOTEBOOK_ES_FILE_NAME,
      NOTEBOOK_CHAPTERS_FILE_NAME,
      NOTEBOOK_EN_FILE_NAME
    ])
    const es = preview.groups[0]!
    expect(es).toMatchObject({
      title: 'El crepúsculo de los ídolos',
      author: 'Friedrich Nietzsche',
      highlightCount: 10,
      noteCount: 5,
      lastCapturedAt: null,
      fileName: NOTEBOOK_ES_FILE_NAME,
      importState: 'NEW',
      match: { bookId: 1, confidence: 'HIGH' }
    })
    expect(preview.groups[1]?.match?.bookId).toBe(2)
    expect(preview.groups[2]).toMatchObject({ author: 'Herman Melville', match: null })
  })

  it('should prefer the author of the app over the one deduced from the title', async () => {
    const dirty = file(
      'x-Bloc de notas.html',
      NOTEBOOK_ES_HTML.replace(
        /<div class='bookTitle'>[^<]*/u,
        "<div class='bookTitle'>Un libro -- Autor Sucio; traducción, Otro -- isbn13 9786077471806 -- 0123456789abcdef0123456789abcdef --"
      )
    )
    const preview = await new PreviewKindleNotebookImport(books, imported).execute({
      files: [dirty]
    })
    expect(preview.groups[0]).toMatchObject({
      title: 'Un libro',
      author: 'Friedrich Nietzsche',
      isbn: '9786077471806'
    })
  })

  it('should mark files already imported, and changed ones when the date differs', async () => {
    await imported.save(new ImportedNotebookFile({ path: ES_FILE.path, modifiedAt: MODIFIED }))
    await imported.save(
      new ImportedNotebookFile({ path: CHAPTERS_FILE.path, modifiedAt: new Date('2026-01-01') })
    )
    const preview = await new PreviewKindleNotebookImport(books, imported).execute({
      files: [ES_FILE, CHAPTERS_FILE, EN_FILE]
    })
    expect(Object.fromEntries(preview.groups.map((g) => [g.key, g.importState]))).toEqual({
      [NOTEBOOK_ES_FILE_NAME]: 'IMPORTED',
      [NOTEBOOK_CHAPTERS_FILE_NAME]: 'CHANGED',
      [NOTEBOOK_EN_FILE_NAME]: 'NEW'
    })
  })
})

describe('Feature #26 — CommitKindleNotebookImport', () => {
  let books: InMemoryBooks
  let highlights: InMemoryHighlights
  let notes: InMemoryNotes
  let imported: InMemoryImportedFiles

  const commitNotebook = (
    assignments: { groupKey: string; bookId: number }[],
    files = [ES_FILE, CHAPTERS_FILE, EN_FILE]
  ) =>
    new CommitKindleNotebookImport(books, highlights, notes, imported).execute({
      files,
      assignments
    })

  beforeEach(() => {
    books = new InMemoryBooks([
      new Book({ id: 1, title: 'El crepúsculo de los ídolos', authors: 'Friedrich Nietzsche' }),
      new Book({ id: 2, title: 'Frankenstein', authors: 'Mary Shelley' })
    ])
    highlights = new InMemoryHighlights()
    notes = new InMemoryNotes()
    imported = new InMemoryImportedFiles()
  })

  it('should create highlights with color and without date, and linked KINDLE notes', async () => {
    const report = await commitNotebook([{ groupKey: NOTEBOOK_ES_FILE_NAME, bookId: 1 }])
    expect(report).toMatchObject({
      highlightsImported: 10,
      notesImported: 5,
      highlightsSkipped: 0,
      notesSkipped: 0,
      groupsNotImported: 2
    })
    expect(highlights.items.every((h) => h.capturedAt === null)).toBe(true)
    expect(highlights.items.find((h) => h.content === ES.blue)?.color).toBe('BLUE')
    expect(notes.items.every((n) => n.origin === NoteOrigin.KINDLE && n.capturedAt === null)).toBe(
      true
    )
    const blueId = highlights.items.find((h) => h.content === ES.blue)?.id
    expect(notes.items.find((n) => n.content === ES.noteTwoAfter.trim())?.highlightId).toBe(blueId)
    expect(notes.items.find((n) => n.content === ES.farNote)?.highlightId).toBeNull()
    expect(notes.items.find((n) => n.content === ES.multilineNote)).toBeDefined()
  })

  it('should remember the imported files with their modification date', async () => {
    await commitNotebook([
      { groupKey: NOTEBOOK_ES_FILE_NAME, bookId: 1 },
      { groupKey: NOTEBOOK_CHAPTERS_FILE_NAME, bookId: 2 }
    ])
    expect([...imported.items.keys()].sort()).toEqual([CHAPTERS_FILE.path, ES_FILE.path].sort())
    expect(imported.items.get(ES_FILE.path)?.matches(MODIFIED)).toBe(true)
  })

  it('should not duplicate anything when the same export is imported again', async () => {
    await commitNotebook([{ groupKey: NOTEBOOK_ES_FILE_NAME, bookId: 1 }])
    const again = await commitNotebook([{ groupKey: NOTEBOOK_ES_FILE_NAME, bookId: 1 }])
    expect(again).toMatchObject({
      highlightsImported: 0,
      notesImported: 0,
      highlightsSkipped: 10,
      notesSkipped: 5
    })
    expect(highlights.items).toHaveLength(10)
  })

  it('should skip what My Clippings already imported and link notes to the existing highlight', async () => {
    const fromClippings = await new CommitKindleImport(books, highlights, notes).execute({
      text: CLIPPINGS_SHARED,
      assignments: [{ groupKey: CLIPPINGS_KEY, bookId: 1 }]
    })
    expect(fromClippings).toMatchObject({ highlightsImported: 2, notesImported: 1 })
    const existing = highlights.items.find((h) => h.location.position?.start === 640)

    const report = await commitNotebook([{ groupKey: NOTEBOOK_ES_FILE_NAME, bookId: 1 }])
    expect(report).toMatchObject({
      highlightsImported: 9,
      highlightsSkipped: 1,
      notesImported: 4,
      notesSkipped: 1
    })
    expect(highlights.items.filter((h) => h.location.position?.start === 640)).toHaveLength(1)
    expect(existing?.color).toBeNull()
    expect(existing?.capturedAt).not.toBeNull()
    expect(notes.items.find((n) => n.content === ES.noteNext)?.highlightId).toBe(existing?.id)
    // Mismo inicio pero otro texto: son anotaciones distintas y quedan las dos.
    expect(highlights.items.filter((h) => h.location.position?.start === 52)).toHaveLength(2)
  })

  it('should skip in My Clippings what the export already imported', async () => {
    await commitNotebook([{ groupKey: NOTEBOOK_ES_FILE_NAME, bookId: 1 }])
    const report = await new CommitKindleImport(books, highlights, notes).execute({
      text: CLIPPINGS_SHARED,
      assignments: [{ groupKey: CLIPPINGS_KEY, bookId: 1 }]
    })
    expect(report).toMatchObject({
      highlightsImported: 1,
      highlightsSkipped: 1,
      notesImported: 0,
      notesSkipped: 1
    })
    expect(highlights.items.find((h) => h.location.position?.start === 640)?.color).toBe('YELLOW')
  })

  it('should validate assignments and books before writing', async () => {
    await expect(commitNotebook([{ groupKey: 'otro.html', bookId: 1 }])).rejects.toBeInstanceOf(
      InvalidKindleImportError
    )
    await expect(
      commitNotebook([
        { groupKey: NOTEBOOK_ES_FILE_NAME, bookId: 1 },
        { groupKey: NOTEBOOK_EN_FILE_NAME, bookId: 99 }
      ])
    ).rejects.toBeInstanceOf(BookNotFoundError)
    expect(highlights.items).toHaveLength(0)
    expect(imported.items.size).toBe(0)
  })
})

import { describe, it, expect, beforeEach } from 'vitest'
import {
  AddNote,
  GetBookNotes,
  UpdateNote,
  DeleteNote,
  BookNotFoundError,
  NoteNotFoundError
} from '../../src/shared/application/index.js'
import {
  Book,
  BookStatus,
  Note,
  InvalidNoteError
} from '../../src/shared/domain/index.js'
import type { BookRepository } from '../../src/shared/domain/ports/BookRepository.js'
import type { NoteRepository } from '../../src/shared/domain/ports/NoteRepository.js'

class MockBookRepository implements BookRepository {
  public books: Map<number, Book> = new Map()
  private nextId = 1

  async findAll(): Promise<Book[]> {
    return Array.from(this.books.values())
  }

  async findById(id: number): Promise<Book | null> {
    const book = this.books.get(id)
    if (!book) return null
    return Book.fromPrimitives(book.toPrimitives())
  }

  async findByStatus(status: BookStatus): Promise<Book[]> {
    return Array.from(this.books.values()).filter((b) => b.status === status)
  }

  async create(book: Book): Promise<Book> {
    const primitives = book.toPrimitives()
    const id = primitives.id ?? this.nextId++
    const saved = Book.fromPrimitives({ ...primitives, id })
    this.books.set(id, saved)
    return Book.fromPrimitives(saved.toPrimitives())
  }

  async update(book: Book): Promise<Book> {
    if (!book.id || !this.books.has(book.id)) {
      throw new Error(`Book with id ${book.id} not found in mock repository`)
    }
    const updated = Book.fromPrimitives(book.toPrimitives())
    this.books.set(book.id, updated)
    return Book.fromPrimitives(updated.toPrimitives())
  }

  async delete(id: number): Promise<void> {
    this.books.delete(id)
  }
}

class MockNoteRepository implements NoteRepository {
  public notes: Map<number, Note> = new Map()
  private nextId = 1

  async findByBookId(bookId: number): Promise<Note[]> {
    return Array.from(this.notes.values())
      .filter((n) => n.bookId === bookId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((n) => Note.fromPrimitives(n.toPrimitives()))
  }

  async findById(id: number): Promise<Note | null> {
    const note = this.notes.get(id)
    if (!note) return null
    return Note.fromPrimitives(note.toPrimitives())
  }

  async create(note: Note): Promise<Note> {
    const primitives = note.toPrimitives()
    const id = primitives.id ?? this.nextId++
    const saved = Note.fromPrimitives({ ...primitives, id })
    this.notes.set(id, saved)
    return Note.fromPrimitives(saved.toPrimitives())
  }

  async update(note: Note): Promise<Note> {
    if (!note.id || !this.notes.has(note.id)) {
      throw new Error(`Note with id ${note.id} not found in mock repository`)
    }
    const updated = Note.fromPrimitives(note.toPrimitives())
    this.notes.set(note.id, updated)
    return Note.fromPrimitives(updated.toPrimitives())
  }

  async delete(id: number): Promise<void> {
    this.notes.delete(id)
  }
}

describe('Note Application Use Cases', () => {
  let bookRepo: MockBookRepository
  let noteRepo: MockNoteRepository
  let sampleBook: Book

  beforeEach(async () => {
    bookRepo = new MockBookRepository()
    noteRepo = new MockNoteRepository()

    sampleBook = await bookRepo.create(
      Book.create({
        title: 'Domain-Driven Design',
        authors: 'Eric Evans',
        status: BookStatus.READING,
        pageCount: 560
      })
    )
  })

  describe('AddNote', () => {
    it('should add a note to an existing book successfully', async () => {
      const useCase = new AddNote(bookRepo, noteRepo)

      const result = await useCase.execute({
        bookId: sampleBook.id!,
        content: 'Ubiquitous Language connects developers and domain experts.'
      })

      expect(result).toBeInstanceOf(Note)
      expect(result.id).toBeDefined()
      expect(result.bookId).toBe(sampleBook.id)
      expect(result.content).toBe(
        'Ubiquitous Language connects developers and domain experts.'
      )
      expect(result.createdAt).toBeInstanceOf(Date)
      expect(result.updatedAt).toBeInstanceOf(Date)

      const persisted = await noteRepo.findById(result.id!)
      expect(persisted).not.toBeNull()
      expect(persisted?.content).toBe(
        'Ubiquitous Language connects developers and domain experts.'
      )
    })

    it('should throw BookNotFoundError if book does not exist', async () => {
      const useCase = new AddNote(bookRepo, noteRepo)

      await expect(
        useCase.execute({
          bookId: 9999,
          content: 'Note for a non-existent book'
        })
      ).rejects.toThrow(BookNotFoundError)

      await expect(
        useCase.execute({
          bookId: 9999,
          content: 'Note for a non-existent book'
        })
      ).rejects.toThrow('Libro con ID 9999 no encontrado.')
    })

    it('should throw InvalidNoteError if content is empty or only whitespace', async () => {
      const useCase = new AddNote(bookRepo, noteRepo)

      await expect(
        useCase.execute({
          bookId: sampleBook.id!,
          content: ''
        })
      ).rejects.toThrow(InvalidNoteError)

      await expect(
        useCase.execute({
          bookId: sampleBook.id!,
          content: '    '
        })
      ).rejects.toThrow(InvalidNoteError)
    })
  })

  describe('GetBookNotes', () => {
    it('should retrieve all notes for a book ordered chronologically', async () => {
      const addNote = new AddNote(bookRepo, noteRepo)
      const getNotes = new GetBookNotes(bookRepo, noteRepo)

      const note1 = await addNote.execute({
        bookId: sampleBook.id!,
        content: 'First insight: Entities have identity.'
      })

      // Simulate time progression
      const note2 = Note.create({
        bookId: sampleBook.id!,
        content: 'Second insight: Value Objects are immutable.'
      })
      const savedNote2 = await noteRepo.create(
        new Note({
          ...note2.toPrimitives(),
          createdAt: new Date(note1.createdAt.getTime() + 1000)
        })
      )

      const note3 = Note.create({
        bookId: sampleBook.id!,
        content: 'Third insight: Aggregate roots enforce boundaries.'
      })
      const savedNote3 = await noteRepo.create(
        new Note({
          ...note3.toPrimitives(),
          createdAt: new Date(note1.createdAt.getTime() + 2000)
        })
      )

      const notes = await getNotes.execute({ bookId: sampleBook.id! })

      expect(notes).toHaveLength(3)
      expect(notes[0]?.id).toBe(note1.id)
      expect(notes[1]?.id).toBe(savedNote2.id)
      expect(notes[2]?.id).toBe(savedNote3.id)
      expect(notes[0]?.content).toBe('First insight: Entities have identity.')
      expect(notes[1]?.content).toBe('Second insight: Value Objects are immutable.')
      expect(notes[2]?.content).toBe('Third insight: Aggregate roots enforce boundaries.')
    })

    it('should return an empty list if book has no notes', async () => {
      const getNotes = new GetBookNotes(bookRepo, noteRepo)
      const notes = await getNotes.execute({ bookId: sampleBook.id! })

      expect(notes).toEqual([])
    })

    it('should throw BookNotFoundError if book does not exist', async () => {
      const getNotes = new GetBookNotes(bookRepo, noteRepo)

      await expect(getNotes.execute({ bookId: 8888 })).rejects.toThrow(
        BookNotFoundError
      )
    })
  })

  describe('UpdateNote', () => {
    it('should update note content successfully', async () => {
      const addNote = new AddNote(bookRepo, noteRepo)
      const updateNote = new UpdateNote(noteRepo)

      const created = await addNote.execute({
        bookId: sampleBook.id!,
        content: 'Draft thought about bounded contexts'
      })

      const updated = await updateNote.execute({
        id: created.id!,
        content: 'Refined thought: Bounded Contexts define boundary of model'
      })

      expect(updated.id).toBe(created.id)
      expect(updated.content).toBe(
        'Refined thought: Bounded Contexts define boundary of model'
      )

      const reloaded = await noteRepo.findById(created.id!)
      expect(reloaded?.content).toBe(
        'Refined thought: Bounded Contexts define boundary of model'
      )
    })

    it('should throw NoteNotFoundError if note does not exist', async () => {
      const updateNote = new UpdateNote(noteRepo)

      await expect(
        updateNote.execute({
          id: 7777,
          content: 'Updated content'
        })
      ).rejects.toThrow(NoteNotFoundError)

      await expect(
        updateNote.execute({
          id: 7777,
          content: 'Updated content'
        })
      ).rejects.toThrow('Nota con ID 7777 no encontrada.')
    })

    it('should throw InvalidNoteError if new content is empty or whitespace', async () => {
      const addNote = new AddNote(bookRepo, noteRepo)
      const updateNote = new UpdateNote(noteRepo)

      const created = await addNote.execute({
        bookId: sampleBook.id!,
        content: 'Valid content'
      })

      await expect(
        updateNote.execute({
          id: created.id!,
          content: ''
        })
      ).rejects.toThrow(InvalidNoteError)

      await expect(
        updateNote.execute({
          id: created.id!,
          content: '     '
        })
      ).rejects.toThrow(InvalidNoteError)
    })
  })

  describe('DeleteNote', () => {
    it('should delete an existing note successfully', async () => {
      const addNote = new AddNote(bookRepo, noteRepo)
      const deleteNote = new DeleteNote(noteRepo)

      const created = await addNote.execute({
        bookId: sampleBook.id!,
        content: 'Note to be removed'
      })

      expect(await noteRepo.findById(created.id!)).not.toBeNull()

      await deleteNote.execute({ id: created.id! })

      expect(await noteRepo.findById(created.id!)).toBeNull()
    })

    it('should throw NoteNotFoundError when trying to delete a non-existent note', async () => {
      const deleteNote = new DeleteNote(noteRepo)

      await expect(deleteNote.execute({ id: 9999 })).rejects.toThrow(
        NoteNotFoundError
      )

      await expect(deleteNote.execute({ id: 9999 })).rejects.toThrow(
        'Nota con ID 9999 no encontrada.'
      )
    })
  })
})

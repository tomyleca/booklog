import { Note } from '../entities/Note.js'

export interface NoteRepository {
  findByBookId(bookId: number): Promise<Note[]>
  findById(id: number): Promise<Note | null>
  create(note: Note): Promise<Note>
  update(note: Note): Promise<Note>
  delete(id: number): Promise<void>
}

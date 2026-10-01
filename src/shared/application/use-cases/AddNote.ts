import type { BookRepository } from '../../domain/ports/BookRepository.js'
import type { NoteRepository } from '../../domain/ports/NoteRepository.js'
import { Note } from '../../domain/entities/Note.js'
import { BookNotFoundError } from '../errors/BookNotFoundError.js'

export interface AddNoteDTO {
  bookId: number
  content: string
}

export class AddNote {
  constructor(
    private readonly bookRepository: BookRepository,
    private readonly noteRepository: NoteRepository
  ) {}

  public async execute(dto: AddNoteDTO): Promise<Note> {
    const book = await this.bookRepository.findById(dto.bookId)
    if (!book) {
      throw new BookNotFoundError(dto.bookId)
    }

    const note = Note.create({
      bookId: dto.bookId,
      content: dto.content
    })

    return await this.noteRepository.create(note)
  }
}

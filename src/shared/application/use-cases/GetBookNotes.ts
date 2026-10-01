import type { BookRepository } from '../../domain/ports/BookRepository.js'
import type { NoteRepository } from '../../domain/ports/NoteRepository.js'
import type { Note } from '../../domain/entities/Note.js'
import { BookNotFoundError } from '../errors/BookNotFoundError.js'

export interface GetBookNotesDTO {
  bookId: number
}

export class GetBookNotes {
  constructor(
    private readonly bookRepository: BookRepository,
    private readonly noteRepository: NoteRepository
  ) {}

  public async execute(dto: GetBookNotesDTO): Promise<Note[]> {
    const book = await this.bookRepository.findById(dto.bookId)
    if (!book) {
      throw new BookNotFoundError(dto.bookId)
    }

    return await this.noteRepository.findByBookId(dto.bookId)
  }
}

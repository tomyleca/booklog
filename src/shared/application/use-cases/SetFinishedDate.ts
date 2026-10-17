import { Book } from '../../domain/index.js'
import type { BookRepository } from '../../domain/ports/BookRepository.js'
import { BookNotFoundError } from '../errors/BookNotFoundError.js'

export interface SetFinishedDateDTO {
  id: number
  /** Día en que se terminó el libro, en formato `YYYY-MM-DD`. */
  finishedAt: string
}

export class SetFinishedDate {
  constructor(private readonly bookRepository: BookRepository) {}

  public async execute(dto: SetFinishedDateDTO): Promise<Book> {
    const finishedAt = Book.parseFinishedDate(dto.finishedAt)

    const book = await this.bookRepository.findById(dto.id)
    if (!book) {
      throw new BookNotFoundError(dto.id)
    }

    book.setFinishedDate(finishedAt)
    return await this.bookRepository.update(book)
  }
}

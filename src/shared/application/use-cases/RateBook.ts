import type { Book } from '../../domain/index.js'
import type { BookRepository } from '../../domain/ports/BookRepository.js'
import { BookNotFoundError } from '../errors/BookNotFoundError.js'

export interface RateBookDTO {
  id: number
  rating?: number | null
}

export class RateBook {
  constructor(private readonly bookRepository: BookRepository) {}

  public async execute(dto: RateBookDTO): Promise<Book> {
    const book = await this.bookRepository.findById(dto.id)
    if (!book) {
      throw new BookNotFoundError(dto.id)
    }

    book.updateRating(dto.rating)
    return await this.bookRepository.update(book)
  }
}

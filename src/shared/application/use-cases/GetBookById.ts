import type { Book } from '../../domain/index.js'
import type { BookRepository } from '../../domain/ports/BookRepository.js'
import { BookNotFoundError } from '../errors/BookNotFoundError.js'

export interface GetBookByIdDTO {
  id: number
}

export class GetBookById {
  constructor(private readonly bookRepository: BookRepository) {}

  public async execute(dto: GetBookByIdDTO): Promise<Book> {
    const book = await this.bookRepository.findById(dto.id)
    if (!book) {
      throw new BookNotFoundError(dto.id)
    }

    return book
  }
}

import type { Book, BookStatus } from '../../domain/index.js'
import type { BookRepository } from '../../domain/ports/BookRepository.js'
import { BookNotFoundError } from '../errors/BookNotFoundError.js'

export interface UpdateBookStatusDTO {
  id: number
  status: BookStatus
}

export class UpdateBookStatus {
  constructor(private readonly bookRepository: BookRepository) {}

  public async execute(dto: UpdateBookStatusDTO): Promise<Book> {
    const book = await this.bookRepository.findById(dto.id)
    if (!book) {
      throw new BookNotFoundError(dto.id)
    }

    book.updateStatus(dto.status)
    return await this.bookRepository.update(book)
  }
}

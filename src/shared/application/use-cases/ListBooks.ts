import type { Book, BookStatus } from '../../domain/index.js'
import type { BookRepository } from '../../domain/ports/BookRepository.js'

export interface ListBooksDTO {
  status?: BookStatus
}

export class ListBooks {
  constructor(private readonly bookRepository: BookRepository) {}

  public async execute(dto?: ListBooksDTO): Promise<Book[]> {
    if (dto?.status) {
      return await this.bookRepository.findByStatus(dto.status)
    }
    return await this.bookRepository.findAll()
  }
}

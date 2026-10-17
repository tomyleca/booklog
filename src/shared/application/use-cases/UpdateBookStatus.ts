import { Book, type BookStatus } from '../../domain/index.js'
import type { BookRepository } from '../../domain/ports/BookRepository.js'
import { BookNotFoundError } from '../errors/BookNotFoundError.js'

export interface UpdateBookStatusDTO {
  id: number
  status: BookStatus
  /** Día en que se terminó (`YYYY-MM-DD`). Sólo con status FINISHED; si se omite, hoy. */
  finishedAt?: string
}

export class UpdateBookStatus {
  constructor(private readonly bookRepository: BookRepository) {}

  public async execute(dto: UpdateBookStatusDTO): Promise<Book> {
    const book = await this.bookRepository.findById(dto.id)
    if (!book) {
      throw new BookNotFoundError(dto.id)
    }

    const finishedAt =
      dto.finishedAt !== undefined ? Book.parseFinishedDate(dto.finishedAt) : undefined
    book.updateStatus(dto.status, finishedAt)
    return await this.bookRepository.update(book)
  }
}

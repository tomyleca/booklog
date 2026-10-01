import { BookStatus, InvalidProgressError, type Book } from '../../domain/index.js'
import type { BookRepository } from '../../domain/ports/BookRepository.js'
import { BookNotFoundError } from '../errors/BookNotFoundError.js'

export interface UpdateBookProgressDTO {
  id: number
  page?: number
  percentage?: number
}

export class UpdateBookProgress {
  constructor(private readonly bookRepository: BookRepository) {}

  public async execute(dto: UpdateBookProgressDTO): Promise<Book> {
    const book = await this.bookRepository.findById(dto.id)
    if (!book) {
      throw new BookNotFoundError(dto.id)
    }

    if (dto.page !== undefined && dto.page !== null) {
      book.updateProgressByPage(dto.page)
    } else if (dto.percentage !== undefined && dto.percentage !== null) {
      book.updateProgressByPercentage(dto.percentage)
    } else {
      throw new InvalidProgressError('Debe proporcionar "page" o "percentage" para actualizar el progreso.')
    }

    const reachedHundredPercent = book.progressPercentage === 100
    const reachedLastPage =
      book.pageCount !== null &&
      book.pageCount !== undefined &&
      book.pageCount > 0 &&
      book.currentPage === book.pageCount

    if (reachedHundredPercent || reachedLastPage) {
      book.updateStatus(BookStatus.FINISHED)
    }

    return await this.bookRepository.update(book)
  }
}

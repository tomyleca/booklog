import type { BookRepository } from '../../domain/ports/BookRepository.js'
import { BookNotFoundError } from '../errors/BookNotFoundError.js'

export interface DeleteBookDTO {
  id: number
}

export class DeleteBook {
  constructor(private readonly bookRepository: BookRepository) {}

  public async execute(dto: DeleteBookDTO): Promise<void> {
    const book = await this.bookRepository.findById(dto.id)
    if (!book) {
      throw new BookNotFoundError(dto.id)
    }

    await this.bookRepository.delete(dto.id)
  }
}

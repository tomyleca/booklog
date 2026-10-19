import type { BookRepository } from '../../domain/ports/BookRepository.js'
import type { HighlightRepository } from '../../domain/ports/HighlightRepository.js'
import type { Highlight } from '../../domain/entities/Highlight.js'
import { BookNotFoundError } from '../errors/BookNotFoundError.js'

export interface GetBookHighlightsDTO {
  bookId: number
}

export class GetBookHighlights {
  constructor(
    private readonly bookRepository: BookRepository,
    private readonly highlightRepository: HighlightRepository
  ) {}

  public async execute(dto: GetBookHighlightsDTO): Promise<Highlight[]> {
    const book = await this.bookRepository.findById(dto.bookId)
    if (!book) {
      throw new BookNotFoundError(dto.bookId)
    }

    return await this.highlightRepository.findByBookId(dto.bookId)
  }
}

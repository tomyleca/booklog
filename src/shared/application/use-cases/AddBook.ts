import { Book, type BookStatus } from '../../domain/index.js'
import type { BookRepository } from '../../domain/ports/BookRepository.js'

export interface AddBookDTO {
  title: string
  authors: string | string[]
  coverUrl?: string | null
  coverPath?: string | null
  pageCount?: number | null
  currentPage?: number | null
  progressPercentage?: number | null
  isbn?: string | null
  status?: BookStatus
  rating?: number | null
  googleBooksId?: string | null
  /** Día en que se terminó (`YYYY-MM-DD`). Sólo aplica si `status` es FINISHED; por defecto, hoy. */
  finishedAt?: string | null
}

export class AddBook {
  constructor(private readonly bookRepository: BookRepository) {}

  public async execute(dto: AddBookDTO): Promise<Book> {
    const authors = Array.isArray(dto.authors)
      ? dto.authors.map((a) => a.trim()).filter(Boolean).join(', ')
      : dto.authors

    const book = Book.create({
      title: dto.title,
      authors: authors || 'Desconocido',
      coverUrl: dto.coverUrl,
      coverPath: dto.coverPath,
      pageCount: dto.pageCount,
      currentPage: dto.currentPage,
      progressPercentage: dto.progressPercentage,
      isbn: dto.isbn,
      status: dto.status,
      rating: dto.rating,
      googleBooksId: dto.googleBooksId,
      finishedAt: dto.finishedAt ? Book.parseFinishedDate(dto.finishedAt) : null
    })

    return await this.bookRepository.create(book)
  }
}

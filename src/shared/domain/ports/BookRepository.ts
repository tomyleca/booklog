import { Book } from '../entities/Book.js'
import { BookStatus } from '../entities/BookStatus.js'

export interface BookRepository {
  findAll(): Promise<Book[]>
  findById(id: number): Promise<Book | null>
  findByStatus(status: BookStatus): Promise<Book[]>
  create(book: Book): Promise<Book>
  update(book: Book): Promise<Book>
  delete(id: number): Promise<void>
}

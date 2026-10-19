import type { BookRepository } from '../../domain/ports/BookRepository.js'
import type { KindleMatchCandidate } from '../../domain/services/kindle/matchKindleBook.js'

/** Libros de la biblioteca en la forma que necesita `matchKindleBook`. */
export async function loadKindleMatchCandidates(
  bookRepository: BookRepository
): Promise<KindleMatchCandidate[]> {
  const books = await bookRepository.findAll()
  return books
    .filter((book) => book.id !== undefined)
    .map((book) => ({
      id: book.id as number,
      title: book.title,
      authors: book.authors,
      isbn: book.isbn ?? null
    }))
}

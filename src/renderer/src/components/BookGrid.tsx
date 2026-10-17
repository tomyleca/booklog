import type { BookPrimitives } from '../../../shared/infrastructure/ipc/contracts.js'
import { BookCard } from './BookCard.js'

export interface BookGridProps {
  books: BookPrimitives[]
  onBookClick?: (book: BookPrimitives) => void
}

/*
 * Estantería responsive: `auto-fill` decide cuántos libros entran por estante según
 * el ancho, y `gap-x-0` hace que los tramos de estante de cada celda se toquen.
 */
export function BookGrid({ books, onBookClick }: BookGridProps): JSX.Element {
  return (
    <div
      className="bookshelf grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-x-0 gap-y-10 pt-2 pb-6"
      data-testid="book-grid"
    >
      {books.map((book) => (
        <BookCard
          key={book.id ?? `${book.title}-${book.authors}`}
          book={book}
          onClick={onBookClick}
        />
      ))}
    </div>
  )
}

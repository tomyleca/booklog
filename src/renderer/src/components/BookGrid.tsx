import type { BookPrimitives } from '../../../shared/infrastructure/ipc/contracts.js'
import { BookCard } from './BookCard.js'

export interface BookGridProps {
  books: BookPrimitives[]
  onBookClick?: (book: BookPrimitives) => void
}

export function BookGrid({ books, onBookClick }: BookGridProps): JSX.Element {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
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

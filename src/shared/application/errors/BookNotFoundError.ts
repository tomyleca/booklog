export class BookNotFoundError extends Error {
  public readonly bookId: number

  constructor(bookId: number) {
    super(`Libro con ID ${bookId} no encontrado.`)
    this.name = 'BookNotFoundError'
    this.bookId = bookId

    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BookNotFoundError)
    }
  }
}

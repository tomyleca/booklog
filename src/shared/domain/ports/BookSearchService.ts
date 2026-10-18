export interface BookSearchResult {
  googleBooksId?: string | null
  title: string
  authors: string[]
  description?: string | null
  publisher?: string | null
  publishedDate?: string | null
  pageCount?: number | null
  coverUrl?: string | null
  isbn?: string | null
}

export interface BookSearchService {
  /**
   * Busca libros por texto libre y, opcionalmente, por autor. Basta con uno de los dos:
   * si ambos están vacíos devuelve `[]` sin consultar la fuente externa.
   */
  searchByQuery(query: string, author?: string | null): Promise<BookSearchResult[]>
}

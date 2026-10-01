import type {
  BookSearchResult,
  BookSearchService
} from '../../domain/ports/BookSearchService.js'

interface GoogleBooksVolumeItem {
  id?: string
  volumeInfo?: {
    title?: string
    authors?: string[]
    description?: string
    publisher?: string
    publishedDate?: string
    pageCount?: number
    imageLinks?: {
      smallThumbnail?: string
      thumbnail?: string
    }
    industryIdentifiers?: Array<{
      type?: string
      identifier?: string
    }>
  }
}

interface GoogleBooksApiResponse {
  kind?: string
  totalItems?: number
  items?: GoogleBooksVolumeItem[]
}

export class GoogleBooksService implements BookSearchService {
  private readonly baseUrl = 'https://www.googleapis.com/books/v1/volumes'

  constructor(
    private readonly fetchFn: typeof fetch = fetch,
    private readonly apiKeyProvider?: (() => string | null | undefined) | string | null
  ) {}

  public async searchByQuery(query: string): Promise<BookSearchResult[]> {
    const trimmed = query.trim()
    if (!trimmed) {
      return []
    }

    let url = `${this.baseUrl}?q=${encodeURIComponent(trimmed)}&maxResults=20`
    const resolvedKey =
      typeof this.apiKeyProvider === 'function'
        ? this.apiKeyProvider()
        : this.apiKeyProvider ?? (typeof process !== 'undefined' ? process.env?.GOOGLE_BOOKS_API_KEY : undefined)

    if (resolvedKey && resolvedKey.trim()) {
      url += `&key=${encodeURIComponent(resolvedKey.trim())}`
    }

    const res = await this.fetchFn(url)

    if (!res.ok) {
      throw new Error(`Error en la consulta a Google Books API: HTTP ${res.status} ${res.statusText}`)
    }

    const data = (await res.json()) as GoogleBooksApiResponse

    if (!data.items || !Array.isArray(data.items)) {
      return []
    }

    return data.items.map((item) => this.mapVolumeToResult(item))
  }

  private mapVolumeToResult(item: GoogleBooksVolumeItem): BookSearchResult {
    const volumeInfo = item.volumeInfo ?? {}

    // Title sanitization
    const rawTitle = typeof volumeInfo.title === 'string' ? volumeInfo.title.trim() : ''
    const title = rawTitle || 'Sin título'

    // Authors sanitization
    const authors = Array.isArray(volumeInfo.authors)
      ? volumeInfo.authors.map((a) => (typeof a === 'string' ? a.trim() : '')).filter(Boolean)
      : []

    // 4-digit year extraction from publishedDate
    let publishedYear: string | null = null
    if (typeof volumeInfo.publishedDate === 'string') {
      const match = volumeInfo.publishedDate.match(/\d{4}/)
      publishedYear = match ? match[0] : null
    }

    // Page count validation
    const pageCount =
      typeof volumeInfo.pageCount === 'number' && volumeInfo.pageCount > 0
        ? Math.floor(volumeInfo.pageCount)
        : null

    // Thumbnail URL sanitization: prefer thumbnail over smallThumbnail, enforce https://
    const rawCover = volumeInfo.imageLinks?.thumbnail || volumeInfo.imageLinks?.smallThumbnail || null
    const coverUrl = rawCover ? rawCover.replace(/^http:\/\//i, 'https://') : null

    // ISBN extraction: prefer ISBN_13 over ISBN_10
    const identifiers = volumeInfo.industryIdentifiers ?? []
    const isbn13 = identifiers.find((id) => id.type === 'ISBN_13')?.identifier
    const isbn10 = identifiers.find((id) => id.type === 'ISBN_10')?.identifier
    const isbn = (isbn13 || isbn10 || '').trim() || null

    return {
      googleBooksId: item.id ?? null,
      title,
      authors,
      description: volumeInfo.description ?? null,
      publisher: volumeInfo.publisher ?? null,
      publishedDate: publishedYear,
      pageCount,
      coverUrl,
      isbn
    }
  }
}

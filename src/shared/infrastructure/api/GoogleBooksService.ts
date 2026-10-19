import type {
  BookSearchResult,
  BookSearchService
} from '../../domain/ports/BookSearchService.js'
import { mergeSearchResults } from '../../domain/services/mergeSearchResults.js'
import { rankSearchResults } from '../../domain/services/rankSearchResults.js'
import { SearchServiceUnavailableError } from '../../domain/errors/BookSearchErrors.js'
import { classifyGoogleBooksError, pickMostRelevantError } from './classifyGoogleBooksError.js'
import { fetchWithRetry, resolveRetryOptions } from './fetchWithRetry.js'
import type { RetryOptions } from './fetchWithRetry.js'

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

export const GOOGLE_BOOKS_MAX_RESULTS = 40

export interface GoogleBooksServiceOptions {
  /** Ajustes de reintento; los tests inyectan `sleep`, `random` y `now`. */
  retry?: Partial<RetryOptions>
}

export class GoogleBooksService implements BookSearchService {
  private readonly baseUrl = 'https://www.googleapis.com/books/v1/volumes'
  private readonly retryOptions: RetryOptions

  constructor(
    private readonly fetchFn: typeof fetch = fetch,
    private readonly apiKeyProvider?: (() => string | null | undefined) | string | null,
    options: GoogleBooksServiceOptions = {}
  ) {
    this.retryOptions = resolveRetryOptions(options.retry)
  }

  /**
   * Lanza en paralelo una consulta libre y otra con operadores de campo
   * (`intitle:` / `inauthor:`), combina ambas sin duplicados y delega el orden final en
   * el ranking de dominio. Si sólo una de las dos falla, se usan los resultados de la
   * otra; si fallan ambas, se propaga el error tipado más informativo (ADR 027). Cada
   * consulta reintenta por su cuenta los fallos transitorios.
   */
  public async searchByQuery(query: string, author?: string | null): Promise<BookSearchResult[]> {
    const text = typeof query === 'string' ? query.trim() : ''
    const authorText = typeof author === 'string' ? author.trim() : ''
    if (!text && !authorText) {
      return []
    }

    const [freeOutcome, fieldedOutcome] = await Promise.allSettled([
      this.fetchVolumes(this.buildFreeQuery(text, authorText)),
      this.fetchVolumes(this.buildFieldedQuery(text, authorText))
    ])

    if (freeOutcome.status === 'rejected' && fieldedOutcome.status === 'rejected') {
      throw pickMostRelevantError([freeOutcome.reason, fieldedOutcome.reason])
    }

    const freeResults = freeOutcome.status === 'fulfilled' ? freeOutcome.value : []
    const fieldedResults = fieldedOutcome.status === 'fulfilled' ? fieldedOutcome.value : []

    return rankSearchResults(mergeSearchResults(fieldedResults, freeResults), {
      query: text,
      author: authorText || null
    })
  }

  private buildFreeQuery(text: string, author: string): string {
    return [text, author].filter(Boolean).join(' ')
  }

  private buildFieldedQuery(text: string, author: string): string {
    // Las comillas internas romperían la frase exacta del operador de campo.
    const quoted = (value: string): string => `"${value.replace(/"/g, ' ').trim()}"`
    const parts: string[] = []
    if (text) parts.push(`intitle:${quoted(text)}`)
    if (author) parts.push(`inauthor:${quoted(author)}`)
    return parts.join(' ')
  }

  private resolveApiKey(): string | null | undefined {
    return typeof this.apiKeyProvider === 'function'
      ? this.apiKeyProvider()
      : this.apiKeyProvider ??
          (typeof process !== 'undefined' ? process.env?.GOOGLE_BOOKS_API_KEY : undefined)
  }

  private async fetchVolumes(q: string): Promise<BookSearchResult[]> {
    let url =
      `${this.baseUrl}?q=${encodeURIComponent(q)}` +
      `&printType=books&maxResults=${GOOGLE_BOOKS_MAX_RESULTS}`
    const resolvedKey = this.resolveApiKey()

    if (resolvedKey && resolvedKey.trim()) {
      url += `&key=${encodeURIComponent(resolvedKey.trim())}`
    }

    let res: Response
    try {
      res = await fetchWithRetry(this.fetchFn, url, this.retryOptions)
    } catch {
      throw new SearchServiceUnavailableError()
    }

    if (!res.ok) {
      throw classifyGoogleBooksError(res.status, await this.readErrorBody(res))
    }

    const data = (await res.json()) as GoogleBooksApiResponse

    if (!data.items || !Array.isArray(data.items)) {
      return []
    }

    return data.items.map((item) => this.mapVolumeToResult(item))
  }

  private async readErrorBody(res: Response): Promise<unknown> {
    try {
      return await res.json()
    } catch {
      return null
    }
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

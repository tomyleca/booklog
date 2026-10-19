import type {
  BookSearchResult,
  BookSearchService
} from '../../domain/ports/BookSearchService.js'

export interface CachedBookSearchOptions {
  ttlMs?: number
  maxEntries?: number
  now?: () => number
}

export const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000
export const SEARCH_CACHE_MAX_ENTRIES = 50

interface CacheEntry {
  expiresAt: number
  results: BookSearchResult[]
}

function normalizeKeyPart(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toLowerCase() : ''
}

/**
 * Decorador del port con caché en memoria (feature #27, ADR 027). La clave es texto + autor
 * normalizados (espacios y mayúsculas no cuentan); sólo se guardan respuestas exitosas, con
 * TTL y un máximo de entradas que descarta la usada hace más tiempo (LRU).
 */
export class CachedBookSearchService implements BookSearchService {
  private readonly entries = new Map<string, CacheEntry>()
  private readonly ttlMs: number
  private readonly maxEntries: number
  private readonly now: () => number

  constructor(
    private readonly inner: BookSearchService,
    options: CachedBookSearchOptions = {}
  ) {
    this.ttlMs = options.ttlMs ?? SEARCH_CACHE_TTL_MS
    this.maxEntries = Math.max(1, options.maxEntries ?? SEARCH_CACHE_MAX_ENTRIES)
    this.now = options.now ?? Date.now
  }

  public async searchByQuery(query: string, author?: string | null): Promise<BookSearchResult[]> {
    const key = `${normalizeKeyPart(query)}\u0000${normalizeKeyPart(author)}`
    const cached = this.entries.get(key)
    if (cached) {
      this.entries.delete(key)
      if (cached.expiresAt > this.now()) {
        this.entries.set(key, cached)
        return cached.results
      }
    }

    const results =
      author === undefined
        ? await this.inner.searchByQuery(query)
        : await this.inner.searchByQuery(query, author)
    this.store(key, results)
    return results
  }

  /** Cantidad de entradas guardadas (incluye vencidas aún no consultadas). */
  public get size(): number {
    return this.entries.size
  }

  private store(key: string, results: BookSearchResult[]): void {
    this.entries.set(key, { expiresAt: this.now() + this.ttlMs, results })
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value
      if (oldest === undefined) break
      this.entries.delete(oldest)
    }
  }
}

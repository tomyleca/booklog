import { describe, it, expect, vi } from 'vitest'
import { GoogleBooksService } from '../../src/shared/infrastructure/api/GoogleBooksService.js'
import { SearchServiceUnavailableError } from '../../src/shared/domain/errors/BookSearchErrors.js'

describe('GoogleBooksService Unit Tests', () => {
  it('returns empty array when query is empty or only whitespace without calling fetch', async () => {
    const fetchMock = vi.fn()
    const service = new GoogleBooksService(fetchMock as unknown as typeof fetch)

    const resEmpty = await service.searchByQuery('')
    const resWhitespace = await service.searchByQuery('   ')

    expect(resEmpty).toEqual([])
    expect(resWhitespace).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('calls Google Books API with encoded query, printType=books and maxResults=40', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ kind: 'books#volumes', totalItems: 0, items: [] })
    })
    const service = new GoogleBooksService(fetchMock as unknown as typeof fetch)

    await service.searchByQuery('Cien Años')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const calledUrls = fetchMock.mock.calls.map((call) => call[0] as string)
    for (const calledUrl of calledUrls) {
      expect(calledUrl).toContain('https://www.googleapis.com/books/v1/volumes')
      expect(calledUrl).toContain('printType=books')
      expect(calledUrl).toContain('maxResults=40')
    }
    expect(calledUrls).toContain(
      'https://www.googleapis.com/books/v1/volumes?q=Cien%20A%C3%B1os&printType=books&maxResults=40'
    )
  })

  it('throws a typed unavailable error when HTTP response keeps failing with 500', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    })
    const service = new GoogleBooksService(fetchMock as unknown as typeof fetch, null, {
      retry: { sleep: async () => {} }
    })

    await expect(service.searchByQuery('Clean Code')).rejects.toBeInstanceOf(
      SearchServiceUnavailableError
    )
  })

  it('returns empty array when Google Books API returns no items field', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ kind: 'books#volumes', totalItems: 0 })
    })
    const service = new GoogleBooksService(fetchMock as unknown as typeof fetch)

    const results = await service.searchByQuery('LibroInexistenteXYZ123')
    expect(results).toEqual([])
  })

  it('correctly maps and sanitizes items with full data', async () => {
    const mockApiResponse = {
      kind: 'books#volumes',
      totalItems: 1,
      items: [
        {
          id: 'gb_id_123',
          volumeInfo: {
            title: '  Cien Años de Soledad  ',
            authors: [' Gabriel García Márquez ', '  '],
            description: 'Novela cumbre del realismo mágico.',
            publisher: 'Sudamericana',
            publishedDate: '1967-05-30',
            pageCount: 471,
            imageLinks: {
              smallThumbnail: 'http://books.google.com/cover-small.jpg',
              thumbnail: 'http://books.google.com/cover-standard.jpg'
            },
            industryIdentifiers: [
              { type: 'ISBN_10', identifier: '0307474720' },
              { type: 'ISBN_13', identifier: '9780307474728' }
            ]
          }
        }
      ]
    }

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse
    })
    const service = new GoogleBooksService(fetchMock as unknown as typeof fetch)

    const results = await service.searchByQuery('Cien Años')

    expect(results).toHaveLength(1)
    const book = results[0]
    expect(book.googleBooksId).toBe('gb_id_123')
    expect(book.title).toBe('Cien Años de Soledad')
    expect(book.authors).toEqual(['Gabriel García Márquez'])
    expect(book.description).toBe('Novela cumbre del realismo mágico.')
    expect(book.publisher).toBe('Sudamericana')
    expect(book.publishedDate).toBe('1967')
    expect(book.pageCount).toBe(471)
    // Enforces HTTPS and prefers standard thumbnail
    expect(book.coverUrl).toBe('https://books.google.com/cover-standard.jpg')
    // Prefers ISBN_13 over ISBN_10
    expect(book.isbn).toBe('9780307474728')
  })

  it('falls back to smallThumbnail when thumbnail is absent and enforces HTTPS', async () => {
    const mockApiResponse = {
      items: [
        {
          id: 'test_fallback',
          volumeInfo: {
            title: 'Rayuela',
            imageLinks: {
              smallThumbnail: 'http://books.google.com/small.jpg'
            }
          }
        }
      ]
    }

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse
    })
    const service = new GoogleBooksService(fetchMock as unknown as typeof fetch)

    const results = await service.searchByQuery('Rayuela')
    expect(results[0].coverUrl).toBe('https://books.google.com/small.jpg')
  })

  it('falls back to ISBN_10 when ISBN_13 is absent', async () => {
    const mockApiResponse = {
      items: [
        {
          id: 'isbn10_only',
          volumeInfo: {
            title: 'Ficciones',
            industryIdentifiers: [{ type: 'ISBN_10', identifier: '0811216670' }]
          }
        }
      ]
    }

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse
    })
    const service = new GoogleBooksService(fetchMock as unknown as typeof fetch)

    const results = await service.searchByQuery('Ficciones')
    expect(results[0].isbn).toBe('0811216670')
  })

  it('extracts 4-digit year from publishedDate when given as only year', async () => {
    const mockApiResponse = {
      items: [
        {
          id: 'year_only',
          volumeInfo: {
            title: 'El Aleph',
            publishedDate: '1949'
          }
        }
      ]
    }

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse
    })
    const service = new GoogleBooksService(fetchMock as unknown as typeof fetch)

    const results = await service.searchByQuery('El Aleph')
    expect(results[0].publishedDate).toBe('1949')
  })

  it('handles missing or malformed optional fields safely', async () => {
    const mockApiResponse = {
      items: [
        {
          // id missing
          volumeInfo: {
            // title missing
            authors: undefined,
            pageCount: -10, // invalid pageCount
            publishedDate: 'invalid-date',
            imageLinks: undefined,
            industryIdentifiers: undefined
          }
        }
      ]
    }

    // Los resultados sin id no se deduplican: sólo la consulta libre devuelve el item.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockApiResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) })
    const service = new GoogleBooksService(fetchMock as unknown as typeof fetch)

    const results = await service.searchByQuery('Test')
    expect(results).toHaveLength(1)
    const book = results[0]
    expect(book.googleBooksId).toBeNull()
    expect(book.title).toBe('Sin título')
    expect(book.authors).toEqual([])
    expect(book.pageCount).toBeNull()
    expect(book.publishedDate).toBeNull()
    expect(book.coverUrl).toBeNull()
    expect(book.isbn).toBeNull()
    expect(book.description).toBeNull()
    expect(book.publisher).toBeNull()
  })

  it('appends &key parameter when apiKey is configured as string', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] })
    })
    const service = new GoogleBooksService(fetchMock as unknown as typeof fetch, 'MY_SECRET_KEY_123')

    await service.searchByQuery('Borges')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    for (const call of fetchMock.mock.calls) {
      expect(call[0] as string).toContain('&key=MY_SECRET_KEY_123')
    }
  })

  it('appends &key parameter when apiKeyProvider function returns a key', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] })
    })
    const service = new GoogleBooksService(
      fetchMock as unknown as typeof fetch,
      () => 'DYNAMIC_KEY_456'
    )

    await service.searchByQuery('Cortázar')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    for (const call of fetchMock.mock.calls) {
      expect(call[0] as string).toContain('&key=DYNAMIC_KEY_456')
    }
  })
})

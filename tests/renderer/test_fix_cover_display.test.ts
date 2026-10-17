// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react'
import { renderHook, act } from '@testing-library/react'
import React from 'react'
import { readFileSync } from 'fs'
import { join } from 'path'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BookCard } from '../../src/renderer/src/components/BookCard.js'
import { BookDetailPage } from '../../src/renderer/src/pages/BookDetailPage.js'
import { DashboardPage } from '../../src/renderer/src/pages/DashboardPage.js'
import { useCoverSource } from '../../src/renderer/src/hooks/useCoverSource.js'
import { buildCoverCandidates } from '../../src/renderer/src/services/coverService.js'
import { BookStatus } from '../../src/shared/domain/entities/BookStatus.js'
import type { BookPrimitives } from '../../src/shared/infrastructure/ipc/contracts.js'

const h = React.createElement
const ROOT = join(__dirname, '../..')

const LOCAL_SRC = 'booklog-media://covers/abc.jpg'
const REMOTE_SRC = 'https://books.google.com/cover.jpg'

const bookWithBothCovers: BookPrimitives = {
  id: 7,
  googleBooksId: 'gb-7',
  title: 'Hyperpolitics',
  authors: 'Anton Jäger',
  coverUrl: REMOTE_SRC,
  coverPath: 'covers/abc.jpg',
  pageCount: 200,
  currentPage: 50,
  progressPercentage: 25,
  isbn: null,
  status: BookStatus.READING,
  rating: null,
  createdAt: new Date('2026-01-01T10:00:00Z'),
  updatedAt: new Date('2026-01-02T10:00:00Z')
}

function readCspDirectives(): Map<string, string[]> {
  const html = readFileSync(join(ROOT, 'src/renderer/index.html'), 'utf-8')
  const match = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/)
  expect(match).not.toBeNull()
  const directives = new Map<string, string[]>()
  for (const part of (match?.[1] ?? '').split(';')) {
    const [name, ...sources] = part.trim().split(/\s+/)
    if (name) directives.set(name, sources)
  }
  return directives
}

function mockApi(book: BookPrimitives): void {
  window.api = {
    books: {
      list: vi.fn().mockResolvedValue({ success: true, data: [book] }),
      getById: vi.fn().mockResolvedValue({ success: true, data: book }),
      create: vi.fn(),
      updateStatus: vi.fn(),
      updateProgress: vi.fn(),
      rate: vi.fn(),
      delete: vi.fn()
    },
    notes: {
      getByBook: vi.fn().mockResolvedValue({ success: true, data: [] }),
      listByBook: vi.fn().mockResolvedValue({ success: true, data: [] }),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    covers: { saveFromUrl: vi.fn(), saveFromLocal: vi.fn() },
    search: { searchGoogleBooks: vi.fn() }
  } as unknown as typeof window.api
}

function renderWithClient(ui: React.ReactElement): ReturnType<typeof render> {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, gcTime: 0 } }
  })
  return render(h(QueryClientProvider, { client }, ui))
}

describe('Feature #19 - fix_cover_display', () => {
  beforeEach(() => {
    mockApi(bookWithBothCovers)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  describe('Content-Security-Policy', () => {
    it('should allow booklog-media: in img-src', () => {
      expect(readCspDirectives().get('img-src')).toContain('booklog-media:')
    })

    it('should not open any other image origin', () => {
      expect(readCspDirectives().get('img-src')).toEqual([
        "'self'",
        'data:',
        'https:',
        'booklog-media:'
      ])
    })

    it('should only mention booklog-media: in img-src', () => {
      const directives = readCspDirectives()
      for (const [name, sources] of directives) {
        if (name === 'img-src') continue
        expect(sources).not.toContain('booklog-media:')
      }
    })
  })

  describe('buildCoverCandidates', () => {
    it('should order local copy before remote url', () => {
      expect(buildCoverCandidates('covers/abc.jpg', REMOTE_SRC)).toEqual([LOCAL_SRC, REMOTE_SRC])
    })

    it('should return only the available candidate', () => {
      expect(buildCoverCandidates(null, REMOTE_SRC)).toEqual([REMOTE_SRC])
      expect(buildCoverCandidates('covers/abc.jpg', null)).toEqual([LOCAL_SRC])
    })

    it('should return an empty list when there is no cover', () => {
      expect(buildCoverCandidates(null, null)).toEqual([])
      expect(buildCoverCandidates('  ', '')).toEqual([])
    })

    it('should drop duplicated candidates', () => {
      expect(buildCoverCandidates(REMOTE_SRC, REMOTE_SRC)).toEqual([REMOTE_SRC])
    })
  })

  describe('useCoverSource', () => {
    it('should walk local -> remote -> null on successive errors', () => {
      const { result } = renderHook(() => useCoverSource('covers/abc.jpg', REMOTE_SRC))
      expect(result.current.src).toBe(LOCAL_SRC)
      act(() => result.current.onError())
      expect(result.current.src).toBe(REMOTE_SRC)
      act(() => result.current.onError())
      expect(result.current.src).toBeNull()
    })

    it('should restart the chain when the cover inputs change', () => {
      const { result, rerender } = renderHook(
        ({ path, url }: { path: string | null; url: string | null }) =>
          useCoverSource(path, url),
        { initialProps: { path: 'covers/abc.jpg', url: null as string | null } }
      )
      act(() => result.current.onError())
      expect(result.current.src).toBeNull()

      rerender({ path: 'covers/other.jpg', url: REMOTE_SRC })
      expect(result.current.src).toBe('booklog-media://covers/other.jpg')
    })
  })

  describe('BookCard (estantería)', () => {
    it('should fall back local -> remote -> placeholder', () => {
      render(h(BookCard, { book: bookWithBothCovers }))

      const local = screen.getByTestId('book-cover-image')
      expect(local.getAttribute('src')).toBe(LOCAL_SRC)

      fireEvent.error(local)
      const remote = screen.getByTestId('book-cover-image')
      expect(remote.getAttribute('src')).toBe(REMOTE_SRC)

      fireEvent.error(remote)
      expect(screen.queryByTestId('book-cover-image')).toBeNull()
      expect(screen.getByTestId('book-cover-placeholder')).toBeDefined()
    })
  })

  describe('BookDetailPage', () => {
    it('should fall back local -> remote -> placeholder', async () => {
      renderWithClient(h(BookDetailPage, { bookId: 7, onBack: vi.fn() }))

      const local = await screen.findByTestId('detail-cover-image')
      expect(local.getAttribute('src')).toBe(LOCAL_SRC)

      fireEvent.error(local)
      const remote = screen.getByTestId('detail-cover-image')
      expect(remote.getAttribute('src')).toBe(REMOTE_SRC)

      fireEvent.error(remote)
      await waitFor(() => {
        expect(screen.getByTestId('detail-cover-placeholder')).toBeDefined()
      })
      expect(screen.queryByTestId('detail-cover-image')).toBeNull()
    })
  })

  describe('DashboardPage (libros recientes)', () => {
    it('should fall back local -> remote -> placeholder', async () => {
      renderWithClient(h(DashboardPage, {}))

      const item = await screen.findByTestId('recent-book-item')
      const local = within(item).getByAltText('Hyperpolitics')
      expect(local.getAttribute('src')).toBe(LOCAL_SRC)

      fireEvent.error(local)
      const remote = within(item).getByAltText('Hyperpolitics')
      expect(remote.getAttribute('src')).toBe(REMOTE_SRC)

      fireEvent.error(remote)
      expect(within(item).queryByAltText('Hyperpolitics')).toBeNull()
    })
  })
})

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  DashboardPage,
  calculateBookPagesRead,
  sortRecentBooks
} from '../../src/renderer/src/pages/DashboardPage.js'
import { App } from '../../src/renderer/src/App.js'
import { bookService } from '../../src/renderer/src/services/bookService.js'
import { BookStatus } from '../../src/shared/domain/entities/BookStatus.js'
import type { BookPrimitives } from '../../src/shared/infrastructure/ipc/contracts.js'

const h = React.createElement

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
        gcTime: 0
      }
    }
  })
}

function renderWithClient(ui: React.ReactElement, client = createTestQueryClient()) {
  return render(h(QueryClientProvider, { client }, ui))
}

const sampleBooks: BookPrimitives[] = [
  {
    id: 1,
    title: 'El Quijote de la Mancha',
    authors: 'Miguel de Cervantes',
    coverUrl: 'https://example.com/quijote.jpg',
    coverPath: null,
    pageCount: 500,
    currentPage: 250,
    progressPercentage: 50,
    status: BookStatus.READING,
    rating: 4,
    createdAt: new Date('2026-01-01T10:00:00Z'),
    updatedAt: new Date('2026-01-05T12:00:00Z')
  },
  {
    id: 2,
    title: 'Cien Años de Soledad',
    authors: 'Gabriel García Márquez',
    coverUrl: null,
    coverPath: null,
    pageCount: 400,
    currentPage: 400,
    progressPercentage: 100,
    status: BookStatus.FINISHED,
    rating: 5,
    createdAt: new Date('2026-01-02T10:00:00Z'),
    updatedAt: new Date('2026-01-10T15:30:00Z')
  },
  {
    id: 3,
    title: 'Ficciones',
    authors: 'Jorge Luis Borges',
    coverUrl: null,
    coverPath: null,
    pageCount: 200,
    currentPage: 0,
    progressPercentage: 0,
    status: BookStatus.TO_READ,
    rating: null,
    createdAt: new Date('2026-01-03T10:00:00Z'),
    updatedAt: new Date('2026-01-03T10:00:00Z')
  },
  {
    id: 4,
    title: 'Rayuela',
    authors: 'Julio Cortázar',
    coverUrl: null,
    coverPath: null,
    pageCount: 600,
    currentPage: 150,
    progressPercentage: 25,
    status: BookStatus.PAUSED,
    rating: 3,
    createdAt: new Date('2026-01-04T10:00:00Z'),
    updatedAt: new Date('2026-01-08T11:00:00Z')
  },
  {
    id: 5,
    title: 'En busca del tiempo perdido',
    authors: 'Marcel Proust',
    coverUrl: null,
    coverPath: null,
    pageCount: 1000,
    currentPage: 100,
    progressPercentage: 10,
    status: BookStatus.ABANDONED,
    rating: 2,
    createdAt: new Date('2026-01-05T10:00:00Z'),
    updatedAt: new Date('2026-01-06T09:00:00Z')
  },
  {
    id: 6,
    title: 'Dune',
    authors: 'Frank Herbert',
    coverUrl: null,
    coverPath: null,
    pageCount: 800,
    currentPage: 0,
    progressPercentage: 40,
    status: BookStatus.READING,
    rating: null,
    createdAt: new Date('2026-01-06T10:00:00Z'),
    updatedAt: new Date('2026-01-09T18:00:00Z')
  }
]

describe('Feature #13 - UI Dashboard Stats (DashboardPage)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    ;(window as unknown as { api: unknown }).api = {
      books: {
        list: vi.fn().mockResolvedValue({ success: true, data: sampleBooks }),
        getById: vi.fn().mockResolvedValue({ success: true, data: sampleBooks[0] }),
        create: vi.fn(),
        updateStatus: vi.fn(),
        updateProgress: vi.fn(),
        rate: vi.fn(),
        delete: vi.fn()
      },
      covers: {
        saveFromUrl: vi.fn(),
        saveFromLocal: vi.fn()
      },
      notes: {
        listByBook: vi.fn().mockResolvedValue({ success: true, data: [] }),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn()
      }
    }
  })

  describe('Pages Read Calculation Unit Tests', () => {
    it('returns pageCount if book is FINISHED and pageCount is defined', () => {
      const book = {
        status: BookStatus.FINISHED,
        pageCount: 350,
        currentPage: 0,
        progressPercentage: 0
      }
      expect(calculateBookPagesRead(book)).toBe(350)
    })

    it('returns currentPage if currentPage is defined and > 0', () => {
      const book = {
        status: BookStatus.READING,
        pageCount: 500,
        currentPage: 125,
        progressPercentage: 25
      }
      expect(calculateBookPagesRead(book)).toBe(125)
    })

    it('calculates pages from percentage and pageCount if currentPage is 0 or undefined', () => {
      const book = {
        status: BookStatus.READING,
        pageCount: 300,
        currentPage: 0,
        progressPercentage: 50
      }
      expect(calculateBookPagesRead(book)).toBe(150)
    })

    it('returns 0 if book is TO_READ with currentPage 0', () => {
      const book = {
        status: BookStatus.TO_READ,
        pageCount: 300,
        currentPage: 0,
        progressPercentage: 0
      }
      expect(calculateBookPagesRead(book)).toBe(0)
    })

    it('returns 0 if neither currentPage nor progressPercentage is valid', () => {
      const book = {
        status: BookStatus.TO_READ,
        pageCount: null,
        currentPage: null,
        progressPercentage: null
      }
      expect(calculateBookPagesRead(book)).toBe(0)
    })
  })

  describe('sortRecentBooks Helper', () => {
    it('sorts books by updatedAt descending and limits to 5 items', () => {
      const sorted = sortRecentBooks(sampleBooks)
      expect(sorted).toHaveLength(5)
      // Newest updatedAt first:
      // Book 2: 2026-01-10
      // Book 6: 2026-01-09
      // Book 4: 2026-01-08
      // Book 5: 2026-01-06
      // Book 1: 2026-01-05
      expect(sorted[0].id).toBe(2)
      expect(sorted[1].id).toBe(6)
      expect(sorted[2].id).toBe(4)
      expect(sorted[3].id).toBe(5)
      expect(sorted[4].id).toBe(1)
    })
  })

  describe('KPIs and Metrics Rendering', () => {
    it('renders KPI values accurately from book list', async () => {
      vi.spyOn(bookService, 'list').mockResolvedValueOnce({
        success: true,
        data: sampleBooks
      })

      renderWithClient(h(DashboardPage))

      await waitFor(() => {
        expect(screen.queryByTestId('loading-state')).toBeNull()
      })

      expect(screen.getByTestId('dashboard-title').textContent).toBe('Dashboard de Lectura')

      // Finished books: 1 (Book 2)
      expect(screen.getByTestId('stat-finished-count').textContent).toBe('1')

      // Reading books: 2 (Book 1, Book 6)
      expect(screen.getByTestId('stat-reading-count').textContent).toBe('2')

      // Paused books: 1 (Book 4)
      expect(screen.getByTestId('stat-paused-count').textContent).toBe('1')

      // To read books: 1 (Book 3)
      expect(screen.getByTestId('stat-to-read-count').textContent).toBe('1')

      // Abandoned books: 1 (Book 5)
      expect(screen.getByTestId('stat-abandoned-count').textContent).toBe('1')

      // Total books: 6
      expect(screen.getByTestId('stat-total-books').textContent).toBe('Total: 6')

      // Total pages:
      // Book 1 (READING): currentPage = 250
      // Book 2 (FINISHED): pageCount = 400
      // Book 3 (TO_READ): 0
      // Book 4 (PAUSED): currentPage = 150
      // Book 5 (ABANDONED): currentPage = 100
      // Book 6 (READING): currentPage=0, progress=40%, pageCount=800 -> 320
      // Total = 250 + 400 + 0 + 150 + 100 + 320 = 1220 pages
      const totalPagesElement = screen.getByTestId('stat-total-pages')
      expect(totalPagesElement.textContent).toBe((1220).toLocaleString())
    })
  })

  describe('Status Distribution Breakdown', () => {
    it('renders status breakdown cards with counts and percentages', async () => {
      vi.spyOn(bookService, 'list').mockResolvedValueOnce({
        success: true,
        data: sampleBooks
      })

      renderWithClient(h(DashboardPage))

      await waitFor(() => {
        expect(screen.getByTestId('status-breakdown')).toBeDefined()
      })

      // Status card for FINISHED
      const finishedCard = screen.getByTestId('status-card-FINISHED')
      expect(finishedCard.textContent).toContain('Terminado')
      expect(finishedCard.textContent).toContain('1')
      expect(finishedCard.textContent).toContain('17%') // 1/6 = ~17%

      // Status card for READING
      const readingCard = screen.getByTestId('status-card-READING')
      expect(readingCard.textContent).toContain('Leyendo')
      expect(readingCard.textContent).toContain('2')
      expect(readingCard.textContent).toContain('33%') // 2/6 = ~33%

      // Distribution bar segments
      expect(screen.getByTestId('distribution-segment-FINISHED')).toBeDefined()
      expect(screen.getByTestId('distribution-segment-READING')).toBeDefined()
      expect(screen.getByTestId('distribution-segment-PAUSED')).toBeDefined()
      expect(screen.getByTestId('distribution-segment-TO_READ')).toBeDefined()
      expect(screen.getByTestId('distribution-segment-ABANDONED')).toBeDefined()
    })
  })

  describe('Recent Books List and Navigation', () => {
    it('displays up to 5 recent books with cover, title, author, badge and progress', async () => {
      vi.spyOn(bookService, 'list').mockResolvedValueOnce({
        success: true,
        data: sampleBooks
      })

      renderWithClient(h(DashboardPage))

      await waitFor(() => {
        expect(screen.getByTestId('recent-books-section')).toBeDefined()
      })

      const items = screen.getAllByTestId('recent-book-item')
      expect(items).toHaveLength(5)

      // First item should be the most recently updated (Cien Años de Soledad, book 2)
      expect(items[0].textContent).toContain('Cien Años de Soledad')
      expect(items[0].textContent).toContain('Gabriel García Márquez')
      expect(items[0].textContent).toContain('Terminado')
      expect(items[0].textContent).toContain('100%')

      // Second item should be Dune (book 6)
      expect(items[1].textContent).toContain('Dune')
      expect(items[1].textContent).toContain('Frank Herbert')
      expect(items[1].textContent).toContain('Leyendo')
      expect(items[1].textContent).toContain('40%')
    })

    it('triggers onSelectBook callback when a recent book is clicked', async () => {
      const onSelectBookSpy = vi.fn()
      vi.spyOn(bookService, 'list').mockResolvedValueOnce({
        success: true,
        data: sampleBooks
      })

      renderWithClient(h(DashboardPage, { onSelectBook: onSelectBookSpy }))

      await waitFor(() => {
        expect(screen.getByText('Cien Años de Soledad')).toBeDefined()
      })

      const items = screen.getAllByTestId('recent-book-item')
      fireEvent.click(items[0])

      expect(onSelectBookSpy).toHaveBeenCalledWith(2)
    })

    it('triggers onSelectBook when Enter key is pressed on a recent book', async () => {
      const onSelectBookSpy = vi.fn()
      vi.spyOn(bookService, 'list').mockResolvedValueOnce({
        success: true,
        data: sampleBooks
      })

      renderWithClient(h(DashboardPage, { onSelectBook: onSelectBookSpy }))

      await waitFor(() => {
        expect(screen.getByText('Dune')).toBeDefined()
      })

      const items = screen.getAllByTestId('recent-book-item')
      fireEvent.keyDown(items[1], { key: 'Enter' })

      expect(onSelectBookSpy).toHaveBeenCalledWith(6)
    })
  })

  describe('Empty, Loading and Error States', () => {
    it('renders empty dashboard state when library has no books', async () => {
      vi.spyOn(bookService, 'list').mockResolvedValueOnce({
        success: true,
        data: []
      })

      renderWithClient(h(DashboardPage))

      await waitFor(() => {
        expect(screen.getByTestId('empty-dashboard-state')).toBeDefined()
      })

      expect(screen.getByText('Aún no hay estadísticas disponibles')).toBeDefined()
      expect(screen.queryByTestId('kpis-grid')).toBeNull()
    })

    it('renders error state and refetches on retry click', async () => {
      const listSpy = vi.spyOn(bookService, 'list')
      listSpy.mockResolvedValueOnce({
        success: false,
        error: 'Fallo al consultar la base de datos'
      })

      renderWithClient(h(DashboardPage))

      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeDefined()
      })

      expect(screen.getByTestId('error-message').textContent).toContain('Fallo al consultar la base de datos')

      listSpy.mockResolvedValueOnce({
        success: true,
        data: sampleBooks
      })

      fireEvent.click(screen.getByTestId('retry-button'))

      await waitFor(() => {
        expect(screen.queryByTestId('error-state')).toBeNull()
      })
      expect(screen.getByTestId('kpis-grid')).toBeDefined()
    })

    it('refetches when the header refresh button is clicked', async () => {
      const listSpy = vi.spyOn(bookService, 'list').mockResolvedValue({
        success: true,
        data: sampleBooks
      })

      renderWithClient(h(DashboardPage))

      await waitFor(() => {
        expect(screen.getByTestId('kpis-grid')).toBeDefined()
      })

      expect(listSpy).toHaveBeenCalledTimes(1)

      fireEvent.click(screen.getByTestId('refresh-button'))

      await waitFor(() => {
        expect(listSpy).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('App Navigation with Dashboard Integration', () => {
    it('renders navigation bar with Biblioteca and Dashboard tabs', async () => {
      vi.spyOn(bookService, 'list').mockResolvedValue({
        success: true,
        data: sampleBooks
      })

      const testClient = createTestQueryClient()
      render(h(App, { queryClient: testClient }))

      expect(screen.getByTestId('app-navigation')).toBeDefined()
      expect(screen.getByTestId('nav-library-button')).toBeDefined()
      expect(screen.getByTestId('nav-dashboard-button')).toBeDefined()

      // Initially on Library
      await waitFor(() => {
        expect(screen.getByTestId('library-page')).toBeDefined()
      })
      expect(screen.queryByTestId('dashboard-page')).toBeNull()
    })

    it('switches to Dashboard view when clicking Dashboard nav button', async () => {
      vi.spyOn(bookService, 'list').mockResolvedValue({
        success: true,
        data: sampleBooks
      })

      const testClient = createTestQueryClient()
      render(h(App, { queryClient: testClient }))

      await waitFor(() => {
        expect(screen.getByTestId('library-page')).toBeDefined()
      })

      fireEvent.click(screen.getByTestId('nav-dashboard-button'))

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-page')).toBeDefined()
      })
      expect(screen.queryByTestId('library-page')).toBeNull()

      // Switch back to Library
      fireEvent.click(screen.getByTestId('nav-library-button'))

      await waitFor(() => {
        expect(screen.getByTestId('library-page')).toBeDefined()
      })
      expect(screen.queryByTestId('dashboard-page')).toBeNull()
    })

    it('navigates from Dashboard to BookDetailPage on recent book click, and returns to Dashboard onBack', async () => {
      vi.spyOn(bookService, 'list').mockResolvedValue({
        success: true,
        data: sampleBooks
      })
      vi.spyOn(bookService, 'getById').mockResolvedValue({
        success: true,
        data: sampleBooks[0]
      })

      const testClient = createTestQueryClient()
      render(h(App, { queryClient: testClient, initialView: { type: 'dashboard' } }))

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-page')).toBeDefined()
      })

      await waitFor(() => {
        expect(screen.getByText('Cien Años de Soledad')).toBeDefined()
      })

      // Click the first recent book (id: 2)
      const recentItems = screen.getAllByTestId('recent-book-item')
      fireEvent.click(recentItems[0])

      // Navigates to BookDetailPage
      await waitFor(() => {
        expect(screen.getByTestId('book-detail-page')).toBeDefined()
      })
      expect(screen.queryByTestId('dashboard-page')).toBeNull()

      // Click back button in BookDetailPage
      fireEvent.click(screen.getByTestId('back-button'))

      // Returns to DashboardPage
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-page')).toBeDefined()
      })
      expect(screen.queryByTestId('book-detail-page')).toBeNull()
    })
  })
})

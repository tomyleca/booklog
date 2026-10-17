// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BookStatus } from '../../src/shared/domain/entities/BookStatus.js'
import { todayIsoDate, toIsoDate } from '../../src/shared/domain/entities/CalendarDate.js'
import type { BookPrimitives } from '../../src/shared/infrastructure/ipc/contracts.js'
import { AddBookModal } from '../../src/renderer/src/components/AddBookModal.js'
import { UpdateProgressModal } from '../../src/renderer/src/components/UpdateProgressModal.js'
import { BookCard } from '../../src/renderer/src/components/BookCard.js'
import {
  defaultFinishedDateInput,
  formatFinishedDate,
  validateFinishedDateInput
} from '../../src/renderer/src/components/finishedDate.js'
import { BookDetailPage } from '../../src/renderer/src/pages/BookDetailPage.js'
import {
  DashboardPage,
  countFinishedInPeriod,
  sortRecentlyFinishedBooks
} from '../../src/renderer/src/pages/DashboardPage.js'
import { bookService } from '../../src/renderer/src/services/bookService.js'

const h = React.createElement

function renderWithClient(ui: React.ReactElement): ReturnType<typeof render> {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, gcTime: 0 },
      mutations: { retry: false }
    }
  })
  return render(h(QueryClientProvider, { client }, ui))
}

function tomorrowIso(): string {
  const now = new Date()
  return toIsoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12))
}

function localNoon(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12)
}

function makeBook(overrides: Partial<BookPrimitives>): BookPrimitives {
  return {
    id: 1,
    googleBooksId: null,
    title: 'Libro',
    authors: 'Autora',
    coverUrl: null,
    coverPath: null,
    pageCount: 300,
    currentPage: 0,
    progressPercentage: 0,
    isbn: null,
    status: BookStatus.READING,
    rating: null,
    finishedAt: null,
    createdAt: new Date('2026-01-01T10:00:00Z'),
    updatedAt: new Date('2026-01-01T10:00:00Z'),
    ...overrides
  }
}

const finishedBook = makeBook({
  id: 7,
  title: 'Los siete locos',
  authors: 'Roberto Arlt',
  status: BookStatus.FINISHED,
  currentPage: 300,
  progressPercentage: 100,
  finishedAt: localNoon(2026, 10, 3)
})

const readingBook = makeBook({
  id: 8,
  title: 'Zama',
  authors: 'Antonio Di Benedetto',
  currentPage: 100,
  progressPercentage: 33
})

function mockApi(detailBook: BookPrimitives = readingBook): void {
  window.api = {
    books: {
      list: vi.fn().mockResolvedValue({ success: true, data: [finishedBook, readingBook] }),
      getById: vi.fn().mockResolvedValue({ success: true, data: detailBook }),
      create: vi.fn().mockResolvedValue({ success: true, data: finishedBook }),
      updateStatus: vi.fn().mockResolvedValue({ success: true, data: finishedBook }),
      updateProgress: vi.fn().mockResolvedValue({
        success: true,
        data: { ...readingBook, status: BookStatus.FINISHED, progressPercentage: 100 }
      }),
      rate: vi.fn(),
      setFinishedDate: vi.fn().mockResolvedValue({ success: true, data: finishedBook }),
      delete: vi.fn()
    },
    notes: {
      getByBook: vi.fn().mockResolvedValue({ success: true, data: [] }),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    covers: {
      saveFromUrl: vi.fn(),
      saveFromLocal: vi.fn()
    },
    search: {
      books: vi.fn().mockResolvedValue({ success: true, data: [] })
    }
  } as unknown as typeof window.api
}

describe('Feature #20 — finished date in the renderer', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockApi()
  })

  afterEach(() => {
    cleanup()
  })

  describe('date helpers', () => {
    it('should format dates as es-AR dd/mm/yyyy', () => {
      expect(formatFinishedDate(localNoon(2026, 10, 17))).toBe('17/10/2026')
      expect(formatFinishedDate(null)).toBe('')
    })

    it('should preload today (local) or the existing date', () => {
      expect(defaultFinishedDateInput()).toBe(todayIsoDate())
      expect(defaultFinishedDateInput(localNoon(2026, 2, 1))).toBe('2026-02-01')
    })

    it('should reject empty and future dates', () => {
      expect(validateFinishedDateInput(todayIsoDate())).toBeNull()
      expect(validateFinishedDateInput('')).not.toBeNull()
      expect(validateFinishedDateInput(tomorrowIso())).toMatch(/posterior a hoy/)
    })

    it('should send setFinishedDate through the preload bridge', async () => {
      await bookService.setFinishedDate({ id: 7, finishedAt: '2026-10-01' })
      expect(window.api.books.setFinishedDate).toHaveBeenCalledWith({
        id: 7,
        finishedAt: '2026-10-01'
      })
    })
  })

  describe('AddBookModal', () => {
    it('should show the finished date input with today only when status is FINISHED', () => {
      renderWithClient(h(AddBookModal, { isOpen: true, onClose: vi.fn() }))
      expect(screen.queryByTestId('input-book-finished-date')).toBeNull()

      fireEvent.change(screen.getByTestId('select-book-status'), {
        target: { value: BookStatus.FINISHED }
      })
      const dateInput = screen.getByTestId('input-book-finished-date') as HTMLInputElement
      expect(dateInput.value).toBe(todayIsoDate())
      expect(dateInput.max).toBe(todayIsoDate())
    })

    it('should send the chosen finished date when creating a FINISHED book', async () => {
      renderWithClient(h(AddBookModal, { isOpen: true, onClose: vi.fn() }))
      fireEvent.change(screen.getByTestId('input-book-title'), { target: { value: 'Rayuela' } })
      fireEvent.change(screen.getByTestId('select-book-status'), {
        target: { value: BookStatus.FINISHED }
      })
      fireEvent.change(screen.getByTestId('input-book-finished-date'), {
        target: { value: '2026-09-12' }
      })
      fireEvent.click(screen.getByTestId('submit-book-button'))

      await waitFor(() => {
        expect(window.api.books.create).toHaveBeenCalledWith(
          expect.objectContaining({ status: BookStatus.FINISHED, finishedAt: '2026-09-12' })
        )
      })
    })

    it('should block submission with a future finished date', async () => {
      renderWithClient(h(AddBookModal, { isOpen: true, onClose: vi.fn() }))
      fireEvent.change(screen.getByTestId('input-book-title'), { target: { value: 'Rayuela' } })
      fireEvent.change(screen.getByTestId('select-book-status'), {
        target: { value: BookStatus.FINISHED }
      })
      fireEvent.change(screen.getByTestId('input-book-finished-date'), {
        target: { value: tomorrowIso() }
      })
      fireEvent.click(screen.getByTestId('submit-book-button'))

      expect(screen.getByTestId('input-book-finished-date-error')).toBeDefined()
      expect(window.api.books.create).not.toHaveBeenCalled()
    })

    it('should not send finishedAt for books that are not FINISHED', async () => {
      renderWithClient(h(AddBookModal, { isOpen: true, onClose: vi.fn() }))
      fireEvent.change(screen.getByTestId('input-book-title'), { target: { value: 'Rayuela' } })
      fireEvent.click(screen.getByTestId('submit-book-button'))

      await waitFor(() => {
        expect(window.api.books.create).toHaveBeenCalled()
      })
      const dto = vi.mocked(window.api.books.create).mock.calls[0]?.[0]
      expect(dto).not.toHaveProperty('finishedAt')
    })
  })

  describe('UpdateProgressModal', () => {
    it('should ask for the finished date with today preloaded when reaching the end', () => {
      renderWithClient(h(UpdateProgressModal, { book: readingBook, isOpen: true, onClose: vi.fn() }))
      expect(screen.queryByTestId('modal-finished-date-input')).toBeNull()

      fireEvent.change(screen.getByTestId('modal-progress-page-input'), {
        target: { value: '300' }
      })
      const dateInput = screen.getByTestId('modal-finished-date-input') as HTMLInputElement
      expect(dateInput.value).toBe(todayIsoDate())

      fireEvent.click(screen.getByTestId('finish-suggestion-checkbox'))
      expect(screen.queryByTestId('modal-finished-date-input')).toBeNull()
    })

    it('should send the chosen date when marking as finished', async () => {
      const onClose = vi.fn()
      renderWithClient(h(UpdateProgressModal, { book: readingBook, isOpen: true, onClose }))
      fireEvent.change(screen.getByTestId('modal-progress-page-input'), {
        target: { value: '300' }
      })
      fireEvent.change(screen.getByTestId('modal-finished-date-input'), {
        target: { value: '2026-10-10' }
      })
      fireEvent.click(screen.getByTestId('save-progress-modal-button'))

      await waitFor(() => {
        expect(window.api.books.updateStatus).toHaveBeenCalledWith({
          id: 8,
          status: BookStatus.FINISHED,
          finishedAt: '2026-10-10'
        })
      })
      expect(onClose).toHaveBeenCalled()
    })

    it('should not save when the finished date is in the future', async () => {
      renderWithClient(h(UpdateProgressModal, { book: readingBook, isOpen: true, onClose: vi.fn() }))
      fireEvent.change(screen.getByTestId('modal-progress-page-input'), {
        target: { value: '300' }
      })
      fireEvent.change(screen.getByTestId('modal-finished-date-input'), {
        target: { value: tomorrowIso() }
      })
      fireEvent.click(screen.getByTestId('save-progress-modal-button'))

      await waitFor(() => {
        expect(screen.getByTestId('modal-finished-date-input-error')).toBeDefined()
      })
      expect(window.api.books.updateProgress).not.toHaveBeenCalled()
      expect(window.api.books.updateStatus).not.toHaveBeenCalled()
    })
  })

  describe('BookDetailPage', () => {
    it('should show the finished date in es-AR and allow editing it', async () => {
      mockApi(finishedBook)
      renderWithClient(h(BookDetailPage, { bookId: 7, onBack: vi.fn() }))

      await waitFor(() => {
        expect(screen.getByTestId('detail-finished-date-value').textContent).toBe('03/10/2026')
      })

      fireEvent.click(screen.getByTestId('detail-edit-finished-date-button'))
      const input = screen.getByTestId('detail-edit-finished-date-input') as HTMLInputElement
      expect(input.value).toBe('2026-10-03')

      fireEvent.change(input, { target: { value: '2026-09-28' } })
      fireEvent.click(screen.getByTestId('detail-save-finished-date-button'))

      await waitFor(() => {
        expect(window.api.books.setFinishedDate).toHaveBeenCalledWith({
          id: 7,
          finishedAt: '2026-09-28'
        })
      })
    })

    it('should reject a future date when editing', async () => {
      mockApi(finishedBook)
      renderWithClient(h(BookDetailPage, { bookId: 7, onBack: vi.fn() }))
      await waitFor(() => {
        expect(screen.getByTestId('detail-edit-finished-date-button')).toBeDefined()
      })

      fireEvent.click(screen.getByTestId('detail-edit-finished-date-button'))
      fireEvent.change(screen.getByTestId('detail-edit-finished-date-input'), {
        target: { value: tomorrowIso() }
      })
      fireEvent.click(screen.getByTestId('detail-save-finished-date-button'))

      expect(screen.getByTestId('detail-edit-finished-date-input-error')).toBeDefined()
      expect(window.api.books.setFinishedDate).not.toHaveBeenCalled()
    })

    it('should not show the finished date for books that are not FINISHED', async () => {
      mockApi({ ...readingBook, finishedAt: localNoon(2026, 1, 1) })
      renderWithClient(h(BookDetailPage, { bookId: 8, onBack: vi.fn() }))
      await waitFor(() => {
        expect(screen.getByTestId('detail-status-select')).toBeDefined()
      })
      expect(screen.queryByTestId('detail-finished-date')).toBeNull()
    })

    it('should let the user cancel the finish confirmation without saving', async () => {
      renderWithClient(h(BookDetailPage, { bookId: 8, onBack: vi.fn() }))
      await waitFor(() => {
        expect(screen.getByTestId('detail-status-select')).toBeDefined()
      })

      fireEvent.change(screen.getByTestId('detail-status-select'), {
        target: { value: BookStatus.FINISHED }
      })
      fireEvent.click(screen.getByTestId('detail-cancel-finish-button'))

      expect(screen.queryByTestId('detail-confirm-finish')).toBeNull()
      expect(
        (screen.getByTestId('detail-status-select') as HTMLSelectElement).value
      ).toBe(BookStatus.READING)
      expect(window.api.books.updateStatus).not.toHaveBeenCalled()
    })
  })

  describe('BookCard (ficha del estante)', () => {
    it('should show the finished date when the book is FINISHED', () => {
      render(h(BookCard, { book: finishedBook }))
      expect(screen.getByTestId('book-finished-date').textContent).toContain('03/10/2026')
    })

    it('should not show a preserved date when the book is no longer FINISHED', () => {
      render(h(BookCard, { book: { ...readingBook, finishedAt: localNoon(2026, 1, 1) } }))
      expect(screen.queryByTestId('book-finished-date')).toBeNull()
    })
  })

  describe('Dashboard', () => {
    const now = localNoon(2026, 10, 17)
    const books: BookPrimitives[] = [
      makeBook({ id: 1, title: 'Octubre A', status: BookStatus.FINISHED, finishedAt: localNoon(2026, 10, 2) }),
      makeBook({ id: 2, title: 'Octubre B', status: BookStatus.FINISHED, finishedAt: localNoon(2026, 10, 15) }),
      makeBook({ id: 3, title: 'Marzo', status: BookStatus.FINISHED, finishedAt: localNoon(2026, 3, 9) }),
      makeBook({ id: 4, title: 'Año pasado', status: BookStatus.FINISHED, finishedAt: localNoon(2025, 10, 20) }),
      makeBook({ id: 5, title: 'Reabierto', status: BookStatus.READING, finishedAt: localNoon(2026, 10, 16) }),
      makeBook({ id: 6, title: 'Sin terminar', status: BookStatus.READING })
    ]

    it('should count finished books in the current year and month by finishedAt', () => {
      expect(countFinishedInPeriod(books, now)).toEqual({ year: 3, month: 2 })
    })

    it('should sort recently finished books by finishedAt, ignoring non-FINISHED books', () => {
      const sorted = sortRecentlyFinishedBooks(books)
      expect(sorted.map((b) => b.id)).toEqual([2, 1, 3, 4])
    })

    it('should render the finished timeline with es-AR dates', async () => {
      window.api.books.list = vi.fn().mockResolvedValue({ success: true, data: books })
      renderWithClient(h(DashboardPage, {}))

      await waitFor(() => {
        expect(screen.getByTestId('finished-timeline')).toBeDefined()
      })
      const items = screen.getAllByTestId('recent-finished-item')
      expect(items.length).toBe(4)
      expect(items[0]?.textContent).toContain('Octubre B')
      expect(screen.getAllByTestId('recent-finished-date')[0]?.textContent).toBe('15/10/2026')
      expect(screen.getByTestId('stat-finished-this-year')).toBeDefined()
      expect(screen.getByTestId('stat-finished-this-month')).toBeDefined()
    })
  })
})

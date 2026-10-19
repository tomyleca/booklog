// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BookStatus } from '../../src/shared/domain/entities/BookStatus.js'
import { todayIsoDate, toIsoDate } from '../../src/shared/domain/entities/CalendarDate.js'
import { FinishedDateSuggestionSource } from '../../src/shared/domain/services/suggestFinishedDate.js'
import type {
  BookPrimitives,
  HighlightPrimitives,
  NotePrimitives
} from '../../src/shared/infrastructure/ipc/contracts.js'
import { UpdateProgressModal } from '../../src/renderer/src/components/UpdateProgressModal.js'
import {
  describeFinishedDateSuggestion,
  formatFinishedDate,
  preloadFinishedDate
} from '../../src/renderer/src/components/finishedDate.js'
import { BookDetailPage } from '../../src/renderer/src/pages/BookDetailPage.js'

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

function daysFromToday(days: number, hour = 22): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, hour, 15)
}

const book: BookPrimitives = {
  id: 9,
  googleBooksId: null,
  title: 'El túnel',
  authors: 'Ernesto Sabato',
  coverUrl: null,
  coverPath: null,
  pageCount: 160,
  currentPage: 120,
  progressPercentage: 75,
  isbn: null,
  status: BookStatus.READING,
  rating: null,
  finishedAt: null,
  createdAt: new Date('2026-01-01T10:00:00Z'),
  updatedAt: new Date('2026-01-01T10:00:00Z')
}

function highlight(id: number, capturedAt: Date | null): HighlightPrimitives {
  return {
    id,
    bookId: 9,
    content: `Subrayado ${id}`,
    location: { position: { start: id * 10, end: null } },
    capturedAt,
    fingerprint: `h-${id}`,
    createdAt: new Date('2026-10-19T10:00:00Z')
  }
}

function note(id: number, origin: 'MANUAL' | 'KINDLE', capturedAt: Date | null): NotePrimitives {
  return {
    id,
    bookId: 9,
    content: `Nota ${id}`,
    origin,
    highlightId: null,
    location: null,
    capturedAt,
    fingerprint: origin === 'KINDLE' ? `n-${id}` : null,
    createdAt: daysFromToday(0, 9),
    updatedAt: daysFromToday(0, 9)
  }
}

function mockApi(
  detailBook: BookPrimitives,
  highlights: HighlightPrimitives[],
  notes: NotePrimitives[] = []
): void {
  window.api = {
    books: {
      list: vi.fn().mockResolvedValue({ success: true, data: [detailBook] }),
      getById: vi.fn().mockResolvedValue({ success: true, data: detailBook }),
      updateStatus: vi.fn().mockResolvedValue({ success: true, data: detailBook }),
      updateProgress: vi.fn().mockResolvedValue({ success: true, data: detailBook }),
      setFinishedDate: vi.fn(),
      rate: vi.fn(),
      delete: vi.fn()
    },
    notes: {
      getByBook: vi.fn().mockResolvedValue({ success: true, data: notes }),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    highlights: {
      getByBook: vi.fn().mockResolvedValue({ success: true, data: highlights }),
      delete: vi.fn()
    }
  } as unknown as typeof window.api
}

async function waitForAnnotations(): Promise<void> {
  await waitFor(() => {
    expect(screen.getByTestId('detail-status-select')).toBeDefined()
    expect(screen.getByTestId('highlights-count-badge')).toBeDefined()
    expect(screen.getByTestId('notes-count-badge')).toBeDefined()
  })
}

async function openFinishConfirmation(): Promise<HTMLInputElement> {
  renderWithClient(h(BookDetailPage, { bookId: 9, onBack: vi.fn() }))
  await waitForAnnotations()
  fireEvent.change(screen.getByTestId('detail-status-select'), {
    target: { value: BookStatus.FINISHED }
  })
  return screen.getByTestId('detail-confirm-finished-date-input') as HTMLInputElement
}

describe('Feature #24 — finished date suggested from Kindle annotations (renderer)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  describe('helpers', () => {
    it('should describe Kindle suggestions with their source and es-AR date', () => {
      expect(
        describeFinishedDateSuggestion({
          date: '2026-10-17',
          source: FinishedDateSuggestionSource.KINDLE_HIGHLIGHT
        })
      ).toBe('Sugerida: último subrayado del Kindle (17/10/2026)')
      expect(
        describeFinishedDateSuggestion({
          date: '2026-10-12',
          source: FinishedDateSuggestionSource.KINDLE_NOTE
        })
      ).toBe('Sugerida: última nota del Kindle (12/10/2026)')
      expect(
        describeFinishedDateSuggestion({
          date: '2026-10-19',
          source: FinishedDateSuggestionSource.TODAY
        })
      ).toBeNull()
    })

    it('should preload the existing date first, then the Kindle suggestion, then today', () => {
      const suggestion = {
        date: '2026-10-17',
        source: FinishedDateSuggestionSource.KINDLE_HIGHLIGHT
      }
      expect(preloadFinishedDate(suggestion, new Date(2026, 9, 3, 12))).toEqual({
        value: '2026-10-03',
        hint: null
      })
      expect(preloadFinishedDate(suggestion)).toEqual({
        value: '2026-10-17',
        hint: 'Sugerida: último subrayado del Kindle (17/10/2026)'
      })
      expect(
        preloadFinishedDate({ date: '2000-01-01', source: FinishedDateSuggestionSource.TODAY })
      ).toEqual({ value: todayIsoDate(), hint: null })
      expect(preloadFinishedDate(null)).toEqual({ value: todayIsoDate(), hint: null })
    })
  })

  describe('BookDetailPage — status change to FINISHED', () => {
    it('should preload the date of the latest Kindle highlight and say where it comes from', async () => {
      const latest = daysFromToday(-3)
      mockApi(book, [highlight(1, daysFromToday(-20)), highlight(2, latest)])

      const input = await openFinishConfirmation()

      expect(input.value).toBe(toIsoDate(latest))
      expect(screen.getByTestId('detail-confirm-finished-date-input-hint').textContent).toBe(
        `Sugerida: último subrayado del Kindle (${formatFinishedDate(latest)})`
      )
    })

    it('should use a newer Kindle note and ignore manual notes', async () => {
      const kindleNoteDate = daysFromToday(-2)
      mockApi(
        book,
        [highlight(1, daysFromToday(-6))],
        [note(10, 'KINDLE', kindleNoteDate), note(11, 'MANUAL', daysFromToday(0, 8))]
      )

      const input = await openFinishConfirmation()

      expect(input.value).toBe(toIsoDate(kindleNoteDate))
      expect(screen.getByTestId('detail-confirm-finished-date-input-hint').textContent).toContain(
        'última nota del Kindle'
      )
    })

    it('should send the suggested date unless the user changes it', async () => {
      const latest = daysFromToday(-4)
      mockApi(book, [highlight(1, latest)])

      const input = await openFinishConfirmation()
      expect(input.value).toBe(toIsoDate(latest))

      fireEvent.change(input, { target: { value: toIsoDate(daysFromToday(-1)) } })
      fireEvent.click(screen.getByTestId('detail-confirm-finish-button'))

      await waitFor(() => {
        expect(window.api.books.updateStatus).toHaveBeenCalledWith({
          id: 9,
          status: BookStatus.FINISHED,
          finishedAt: toIsoDate(daysFromToday(-1))
        })
      })
    })

    it('should preload today without hint when the book has no Kindle annotations', async () => {
      mockApi(book, [], [note(11, 'MANUAL', daysFromToday(-5))])

      const input = await openFinishConfirmation()

      expect(input.value).toBe(todayIsoDate())
      expect(screen.queryByTestId('detail-confirm-finished-date-input-hint')).toBeNull()
    })

    it('should preload today when the latest Kindle annotation is in the future', async () => {
      mockApi(book, [highlight(1, daysFromToday(-5)), highlight(2, daysFromToday(2))])

      const input = await openFinishConfirmation()

      expect(input.value).toBe(todayIsoDate())
      expect(screen.queryByTestId('detail-confirm-finished-date-input-hint')).toBeNull()
    })

    it('should suggest the Kindle date (not the preserved one) when re-finishing a reopened book', async () => {
      const latest = daysFromToday(-3)
      mockApi({ ...book, finishedAt: daysFromToday(-90, 12) }, [highlight(1, latest)])

      const input = await openFinishConfirmation()

      expect(input.value).toBe(toIsoDate(latest))
    })
  })

  describe('UpdateProgressModal — "mark as finished" checkbox', () => {
    function reachEnd(): HTMLInputElement {
      fireEvent.change(screen.getByTestId('modal-progress-page-input'), {
        target: { value: '160' }
      })
      return screen.getByTestId('modal-finished-date-input') as HTMLInputElement
    }

    it('should preload the Kindle suggestion with its hint and send it', async () => {
      mockApi(book, [])
      const suggestion = {
        date: toIsoDate(daysFromToday(-2)),
        source: FinishedDateSuggestionSource.KINDLE_HIGHLIGHT
      }
      renderWithClient(
        h(UpdateProgressModal, {
          book,
          isOpen: true,
          onClose: vi.fn(),
          finishedDateSuggestion: suggestion
        })
      )

      const input = reachEnd()
      expect(input.value).toBe(suggestion.date)
      expect(screen.getByTestId('modal-finished-date-input-hint').textContent).toBe(
        `Sugerida: último subrayado del Kindle (${formatFinishedDate(daysFromToday(-2))})`
      )

      fireEvent.click(screen.getByTestId('save-progress-modal-button'))
      await waitFor(() => {
        expect(window.api.books.updateStatus).toHaveBeenCalledWith({
          id: 9,
          status: BookStatus.FINISHED,
          finishedAt: suggestion.date
        })
      })
    })

    it('should keep the existing date of an already FINISHED book over the suggestion', () => {
      mockApi(book, [])
      const finishedBook: BookPrimitives = {
        ...book,
        status: BookStatus.FINISHED,
        finishedAt: daysFromToday(-30, 12),
        currentPage: 100
      }
      renderWithClient(
        h(UpdateProgressModal, {
          book: finishedBook,
          isOpen: true,
          onClose: vi.fn(),
          finishedDateSuggestion: {
            date: toIsoDate(daysFromToday(-2)),
            source: FinishedDateSuggestionSource.KINDLE_NOTE
          }
        })
      )

      const input = reachEnd()
      expect(input.value).toBe(toIsoDate(daysFromToday(-30)))
      expect(screen.queryByTestId('modal-finished-date-input-hint')).toBeNull()
    })

    it('should preload today without hint when there is no suggestion', () => {
      mockApi(book, [])
      renderWithClient(h(UpdateProgressModal, { book, isOpen: true, onClose: vi.fn() }))

      const input = reachEnd()
      expect(input.value).toBe(todayIsoDate())
      expect(screen.queryByTestId('modal-finished-date-input-hint')).toBeNull()
    })

    it('should receive the suggestion from the detail page', async () => {
      const latest = daysFromToday(-6)
      mockApi(book, [highlight(1, latest)])
      renderWithClient(h(BookDetailPage, { bookId: 9, onBack: vi.fn() }))
      await waitForAnnotations()

      fireEvent.click(screen.getByTestId('open-update-progress-modal-button'))
      const input = reachEnd()
      expect(input.value).toBe(toIsoDate(latest))
    })
  })
})

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BookDetailPage } from '../../src/renderer/src/pages/BookDetailPage.js'
import {
  formatAnnotationLocation,
  groupNotesByHighlight,
  noteDisplayDate
} from '../../src/renderer/src/components/annotations.js'
import { BookStatus } from '../../src/shared/domain/entities/BookStatus.js'
import type {
  BookPrimitives,
  HighlightPrimitives,
  NotePrimitives
} from '../../src/shared/infrastructure/ipc/contracts.js'

const h = React.createElement

function renderPage(): void {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } }
  })
  render(h(QueryClientProvider, { client }, h(BookDetailPage, { bookId: 7, onBack: vi.fn() })))
}

const book: BookPrimitives = {
  id: 7,
  googleBooksId: null,
  title: 'Ficciones',
  authors: 'Jorge Luis Borges',
  coverUrl: null,
  coverPath: null,
  pageCount: 200,
  currentPage: 50,
  progressPercentage: 25,
  isbn: null,
  status: BookStatus.READING,
  rating: null,
  finishedAt: null,
  createdAt: new Date('2026-01-01T10:00:00Z'),
  updatedAt: new Date('2026-01-01T10:00:00Z')
}

const manualNote: NotePrimitives = {
  id: 1,
  bookId: 7,
  content: 'Idea escrita en BookLog',
  origin: 'MANUAL',
  highlightId: null,
  location: null,
  capturedAt: null,
  fingerprint: null,
  createdAt: new Date('2026-02-01T10:00:00Z'),
  updatedAt: new Date('2026-02-01T10:00:00Z')
}

const kindleNote: NotePrimitives = {
  id: 2,
  bookId: 7,
  content: 'Comentario escrito en el Kindle',
  origin: 'KINDLE',
  highlightId: 50,
  location: { position: { start: 1205, end: null } },
  capturedAt: new Date(2025, 6, 14, 22, 16, 0),
  fingerprint: 'n-1',
  createdAt: new Date('2026-10-19T10:00:00Z'),
  updatedAt: new Date('2026-10-19T10:00:00Z')
}

const highlights: HighlightPrimitives[] = [
  {
    id: 50,
    bookId: 7,
    content: 'El jardín de senderos que se bifurcan',
    location: { position: { start: 1200, end: 1205 } },
    capturedAt: new Date(2025, 6, 14, 22, 15, 3),
    fingerprint: 'h-1',
    createdAt: new Date('2026-10-19T10:00:00Z')
  },
  {
    id: 51,
    bookId: 7,
    content: 'Tlön, Uqbar, Orbis Tertius',
    location: { page: { start: 12, end: null } },
    capturedAt: null,
    fingerprint: 'h-2',
    createdAt: new Date('2026-10-19T10:00:00Z')
  }
]

function mockApi(notes: NotePrimitives[], highlightList: HighlightPrimitives[]): void {
  window.api = {
    books: {
      getById: vi.fn().mockResolvedValue({ success: true, data: book }),
      list: vi.fn().mockResolvedValue({ success: true, data: [book] })
    },
    notes: {
      getByBook: vi.fn().mockResolvedValue({ success: true, data: notes }),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn().mockResolvedValue({ success: true, data: undefined })
    },
    highlights: {
      getByBook: vi.fn().mockResolvedValue({ success: true, data: highlightList }),
      delete: vi.fn().mockResolvedValue({ success: true, data: undefined })
    }
  } as unknown as typeof window.api
}

describe('Feature #22 — annotation helpers', () => {
  it('should format page and position references', () => {
    expect(formatAnnotationLocation({ page: { start: 12, end: null } })).toBe('pág. 12')
    expect(formatAnnotationLocation({ page: { start: 12, end: 14 } })).toBe('pág. 12–14')
    expect(formatAnnotationLocation({ position: { start: 1200, end: 1205 } })).toBe(
      'pos. 1200–1205'
    )
    expect(formatAnnotationLocation(null)).toBe('')
  })

  it('should date Kindle notes by their device date and manual notes by creation', () => {
    expect(noteDisplayDate(kindleNote)).toEqual(kindleNote.capturedAt)
    expect(noteDisplayDate(manualNote)).toEqual(manualNote.createdAt)
  })

  it('should group notes by linked highlight', () => {
    const groups = groupNotesByHighlight([manualNote, kindleNote])
    expect([...groups.keys()]).toEqual([50])
    expect(groups.get(50)).toEqual([kindleNote])
  })
})

describe('Feature #22 — "Mis notas" and "Subrayados" in book detail', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('should list every note under "Mis notas" and mark the Kindle ones', async () => {
    mockApi([manualNote, kindleNote], highlights)
    renderPage()

    const section = await screen.findByTestId('my-notes-section')
    expect(within(section).getByText('Mis notas')).toBeDefined()
    await waitFor(() => {
      expect(within(section).getAllByTestId('note-item')).toHaveLength(2)
    })
    expect(within(section).getByTestId('notes-count-badge').textContent).toBe('2')
    expect(within(section).getAllByTestId('note-origin-kindle')).toHaveLength(1)
    expect(within(section).getByTestId('note-location').textContent).toContain('pos. 1205')
    expect(within(section).getByTestId('note-linked-highlight')).toBeDefined()
    expect(within(section).getByText('Idea escrita en BookLog')).toBeDefined()
    expect(screen.getByTestId('add-note-button')).toBeDefined()
  })

  it('should list highlights with location and date and show linked notes below them', async () => {
    mockApi([manualNote, kindleNote], highlights)
    renderPage()

    const section = await screen.findByTestId('highlights-section')
    await waitFor(() => {
      expect(within(section).getAllByTestId('highlight-item')).toHaveLength(2)
    })
    expect(within(section).getByTestId('highlights-count-badge').textContent).toBe('2')

    const [first, second] = within(section).getAllByTestId('highlight-item') as [
      HTMLElement,
      HTMLElement
    ]
    expect(within(first).getByTestId('highlight-content').textContent).toBe(
      'El jardín de senderos que se bifurcan'
    )
    expect(within(first).getByTestId('highlight-location').textContent).toContain(
      'pos. 1200–1205'
    )
    expect(within(first).getByTestId('highlight-date').textContent).toContain('2025')
    expect(within(first).getByTestId('highlight-linked-note').textContent).toContain(
      'Comentario escrito en el Kindle'
    )

    expect(within(second).getByTestId('highlight-location').textContent).toContain('pág. 12')
    expect(within(second).queryByTestId('highlight-date')).toBeNull()
    expect(within(second).queryByTestId('highlight-linked-note')).toBeNull()
  })

  it('should show an empty state when the book has no highlights', async () => {
    mockApi([manualNote], [])
    renderPage()

    expect(await screen.findByTestId('no-highlights-message')).toBeDefined()
    expect(screen.queryByTestId('note-origin-kindle')).toBeNull()
  })

  it('should delete a highlight and refresh highlights and notes', async () => {
    mockApi([manualNote, kindleNote], highlights)
    renderPage()

    const button = await screen.findByTestId('delete-highlight-button-50')
    fireEvent.click(button)

    await waitFor(() => {
      expect(window.api.highlights.delete).toHaveBeenCalledWith(50)
    })
    await waitFor(() => {
      expect(window.api.highlights.getByBook).toHaveBeenCalledTimes(2)
      expect(window.api.notes.getByBook).toHaveBeenCalledTimes(2)
    })
  })

  it('should show an error message when highlights fail to load', async () => {
    mockApi([manualNote], [])
    window.api.highlights.getByBook = vi
      .fn()
      .mockResolvedValue({ success: false, error: 'Falló la base' })
    renderPage()

    const error = await screen.findByTestId('highlights-error')
    expect(error.textContent).toContain('Falló la base')
    expect(await screen.findByText('Idea escrita en BookLog')).toBeDefined()
  })
})

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AddBookModal } from '../../src/renderer/src/components/AddBookModal.js'
import { searchService } from '../../src/renderer/src/services/searchService.js'
import type { BookSearchResult } from '../../src/shared/domain/ports/BookSearchService.js'

const h = React.createElement

function renderModal(): void {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } }
  })
  render(h(QueryClientProvider, { client }, h(AddBookModal, { isOpen: true, onClose: vi.fn() })))
}

const kingEdition: BookSearchResult = {
  googleBooksId: 'king',
  title: 'Pet Sematary',
  authors: ['Stephen King'],
  publishedDate: '2018',
  pageCount: 416,
  coverUrl: null,
  isbn: '9781982115982'
}

const studyGuide: BookSearchResult = {
  googleBooksId: 'guide',
  title: 'Study Guide: Pet Sematary by Stephen King',
  authors: ['SuperSummary'],
  coverUrl: null
}

describe('Feature #21 - Optional author field in the Google Books search tab', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    window.api = {
      books: { list: vi.fn().mockResolvedValue({ success: true, data: [] }), create: vi.fn() },
      covers: { saveFromUrl: vi.fn(), saveFromLocal: vi.fn() },
      search: {
        books: vi.fn().mockResolvedValue({ success: true, data: [kingEdition, studyGuide] })
      }
    } as unknown as typeof window.api
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('renders an optional author input inside the search tab', () => {
    renderModal()

    const authorInput = screen.getByTestId('search-author-input') as HTMLInputElement
    expect(authorInput.placeholder).toBe('Autor (opcional)')
    expect(screen.getByTestId('search-tab-content').contains(authorInput)).toBe(true)
    expect(screen.getByTestId('search-books-input')).toBeDefined()
  })

  it('searches by author alone after the debounce when the title is empty', async () => {
    vi.useFakeTimers()
    renderModal()

    fireEvent.change(screen.getByTestId('search-author-input'), {
      target: { value: 'Stephen King' }
    })
    await act(async () => {
      vi.advanceTimersByTime(550)
    })

    expect(window.api.search.books).toHaveBeenCalledWith('', 'Stephen King')
  })

  it('sends title and author together when both are filled and Enter is pressed', async () => {
    renderModal()

    fireEvent.change(screen.getByTestId('search-books-input'), {
      target: { value: 'Pet Sematary' }
    })
    const authorInput = screen.getByTestId('search-author-input')
    fireEvent.change(authorInput, { target: { value: ' Stephen King ' } })
    fireEvent.keyDown(authorInput, { key: 'Enter' })

    await waitFor(() => {
      expect(window.api.search.books).toHaveBeenLastCalledWith('Pet Sematary', 'Stephen King')
    })
    expect(screen.getByTestId('search-result-card-0').textContent).toContain('Pet Sematary')
  })

  it('keeps sending only the title when the author is empty (backwards compatible call)', async () => {
    renderModal()

    const input = screen.getByTestId('search-books-input')
    fireEvent.change(input, { target: { value: 'Pet Sematary' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(window.api.search.books).toHaveBeenCalledWith('Pet Sematary')
    })
    expect(vi.mocked(window.api.search.books).mock.calls[0]).toHaveLength(1)
  })

  it('enables the search button with only the author and disables it when both are short', () => {
    renderModal()

    const button = screen.getByTestId('search-books-button') as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(screen.getByTestId('search-min-chars-message')).toBeDefined()

    fireEvent.change(screen.getByTestId('search-author-input'), { target: { value: 'King' } })
    expect(button.disabled).toBe(false)
    expect(screen.queryByTestId('search-min-chars-message')).toBeNull()
  })

  it('ignores a stale response when the author changes before it arrives', async () => {
    let resolveFirst: (value: unknown) => void = () => {}
    vi.mocked(window.api.search.books)
      .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)) as never)
      .mockResolvedValueOnce({ success: true, data: [kingEdition] })
    renderModal()

    const input = screen.getByTestId('search-books-input')
    fireEvent.change(input, { target: { value: 'Pet Sematary' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    const authorInput = screen.getByTestId('search-author-input')
    fireEvent.change(authorInput, { target: { value: 'Stephen King' } })
    fireEvent.keyDown(authorInput, { key: 'Enter' })

    await waitFor(() => {
      expect(screen.getByTestId('search-result-card-0').textContent).toContain('Stephen King')
    })
    await act(async () => {
      resolveFirst({ success: true, data: [studyGuide] })
    })

    expect(screen.queryByTestId('search-result-card-1')).toBeNull()
    expect(screen.getByTestId('search-result-card-0').textContent).not.toContain('SuperSummary')
  })

  it('shows title and author in the no-results message', async () => {
    vi.mocked(window.api.search.books).mockResolvedValueOnce({ success: true, data: [] })
    renderModal()

    fireEvent.change(screen.getByTestId('search-books-input'), { target: { value: 'Zzzz' } })
    const authorInput = screen.getByTestId('search-author-input')
    fireEvent.change(authorInput, { target: { value: 'Nadie' } })
    fireEvent.keyDown(authorInput, { key: 'Enter' })

    await waitFor(() => {
      expect(screen.getByTestId('search-no-results').textContent).toContain('Zzzz — Nadie')
    })
  })
})

describe('renderer searchService', () => {
  beforeEach(() => {
    window.api = {
      search: { books: vi.fn().mockResolvedValue({ success: true, data: [] }) }
    } as unknown as typeof window.api
  })

  it('passes the trimmed author only when it is not blank', async () => {
    await searchService.searchBooks('Pet Sematary', '  Stephen King  ')
    await searchService.searchBooks('Pet Sematary', '   ')

    expect(vi.mocked(window.api.search.books).mock.calls).toEqual([
      ['Pet Sematary', 'Stephen King'],
      ['Pet Sematary']
    ])
  })
})

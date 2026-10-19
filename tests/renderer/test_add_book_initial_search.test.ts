// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AddBookModal } from '../../src/renderer/src/components/AddBookModal.js'
import type {
  AddBookFormValues,
  AddBookInitialSearch
} from '../../src/renderer/src/components/AddBookModal.js'
import type { BookSearchResult } from '../../src/shared/domain/ports/BookSearchService.js'

const h = React.createElement

const mist: BookSearchResult = {
  googleBooksId: 'mist',
  title: 'The Mist',
  authors: ['Stephen King'],
  coverUrl: null
}

const carrie: BookSearchResult = {
  googleBooksId: 'carrie',
  title: 'Carrie',
  authors: ['Stephen King'],
  coverUrl: null
}

function renderModal(props: {
  initialSearch?: AddBookInitialSearch
  initialValues?: Partial<AddBookFormValues>
}): void {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } }
  })
  render(
    h(
      QueryClientProvider,
      { client },
      h(AddBookModal, { isOpen: true, onClose: vi.fn(), ...props })
    )
  )
}

describe('Feature #25 — AddBookModal opened with an initial search', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    window.api = {
      books: { list: vi.fn().mockResolvedValue({ success: true, data: [] }), create: vi.fn() },
      covers: { saveFromUrl: vi.fn(), saveFromLocal: vi.fn() },
      search: { books: vi.fn().mockResolvedValue({ success: true, data: [mist] }) }
    } as unknown as typeof window.api
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('opens on the search tab with query and author and searches without the debounce', async () => {
    vi.useFakeTimers()
    renderModal({
      initialSearch: { query: 'The Mist', author: 'Stephen King' },
      initialValues: { title: 'The Mist', authors: 'Stephen King' }
    })

    expect(screen.getByTestId('search-tab-content')).toBeDefined()
    expect((screen.getByTestId('search-books-input') as HTMLInputElement).value).toBe('The Mist')
    expect((screen.getByTestId('search-author-input') as HTMLInputElement).value).toBe(
      'Stephen King'
    )
    expect(window.api.search.books).toHaveBeenCalledTimes(1)
    expect(window.api.search.books).toHaveBeenCalledWith('The Mist', 'Stephen King')

    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    expect(window.api.search.books).toHaveBeenCalledTimes(1)
  })

  it('keeps the existing behaviour without an initial search', () => {
    renderModal({ initialValues: { title: 'The Mist', authors: 'Stephen King' } })

    expect(screen.getByTestId('manual-tab-content')).toBeDefined()
    expect((screen.getByTestId('input-book-title') as HTMLInputElement).value).toBe('The Mist')
    expect(window.api.search.books).not.toHaveBeenCalled()
  })

  it('ignores the automatic search when the user searches again before it arrives', async () => {
    let resolveFirst: (value: unknown) => void = () => {}
    vi.mocked(window.api.search.books)
      .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)) as never)
      .mockResolvedValueOnce({ success: true, data: [carrie] })
    renderModal({ initialSearch: { query: 'The Mist', author: 'Stephen King' } })

    const input = screen.getByTestId('search-books-input')
    fireEvent.change(input, { target: { value: 'Carrie' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => {
      expect(screen.getByTestId('search-result-card-0').textContent).toContain('Carrie')
    })

    await act(async () => {
      resolveFirst({ success: true, data: [mist] })
    })
    expect(screen.getByTestId('search-result-card-0').textContent).toContain('Carrie')
    expect(screen.queryByTestId('search-result-card-1')).toBeNull()
  })
})

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AddBookModal } from '../../src/renderer/src/components/AddBookModal.js'
import type { AddBookInitialSearch } from '../../src/renderer/src/components/AddBookModal.js'
import {
  SEARCH_ERROR_FALLBACK,
  SEARCH_ERROR_MESSAGES,
  searchErrorMessage
} from '../../src/renderer/src/components/searchErrorMessage.js'
import type { BookSearchResult } from '../../src/shared/domain/ports/BookSearchService.js'

const h = React.createElement

const carrie: BookSearchResult = {
  googleBooksId: 'carrie',
  title: 'Carrie',
  authors: ['Stephen King'],
  coverUrl: null
}

function failure(code: string, error = 'detalle técnico') {
  return { success: false, error, code }
}

function renderModal(initialSearch?: AddBookInitialSearch): void {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } }
  })
  render(
    h(
      QueryClientProvider,
      { client },
      h(AddBookModal, { isOpen: true, onClose: vi.fn(), initialSearch })
    )
  )
}

function searchFor(text: string): void {
  const input = screen.getByTestId('search-books-input')
  fireEvent.change(input, { target: { value: text } })
  fireEvent.keyDown(input, { key: 'Enter' })
}

describe('Feature #27 — search error messages', () => {
  it('maps each search code to a Spanish message and falls back to the raw error', () => {
    expect(searchErrorMessage('SEARCH_UNAVAILABLE')).toContain('no está respondiendo')
    expect(searchErrorMessage('SEARCH_QUOTA_EXCEEDED')).toContain('límite de consultas')
    expect(searchErrorMessage('SEARCH_INVALID_API_KEY')).toContain('API key')
    expect(searchErrorMessage('SEARCH_FAILED')).toContain('no pudo procesar')
    expect(searchErrorMessage('INTERNAL_ERROR', 'Algo raro')).toBe('Algo raro')
    expect(searchErrorMessage(undefined)).toBe(SEARCH_ERROR_FALLBACK)
  })
})

describe('Feature #27 — AddBookModal retry button', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    window.api = {
      books: { list: vi.fn().mockResolvedValue({ success: true, data: [] }), create: vi.fn() },
      covers: { saveFromUrl: vi.fn(), saveFromLocal: vi.fn() },
      search: { books: vi.fn().mockResolvedValue({ success: true, data: [carrie] }) }
    } as unknown as typeof window.api
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it.each([
    ['SEARCH_UNAVAILABLE'],
    ['SEARCH_QUOTA_EXCEEDED'],
    ['SEARCH_INVALID_API_KEY']
  ] as const)('shows the message for %s with a retry button', async (code) => {
    vi.mocked(window.api.search.books).mockResolvedValueOnce(failure(code) as never)
    renderModal()

    searchFor('Carrie')

    const banner = await screen.findByTestId('search-error-banner')
    expect(banner.textContent).toContain(SEARCH_ERROR_MESSAGES[code])
    expect(banner.textContent).not.toContain('detalle técnico')
    expect(screen.getByTestId('search-retry-button').textContent).toContain('Reintentar')
  })

  it('does not show the no-results message on top of an error', async () => {
    vi.mocked(window.api.search.books).mockResolvedValueOnce(
      failure('SEARCH_UNAVAILABLE') as never
    )
    renderModal()

    searchFor('Carrie')

    await screen.findByTestId('search-error-banner')
    expect(screen.queryByTestId('search-no-results')).toBeNull()
  })

  it('repeats the last search with the same query and author when retrying', async () => {
    vi.mocked(window.api.search.books).mockResolvedValueOnce(
      failure('SEARCH_UNAVAILABLE') as never
    )
    renderModal()

    fireEvent.change(screen.getByTestId('search-author-input'), {
      target: { value: 'Stephen King' }
    })
    searchFor('Carrie')
    fireEvent.click(await screen.findByTestId('search-retry-button'))

    await waitFor(() => {
      expect(screen.getByTestId('search-results-list')).toBeDefined()
    })
    expect(window.api.search.books).toHaveBeenCalledTimes(2)
    expect(window.api.search.books).toHaveBeenNthCalledWith(2, 'Carrie', 'Stephen King')
    expect(screen.queryByTestId('search-error-banner')).toBeNull()
  })

  it('retries the initial search of feature #25 when it failed', async () => {
    vi.mocked(window.api.search.books).mockResolvedValueOnce(
      failure('SEARCH_QUOTA_EXCEEDED') as never
    )
    renderModal({ query: 'Carrie', author: 'Stephen King' })

    fireEvent.click(await screen.findByTestId('search-retry-button'))

    await screen.findByTestId('search-results-list')
    expect(window.api.search.books).toHaveBeenNthCalledWith(1, 'Carrie', 'Stephen King')
    expect(window.api.search.books).toHaveBeenNthCalledWith(2, 'Carrie', 'Stephen King')
  })

  it('hides the retry button as soon as the user edits the search (debounce takes over)', async () => {
    vi.mocked(window.api.search.books).mockResolvedValueOnce(
      failure('SEARCH_UNAVAILABLE') as never
    )
    renderModal()

    searchFor('Carrie')
    await screen.findByTestId('search-retry-button')

    vi.useFakeTimers()
    fireEvent.change(screen.getByTestId('search-books-input'), { target: { value: 'Carrie 2' } })
    expect(screen.queryByTestId('search-retry-button')).toBeNull()

    await act(async () => {
      vi.advanceTimersByTime(600)
    })
    expect(window.api.search.books).toHaveBeenCalledTimes(2)
    expect(window.api.search.books).toHaveBeenLastCalledWith('Carrie 2')
  })

  it('ignores a stale failed response when a newer search already answered', async () => {
    let resolveFirst: (value: unknown) => void = () => {}
    vi.mocked(window.api.search.books)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve
          }) as never
      )
      .mockResolvedValueOnce({ success: true, data: [carrie] })
    renderModal()

    searchFor('Carrie')
    searchFor('Carrie King')
    await screen.findByTestId('search-results-list')

    await act(async () => {
      resolveFirst(failure('SEARCH_UNAVAILABLE'))
    })
    expect(screen.queryByTestId('search-error-banner')).toBeNull()
    expect(screen.queryByTestId('search-retry-button')).toBeNull()
  })
})

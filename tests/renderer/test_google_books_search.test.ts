// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AddBookModal } from '../../src/renderer/src/components/AddBookModal.js'
import { BookStatus } from '../../src/shared/domain/entities/BookStatus.js'
import type { BookSearchResult } from '../../src/shared/domain/ports/BookSearchService.js'

const h = React.createElement

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
        gcTime: 0
      },
      mutations: {
        retry: false
      }
    }
  })
}

function renderWithClient(
  ui: React.ReactElement,
  client: QueryClient = createTestQueryClient()
) {
  return {
    client,
    ...render(h(QueryClientProvider, { client }, ui))
  }
}

describe('Feature #10 - Google Books Search Integration (AddBookModal)', () => {
  const mockBookResults: BookSearchResult[] = [
    {
      googleBooksId: 'gb_quijote_1',
      title: 'Don Quijote de la Mancha',
      authors: ['Miguel de Cervantes Saavedra'],
      publishedDate: '1605',
      pageCount: 863,
      coverUrl: 'https://books.google.com/quijote.jpg',
      isbn: '9788424116286'
    },
    {
      googleBooksId: 'gb_quijote_2',
      title: 'El Ingenioso Hidalgo Don Quijote',
      authors: ['Miguel de Cervantes'],
      publishedDate: '1615',
      pageCount: 650,
      coverUrl: null,
      isbn: '9788437604947'
    }
  ]

  beforeEach(() => {
    vi.restoreAllMocks()
    window.api = {
      books: {
        list: vi.fn().mockResolvedValue({ success: true, data: [] }),
        getById: vi.fn(),
        create: vi.fn().mockResolvedValue({
          success: true,
          data: {
            id: 1,
            title: 'Don Quijote de la Mancha',
            authors: 'Miguel de Cervantes Saavedra',
            status: BookStatus.TO_READ,
            pageCount: 863,
            currentPage: 0,
            progressPercentage: 0,
            isbn: '9788424116286',
            coverUrl: 'https://books.google.com/quijote.jpg',
            coverPath: 'covers/saved_cover.jpg',
            rating: null,
            googleBooksId: 'gb_quijote_1'
          }
        }),
        updateStatus: vi.fn(),
        updateProgress: vi.fn(),
        rate: vi.fn(),
        delete: vi.fn()
      },
      notes: {
        getByBook: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn()
      },
      covers: {
        saveFromUrl: vi.fn().mockResolvedValue({
          success: true,
          data: 'covers/saved_cover.jpg'
        }),
        saveFromLocal: vi.fn()
      },
      search: {
        books: vi.fn().mockResolvedValue({
          success: true,
          data: mockBookResults
        })
      }
    } as unknown as typeof window.api
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('Tab Navigation and Default Tab', () => {
    it('opens with "Buscar en Google" as default active tab', () => {
      renderWithClient(h(AddBookModal, { isOpen: true, onClose: vi.fn() }))

      const searchTabButton = screen.getByTestId('tab-search')
      const manualTabButton = screen.getByTestId('tab-manual')
      const searchTabContent = screen.getByTestId('search-tab-content')
      const manualTabContent = screen.getByTestId('manual-tab-content')

      expect(searchTabButton.className).toContain('text-indigo-400')
      expect(manualTabButton.className).not.toContain('text-indigo-400')
      expect(searchTabContent.className).not.toContain('hidden')
      expect(manualTabContent.className).toContain('hidden')
    })

    it('switches between "Buscar en Google" and "Carga manual" tabs on click', () => {
      renderWithClient(h(AddBookModal, { isOpen: true, onClose: vi.fn() }))

      const searchTabButton = screen.getByTestId('tab-search')
      const manualTabButton = screen.getByTestId('tab-manual')
      const searchTabContent = screen.getByTestId('search-tab-content')
      const manualTabContent = screen.getByTestId('manual-tab-content')

      // Switch to manual
      fireEvent.click(manualTabButton)
      expect(manualTabContent.className).not.toContain('hidden')
      expect(searchTabContent.className).toContain('hidden')

      // Switch back to search
      fireEvent.click(searchTabButton)
      expect(searchTabContent.className).not.toContain('hidden')
      expect(manualTabContent.className).toContain('hidden')
    })

    it('displays min characters message when search input is empty or has < 3 chars', () => {
      renderWithClient(h(AddBookModal, { isOpen: true, onClose: vi.fn() }))

      const minCharsMsg = screen.getByTestId('search-min-chars-message')
      expect(minCharsMsg).toBeDefined()
      expect(minCharsMsg.textContent).toContain('Ingresa al menos 3 caracteres')
    })
  })

  describe('Search Execution & Debounce', () => {
    it('does not trigger search when typing less than 3 characters', async () => {
      vi.useFakeTimers()
      renderWithClient(h(AddBookModal, { isOpen: true, onClose: vi.fn() }))

      const input = screen.getByTestId('search-books-input')
      fireEvent.change(input, { target: { value: 'ab' } })

      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(window.api.search.books).not.toHaveBeenCalled()
    })

    it('automatically triggers search after 500ms debounce when typing 3 or more characters', async () => {
      vi.useFakeTimers()
      renderWithClient(h(AddBookModal, { isOpen: true, onClose: vi.fn() }))

      const input = screen.getByTestId('search-books-input')
      fireEvent.change(input, { target: { value: 'Don Quijote' } })

      // Before 500ms, search has not been called
      act(() => {
        vi.advanceTimersByTime(300)
      })
      expect(window.api.search.books).not.toHaveBeenCalled()

      // After 500ms, search is triggered
      await act(async () => {
        vi.advanceTimersByTime(250)
      })
      expect(window.api.search.books).toHaveBeenCalledWith('Don Quijote')
    })

    it('triggers search immediately when pressing Enter without waiting for debounce', async () => {
      renderWithClient(h(AddBookModal, { isOpen: true, onClose: vi.fn() }))

      const input = screen.getByTestId('search-books-input')
      fireEvent.change(input, { target: { value: 'Cervantes' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      await waitFor(() => {
        expect(window.api.search.books).toHaveBeenCalledWith('Cervantes')
      })
    })

    it('triggers search immediately when clicking the Search button', async () => {
      renderWithClient(h(AddBookModal, { isOpen: true, onClose: vi.fn() }))

      const input = screen.getByTestId('search-books-input')
      const searchButton = screen.getByTestId('search-books-button')

      fireEvent.change(input, { target: { value: 'Cervantes' } })
      fireEvent.click(searchButton)

      await waitFor(() => {
        expect(window.api.search.books).toHaveBeenCalledWith('Cervantes')
      })
    })

    it('displays error message if search fails', async () => {
      vi.mocked(window.api.search.books).mockResolvedValueOnce({
        success: false,
        error: 'Servicio no disponible'
      })

      renderWithClient(h(AddBookModal, { isOpen: true, onClose: vi.fn() }))

      const input = screen.getByTestId('search-books-input')
      fireEvent.change(input, { target: { value: 'Fallo' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      await waitFor(() => {
        const errorBanner = screen.getByTestId('search-error-banner')
        expect(errorBanner.textContent).toContain('Servicio no disponible')
      })
    })

    it('displays no-results message when search returns empty list', async () => {
      vi.mocked(window.api.search.books).mockResolvedValueOnce({
        success: true,
        data: []
      })

      renderWithClient(h(AddBookModal, { isOpen: true, onClose: vi.fn() }))

      const input = screen.getByTestId('search-books-input')
      fireEvent.change(input, { target: { value: 'LibroInexistenteXYZ' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      await waitFor(() => {
        const noResults = screen.getByTestId('search-no-results')
        expect(noResults.textContent).toContain('No se encontraron libros para “LibroInexistenteXYZ”')
      })
    })
  })

  describe('Search Results & Form Auto-fill', () => {
    it('renders result cards with title, authors, year, page count and cover', async () => {
      renderWithClient(h(AddBookModal, { isOpen: true, onClose: vi.fn() }))

      const input = screen.getByTestId('search-books-input')
      fireEvent.change(input, { target: { value: 'Quijote' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      await waitFor(() => {
        expect(screen.getByTestId('search-results-list')).toBeDefined()
        expect(screen.getByTestId('search-result-card-0')).toBeDefined()
        expect(screen.getByTestId('search-result-card-1')).toBeDefined()
      })

      const firstCard = screen.getByTestId('search-result-card-0')
      expect(firstCard.textContent).toContain('Don Quijote de la Mancha')
      expect(firstCard.textContent).toContain('Miguel de Cervantes Saavedra')
      expect(firstCard.textContent).toContain('1605')
      expect(firstCard.textContent).toContain('863 págs.')
      expect(firstCard.textContent).toContain('ISBN 9788424116286')
    })

    it('auto-fills manual form and switches to manual tab when clicking a result card', async () => {
      renderWithClient(h(AddBookModal, { isOpen: true, onClose: vi.fn() }))

      const input = screen.getByTestId('search-books-input')
      fireEvent.change(input, { target: { value: 'Quijote' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      await waitFor(() => {
        expect(screen.getByTestId('search-result-card-0')).toBeDefined()
      })

      // Click first card
      fireEvent.click(screen.getByTestId('search-result-card-0'))

      // Tab should switch to manual confirmation view
      const manualTabContent = screen.getByTestId('manual-tab-content')
      expect(manualTabContent.className).not.toContain('hidden')

      // Pre-fill notice should be visible
      expect(screen.getByTestId('prefill-notice')).toBeDefined()
      expect(screen.getByTestId('prefill-notice').textContent).toContain(
        'Datos autocompletados desde Google Books'
      )

      // Inputs should have populated values
      const titleInput = screen.getByTestId('input-book-title') as HTMLInputElement
      const authorsInput = screen.getByTestId('input-book-authors') as HTMLInputElement
      const pagesInput = screen.getByTestId('input-book-pages') as HTMLInputElement
      const isbnInput = screen.getByTestId('input-book-isbn') as HTMLInputElement
      const coverInput = screen.getByTestId('input-book-cover') as HTMLInputElement

      expect(titleInput.value).toBe('Don Quijote de la Mancha')
      expect(authorsInput.value).toBe('Miguel de Cervantes Saavedra')
      expect(pagesInput.value).toBe('863')
      expect(isbnInput.value).toBe('9788424116286')
      expect(coverInput.value).toBe('https://books.google.com/quijote.jpg')
    })

    it('downloads remote cover and saves book with googleBooksId on submit', async () => {
      const onClose = vi.fn()
      renderWithClient(h(AddBookModal, { isOpen: true, onClose }))

      const input = screen.getByTestId('search-books-input')
      fireEvent.change(input, { target: { value: 'Quijote' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      await waitFor(() => {
        expect(screen.getByTestId('search-result-card-0')).toBeDefined()
      })

      // Select book
      fireEvent.click(screen.getByTestId('search-result-card-0'))

      // Change initial status to READING
      const statusSelect = screen.getByTestId('select-book-status')
      fireEvent.change(statusSelect, { target: { value: BookStatus.READING } })

      // Submit form
      const submitButton = screen.getByTestId('submit-book-button')
      fireEvent.click(submitButton)

      await waitFor(() => {
        // Must download cover via window.api.covers.saveFromUrl
        expect(window.api.covers.saveFromUrl).toHaveBeenCalledWith(
          'https://books.google.com/quijote.jpg'
        )

        // Must create book with googleBooksId and downloaded coverPath
        expect(window.api.books.create).toHaveBeenCalledWith({
          title: 'Don Quijote de la Mancha',
          authors: ['Miguel de Cervantes Saavedra'],
          pageCount: 863,
          isbn: '9788424116286',
          status: BookStatus.READING,
          coverUrl: 'https://books.google.com/quijote.jpg',
          coverPath: 'covers/saved_cover.jpg',
          googleBooksId: 'gb_quijote_1'
        })

        expect(onClose).toHaveBeenCalledTimes(1)
      })
    })

    it('cancels modal when clicking cancel button inside search tab', () => {
      const onClose = vi.fn()
      renderWithClient(h(AddBookModal, { isOpen: true, onClose }))

      const cancelSearchButton = screen.getByTestId('cancel-search-button')
      fireEvent.click(cancelSearchButton)

      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })
})

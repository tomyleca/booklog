// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BookDetailPage } from '../../src/renderer/src/pages/BookDetailPage.js'
import { App } from '../../src/renderer/src/App.js'
import { BookStatus } from '../../src/shared/domain/entities/BookStatus.js'
import type { BookPrimitives, NotePrimitives } from '../../src/shared/infrastructure/ipc/contracts.js'

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

const sampleBookDetail: BookPrimitives = {
  id: 42,
  googleBooksId: 'gb-42',
  title: 'El Nombre del Viento',
  authors: 'Patrick Rothfuss',
  coverUrl: 'https://example.com/notw.jpg',
  coverPath: null,
  pageCount: 660,
  currentPage: 330,
  progressPercentage: 50,
  isbn: '978-8401352836',
  status: BookStatus.READING,
  rating: 4,
  createdAt: new Date('2026-01-01T10:00:00Z'),
  updatedAt: new Date('2026-01-02T12:00:00Z')
}

const sampleBookWithoutPages: BookPrimitives = {
  id: 43,
  googleBooksId: null,
  title: 'Poemas Completos',
  authors: 'Alejandra Pizarnik',
  coverUrl: null,
  coverPath: null,
  pageCount: null,
  currentPage: null,
  progressPercentage: 20,
  isbn: null,
  status: BookStatus.PAUSED,
  rating: null,
  createdAt: new Date('2026-01-03T10:00:00Z'),
  updatedAt: new Date('2026-01-04T12:00:00Z')
}

const sampleNotes: NotePrimitives[] = [
  {
    id: 101,
    bookId: 42,
    content: 'Cita favorita: Hay tres cosas que todo sabio teme.',
    createdAt: new Date('2026-01-05T14:30:00Z'),
    updatedAt: new Date('2026-01-05T14:30:00Z')
  },
  {
    id: 102,
    bookId: 42,
    content: 'Reflexión sobre el silencio de tres partes.',
    createdAt: new Date('2026-01-06T18:00:00Z'),
    updatedAt: new Date('2026-01-06T18:00:00Z')
  }
]

describe('Feature #11 - UI Book Detail View & Notes Management', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    window.api = {
      books: {
        list: vi.fn().mockResolvedValue({ success: true, data: [sampleBookDetail] }),
        getById: vi.fn().mockResolvedValue({ success: true, data: sampleBookDetail }),
        create: vi.fn().mockResolvedValue({ success: true, data: sampleBookDetail }),
        updateStatus: vi.fn().mockResolvedValue({
          success: true,
          data: { ...sampleBookDetail, status: BookStatus.FINISHED }
        }),
        updateProgress: vi.fn().mockResolvedValue({
          success: true,
          data: { ...sampleBookDetail, currentPage: 400, progressPercentage: 61 }
        }),
        rate: vi.fn().mockResolvedValue({
          success: true,
          data: { ...sampleBookDetail, rating: 5 }
        }),
        delete: vi.fn().mockResolvedValue({ success: true, data: undefined })
      },
      notes: {
        getByBook: vi.fn().mockResolvedValue({ success: true, data: sampleNotes }),
        create: vi.fn().mockResolvedValue({
          success: true,
          data: {
            id: 103,
            bookId: 42,
            content: 'Nueva nota creada',
            createdAt: new Date(),
            updatedAt: new Date()
          }
        }),
        update: vi.fn(),
        delete: vi.fn().mockResolvedValue({ success: true, data: undefined })
      },
      covers: {
        saveFromUrl: vi.fn(),
        saveFromLocal: vi.fn()
      },
      search: {
        searchGoogleBooks: vi.fn()
      }
    } as unknown as typeof window.api
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Metadata Rendering & Initial State', () => {
    it('shows loading state while fetching book details', () => {
      window.api.books.getById = vi.fn().mockReturnValue(new Promise(() => {}))
      renderWithClient(h(BookDetailPage, { bookId: 42, onBack: vi.fn() }))

      expect(screen.getByTestId('detail-loading')).toBeDefined()
    })

    it('shows error state when book fetch fails', async () => {
      window.api.books.getById = vi.fn().mockResolvedValue({
        success: false,
        error: 'Libro no encontrado'
      })

      renderWithClient(h(BookDetailPage, { bookId: 999, onBack: vi.fn() }))

      await waitFor(() => {
        expect(screen.getByTestId('detail-error')).toBeDefined()
      })
      expect(screen.getByText('Libro no encontrado')).toBeDefined()
    })

    it('renders full book metadata correctly including title, author, isbn and pages', async () => {
      renderWithClient(h(BookDetailPage, { bookId: 42, onBack: vi.fn() }))

      await waitFor(() => {
        expect(screen.getByTestId('detail-title')).toBeDefined()
      })

      expect(screen.getByTestId('detail-title').textContent).toBe('El Nombre del Viento')
      expect(screen.getByTestId('detail-authors').textContent).toBe('Patrick Rothfuss')
      expect(screen.getByTestId('detail-isbn').textContent).toContain('978-8401352836')
      expect(screen.getByTestId('detail-page-count').textContent).toContain('660 páginas')

      // Cover image
      const img = screen.getByTestId('detail-cover-image') as HTMLImageElement
      expect(img.src).toBe('https://example.com/notw.jpg')

      // Status selector
      const statusSelect = screen.getByTestId('detail-status-select') as HTMLSelectElement
      expect(statusSelect.value).toBe(BookStatus.READING)

      // Rating
      expect(screen.getByTestId('star-4-filled')).toBeDefined()
      expect(screen.getByTestId('star-5')).toBeDefined()
    })

    it('renders fallback placeholder when book has no cover or image fails to load', async () => {
      window.api.books.getById = vi.fn().mockResolvedValue({
        success: true,
        data: sampleBookWithoutPages
      })

      renderWithClient(h(BookDetailPage, { bookId: 43, onBack: vi.fn() }))

      await waitFor(() => {
        expect(screen.getByTestId('detail-cover-placeholder')).toBeDefined()
      })
    })

    it('switches to placeholder when cover image triggers onError', async () => {
      renderWithClient(h(BookDetailPage, { bookId: 42, onBack: vi.fn() }))

      await waitFor(() => {
        expect(screen.getByTestId('detail-cover-image')).toBeDefined()
      })

      const coverImg = screen.getByTestId('detail-cover-image')
      fireEvent.error(coverImg)

      await waitFor(() => {
        expect(screen.getByTestId('detail-cover-placeholder')).toBeDefined()
      })
    })
  })

  describe('Interactive Reading Progress (Direct Inline Editing)', () => {
    it('initializes inline inputs and progress bar with current progress', async () => {
      renderWithClient(h(BookDetailPage, { bookId: 42, onBack: vi.fn() }))

      await waitFor(() => {
        expect((screen.getByTestId('detail-progress-page-input') as HTMLInputElement).value).toBe('330')
      })

      const pageInput = screen.getByTestId('detail-progress-page-input') as HTMLInputElement
      const pctInput = screen.getByTestId('detail-progress-percentage-input') as HTMLInputElement
      const progressBar = screen.getByTestId('detail-progress-bar')

      expect(pageInput.value).toBe('330')
      expect(pctInput.value).toBe('50')
      expect(progressBar.style.width).toBe('50%')
    })

    it('synchronizes percentage input when page input is edited', async () => {
      renderWithClient(h(BookDetailPage, { bookId: 42, onBack: vi.fn() }))

      await waitFor(() => {
        expect(screen.getByTestId('detail-progress-page-input')).toBeDefined()
      })

      const pageInput = screen.getByTestId('detail-progress-page-input') as HTMLInputElement
      const pctInput = screen.getByTestId('detail-progress-percentage-input') as HTMLInputElement

      // Modify page to 495 (75% of 660)
      fireEvent.change(pageInput, { target: { value: '495' } })

      expect(pageInput.value).toBe('495')
      expect(pctInput.value).toBe('75')

      // Save button becomes enabled
      const saveBtn = screen.getByTestId('detail-save-progress-button')
      expect(saveBtn).not.toHaveProperty('disabled', true)
    })

    it('synchronizes page input when percentage input is edited', async () => {
      renderWithClient(h(BookDetailPage, { bookId: 42, onBack: vi.fn() }))

      await waitFor(() => {
        expect(screen.getByTestId('detail-progress-percentage-input')).toBeDefined()
      })

      const pageInput = screen.getByTestId('detail-progress-page-input') as HTMLInputElement
      const pctInput = screen.getByTestId('detail-progress-percentage-input') as HTMLInputElement

      // Modify percentage to 25% (25% of 660 is 165)
      fireEvent.change(pctInput, { target: { value: '25' } })

      expect(pctInput.value).toBe('25')
      expect(pageInput.value).toBe('165')
    })

    it('saves updated progress via bookService.updateProgress and displays success feedback', async () => {
      renderWithClient(h(BookDetailPage, { bookId: 42, onBack: vi.fn() }))

      await waitFor(() => {
        expect(screen.getByTestId('detail-progress-page-input')).toBeDefined()
      })

      const pageInput = screen.getByTestId('detail-progress-page-input')
      fireEvent.change(pageInput, { target: { value: '400' } })

      const saveBtn = screen.getByTestId('detail-save-progress-button')
      fireEvent.click(saveBtn)

      await waitFor(() => {
        expect(window.api.books.updateProgress).toHaveBeenCalledWith({
          id: 42,
          page: 400
        })
      })

      await waitFor(() => {
        expect(screen.getByTestId('progress-success-notice')).toBeDefined()
      })
    })

    it('displays error message if progress update fails', async () => {
      window.api.books.updateProgress = vi.fn().mockResolvedValue({
        success: false,
        error: 'La página actual no puede superar el total de páginas'
      })

      renderWithClient(h(BookDetailPage, { bookId: 42, onBack: vi.fn() }))

      await waitFor(() => {
        expect(screen.getByTestId('detail-progress-page-input')).toBeDefined()
      })

      const pageInput = screen.getByTestId('detail-progress-page-input')
      fireEvent.change(pageInput, { target: { value: '700' } })

      const saveBtn = screen.getByTestId('detail-save-progress-button')
      fireEvent.click(saveBtn)

      await waitFor(() => {
        expect(screen.getByTestId('progress-error-message')).toBeDefined()
      })
      expect(screen.getByTestId('progress-error-message').textContent).toContain(
        'La página actual no puede superar el total de páginas'
      )
    })
  })

  describe('Status & Rating Changes', () => {
    it('calls bookService.updateStatus when selecting a new status in dropdown', async () => {
      renderWithClient(h(BookDetailPage, { bookId: 42, onBack: vi.fn() }))

      await waitFor(() => {
        expect(screen.getByTestId('detail-status-select')).toBeDefined()
      })

      const statusSelect = screen.getByTestId('detail-status-select')
      fireEvent.change(statusSelect, { target: { value: BookStatus.FINISHED } })

      await waitFor(() => {
        expect(window.api.books.updateStatus).toHaveBeenCalledWith({
          id: 42,
          status: BookStatus.FINISHED
        })
      })
    })

    it('updates rating when clicking on a star', async () => {
      renderWithClient(h(BookDetailPage, { bookId: 42, onBack: vi.fn() }))

      await waitFor(() => {
        expect(screen.getByTestId('star-5')).toBeDefined()
      })

      fireEvent.click(screen.getByTestId('star-5'))

      await waitFor(() => {
        expect(window.api.books.rate).toHaveBeenCalledWith({
          id: 42,
          rating: 5
        })
      })
    })

    it('clears rating when clicking the same rating or using the clear button', async () => {
      renderWithClient(h(BookDetailPage, { bookId: 42, onBack: vi.fn() }))

      await waitFor(() => {
        expect(screen.getByTestId('detail-clear-rating-button')).toBeDefined()
      })

      fireEvent.click(screen.getByTestId('detail-clear-rating-button'))

      await waitFor(() => {
        expect(window.api.books.rate).toHaveBeenCalledWith({
          id: 42,
          rating: null
        })
      })
    })
  })

  describe('Notes Management (Listing, Creating, Deleting)', () => {
    it('renders the list of notes for the book', async () => {
      renderWithClient(h(BookDetailPage, { bookId: 42, onBack: vi.fn() }))

      await waitFor(() => {
        expect(screen.getByText('Cita favorita: Hay tres cosas que todo sabio teme.')).toBeDefined()
      })

      expect(screen.getByText('Reflexión sobre el silencio de tres partes.')).toBeDefined()
      expect(screen.getByTestId('notes-count-badge').textContent).toBe('2')
    })

    it('shows empty state when book has no notes', async () => {
      window.api.notes.getByBook = vi.fn().mockResolvedValue({
        success: true,
        data: []
      })

      renderWithClient(h(BookDetailPage, { bookId: 42, onBack: vi.fn() }))

      await waitFor(() => {
        expect(screen.getByTestId('no-notes-message')).toBeDefined()
      })
    })

    it('opens new note modal when clicking + Nueva Idea', async () => {
      renderWithClient(h(BookDetailPage, { bookId: 42, onBack: vi.fn() }))

      await waitFor(() => {
        expect(screen.getByTestId('add-note-button')).toBeDefined()
      })

      fireEvent.click(screen.getByTestId('add-note-button'))

      expect(screen.getByTestId('add-note-modal')).toBeDefined()
      expect(screen.getByTestId('note-content-input')).toBeDefined()
    })

    it('validates empty note content before submitting', async () => {
      renderWithClient(h(BookDetailPage, { bookId: 42, onBack: vi.fn() }))

      await waitFor(() => {
        expect(screen.getByTestId('add-note-button')).toBeDefined()
      })

      fireEvent.click(screen.getByTestId('add-note-button'))

      const submitBtn = screen.getByTestId('submit-note-button')
      fireEvent.click(submitBtn)

      expect(screen.getByTestId('note-content-error')).toBeDefined()
      expect(screen.getByTestId('note-content-error').textContent).toContain(
        'El contenido de la nota no puede estar vacío'
      )
      expect(window.api.notes.create).not.toHaveBeenCalled()
    })

    it('creates note successfully and closes modal', async () => {
      renderWithClient(h(BookDetailPage, { bookId: 42, onBack: vi.fn() }))

      await waitFor(() => {
        expect(screen.getByTestId('add-note-button')).toBeDefined()
      })

      fireEvent.click(screen.getByTestId('add-note-button'))

      const textarea = screen.getByTestId('note-content-input')
      fireEvent.change(textarea, { target: { value: 'Mi nueva reflexión genial' } })

      const submitBtn = screen.getByTestId('submit-note-button')
      fireEvent.click(submitBtn)

      await waitFor(() => {
        expect(window.api.notes.create).toHaveBeenCalledWith({
          bookId: 42,
          content: 'Mi nueva reflexión genial'
        })
      })

      await waitFor(() => {
        expect(screen.queryByTestId('add-note-modal')).toBeNull()
      })
    })

    it('deletes a note when clicking its delete button', async () => {
      renderWithClient(h(BookDetailPage, { bookId: 42, onBack: vi.fn() }))

      await waitFor(() => {
        expect(screen.getByTestId('delete-note-button-101')).toBeDefined()
      })

      fireEvent.click(screen.getByTestId('delete-note-button-101'))

      await waitFor(() => {
        expect(window.api.notes.delete).toHaveBeenCalledWith(101)
      })
    })
  })

  describe('Book Deletion with Confirmation Modal', () => {
    it('opens confirmation modal when clicking Eliminar libro', async () => {
      renderWithClient(h(BookDetailPage, { bookId: 42, onBack: vi.fn() }))

      await waitFor(() => {
        expect(screen.getByTestId('delete-book-button')).toBeDefined()
      })

      fireEvent.click(screen.getByTestId('delete-book-button'))

      expect(screen.getByTestId('delete-book-modal')).toBeDefined()
      expect(
        screen.getByText('¿Estás seguro de que deseas eliminar este libro? Se eliminarán también todas sus notas.')
      ).toBeDefined()
    })

    it('closes modal without deleting when clicking Cancelar', async () => {
      renderWithClient(h(BookDetailPage, { bookId: 42, onBack: vi.fn() }))

      await waitFor(() => {
        expect(screen.getByTestId('delete-book-button')).toBeDefined()
      })

      fireEvent.click(screen.getByTestId('delete-book-button'))
      expect(screen.getByTestId('delete-book-modal')).toBeDefined()

      fireEvent.click(screen.getByTestId('cancel-delete-book-button'))

      expect(screen.queryByTestId('delete-book-modal')).toBeNull()
      expect(window.api.books.delete).not.toHaveBeenCalled()
    })

    it('deletes book and navigates back on confirmation', async () => {
      const onBack = vi.fn()
      renderWithClient(h(BookDetailPage, { bookId: 42, onBack }))

      await waitFor(() => {
        expect(screen.getByTestId('delete-book-button')).toBeDefined()
      })

      fireEvent.click(screen.getByTestId('delete-book-button'))
      fireEvent.click(screen.getByTestId('confirm-delete-book-button'))

      await waitFor(() => {
        expect(window.api.books.delete).toHaveBeenCalledWith(42)
      })

      await waitFor(() => {
        expect(onBack).toHaveBeenCalled()
      })
    })
  })

  describe('Navigation & App Integration', () => {
    it('calls onBack callback when clicking Volver a la Biblioteca button', async () => {
      const onBack = vi.fn()
      renderWithClient(h(BookDetailPage, { bookId: 42, onBack }))

      await waitFor(() => {
        expect(screen.getByTestId('back-button')).toBeDefined()
      })

      fireEvent.click(screen.getByTestId('back-button'))
      expect(onBack).toHaveBeenCalledTimes(1)
    })

    it('navigates from LibraryPage to BookDetailPage on card click in App', async () => {
      const testClient = createTestQueryClient()
      render(h(App, { queryClient: testClient }))

      // Initially renders library page
      await waitFor(() => {
        expect(screen.getByTestId('library-page')).toBeDefined()
      })

      // Click the book card in the grid
      await waitFor(() => {
        expect(screen.getByText('El Nombre del Viento')).toBeDefined()
      })

      const card = screen.getByTestId('book-card')
      fireEvent.click(card)

      // Switches to book detail page
      await waitFor(() => {
        expect(screen.getByTestId('book-detail-page')).toBeDefined()
      })
      expect(screen.getByTestId('detail-title').textContent).toBe('El Nombre del Viento')

      // Clicking back in BookDetailPage returns to LibraryPage
      fireEvent.click(screen.getByTestId('back-button'))

      await waitFor(() => {
        expect(screen.getByTestId('library-page')).toBeDefined()
      })
    })

    it('supports opening directly in detail view via initialView', async () => {
      const testClient = createTestQueryClient()
      render(
        h(App, {
          queryClient: testClient,
          initialView: { type: 'detail', bookId: 42 }
        })
      )

      await waitFor(() => {
        expect(screen.getByTestId('book-detail-page')).toBeDefined()
      })
      expect(screen.getByTestId('detail-title').textContent).toBe('El Nombre del Viento')
    })
  })
})

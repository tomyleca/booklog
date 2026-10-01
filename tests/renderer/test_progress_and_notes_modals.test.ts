// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BookStatus } from '../../src/shared/domain/entities/BookStatus.js'
import type { BookPrimitives } from '../../src/shared/infrastructure/ipc/contracts.js'
import { UpdateProgressModal } from '../../src/renderer/src/components/UpdateProgressModal.js'
import { AddNoteModal } from '../../src/renderer/src/components/AddNoteModal.js'
import { BookDetailPage } from '../../src/renderer/src/pages/BookDetailPage.js'

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

const mockBookWithPages: BookPrimitives = {
  id: 10,
  googleBooksId: 'gbook-10',
  title: 'Clean Code',
  authors: 'Robert C. Martin',
  coverUrl: null,
  coverPath: null,
  pageCount: 400,
  currentPage: 100,
  progressPercentage: 25,
  isbn: '978-0132350884',
  status: BookStatus.READING,
  rating: 5,
  createdAt: new Date('2026-01-01T10:00:00Z'),
  updatedAt: new Date('2026-01-02T10:00:00Z')
}

const mockBookWithoutPages: BookPrimitives = {
  id: 20,
  googleBooksId: null,
  title: 'El Aleph',
  authors: 'Jorge Luis Borges',
  coverUrl: null,
  coverPath: null,
  pageCount: null,
  currentPage: null,
  progressPercentage: 40,
  isbn: null,
  status: BookStatus.READING,
  rating: 4,
  createdAt: new Date('2026-01-03T10:00:00Z'),
  updatedAt: new Date('2026-01-04T10:00:00Z')
}

describe('Feature #12: ui_book_progress_and_notes_modals', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    window.api = {
      books: {
        list: vi.fn().mockResolvedValue({ success: true, data: [mockBookWithPages] }),
        getById: vi.fn().mockResolvedValue({ success: true, data: mockBookWithPages }),
        create: vi.fn(),
        updateStatus: vi.fn().mockResolvedValue({
          success: true,
          data: { ...mockBookWithPages, status: BookStatus.FINISHED }
        }),
        updateProgress: vi.fn().mockResolvedValue({
          success: true,
          data: { ...mockBookWithPages, currentPage: 200, progressPercentage: 50 }
        }),
        rate: vi.fn(),
        delete: vi.fn()
      },
      notes: {
        getByBook: vi.fn().mockResolvedValue({ success: true, data: [] }),
        create: vi.fn().mockResolvedValue({
          success: true,
          data: {
            id: 999,
            bookId: 10,
            content: 'Excelente capítulo sobre funciones pequeñas.',
            createdAt: new Date(),
            updatedAt: new Date()
          }
        }),
        update: vi.fn(),
        delete: vi.fn()
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

  describe('UpdateProgressModal Component', () => {
    it('does not render when isOpen is false', () => {
      renderWithClient(
        h(UpdateProgressModal, {
          book: mockBookWithPages,
          isOpen: false,
          onClose: vi.fn()
        })
      )

      expect(screen.queryByTestId('update-progress-modal')).toBeNull()
    })

    it('renders with initial page mode when book has pageCount', () => {
      renderWithClient(
        h(UpdateProgressModal, {
          book: mockBookWithPages,
          isOpen: true,
          onClose: vi.fn()
        })
      )

      expect(screen.getByTestId('update-progress-modal')).toBeDefined()
      expect(screen.getByText('Clean Code')).toBeDefined()
      expect(screen.getByTestId('modal-progress-page-input')).toBeDefined()

      const pageInput = screen.getByTestId('modal-progress-page-input') as HTMLInputElement
      expect(pageInput.value).toBe('100')

      const badge = screen.getByTestId('equivalent-percentage-badge')
      expect(badge.textContent).toContain('25%')
    })

    it('calculates equivalent percentage dynamically as page changes', () => {
      renderWithClient(
        h(UpdateProgressModal, {
          book: mockBookWithPages,
          isOpen: true,
          onClose: vi.fn()
        })
      )

      const pageInput = screen.getByTestId('modal-progress-page-input')
      fireEvent.change(pageInput, { target: { value: '200' } })

      const badge = screen.getByTestId('equivalent-percentage-badge')
      expect(badge.textContent).toContain('50%')

      const fillBar = screen.getByTestId('modal-progress-bar-fill')
      expect(fillBar.getAttribute('style')).toContain('width: 50%')
    })

    it('switches to percentage mode and dynamically computes equivalent page', () => {
      renderWithClient(
        h(UpdateProgressModal, {
          book: mockBookWithPages,
          isOpen: true,
          onClose: vi.fn()
        })
      )

      const percentageTab = screen.getByTestId('progress-mode-percentage-btn')
      fireEvent.click(percentageTab)

      expect(screen.getByTestId('modal-progress-percentage-input')).toBeDefined()
      const pctInput = screen.getByTestId('modal-progress-percentage-input') as HTMLInputElement
      expect(pctInput.value).toBe('25')

      fireEvent.change(pctInput, { target: { value: '75' } })

      const pageBadge = screen.getByTestId('equivalent-page-badge')
      expect(pageBadge.textContent).toContain('300 / 400')
    })

    it('defaults to percentage mode when book has no pageCount', () => {
      renderWithClient(
        h(UpdateProgressModal, {
          book: mockBookWithoutPages,
          isOpen: true,
          onClose: vi.fn()
        })
      )

      expect(screen.getByTestId('modal-progress-percentage-input')).toBeDefined()
      expect(screen.queryByTestId('equivalent-page-badge')).toBeNull()
      expect(screen.queryByTestId('equivalent-percentage-badge')).toBeNull()
    })

    it('shows finish suggestion banner when progress reaches total pages', () => {
      renderWithClient(
        h(UpdateProgressModal, {
          book: mockBookWithPages,
          isOpen: true,
          onClose: vi.fn()
        })
      )

      expect(screen.queryByTestId('finish-suggestion-banner')).toBeNull()

      const pageInput = screen.getByTestId('modal-progress-page-input')
      fireEvent.change(pageInput, { target: { value: '400' } })

      expect(screen.getByTestId('finish-suggestion-banner')).toBeDefined()
      const checkbox = screen.getByTestId('finish-suggestion-checkbox') as HTMLInputElement
      expect(checkbox.checked).toBe(true)
    })

    it('shows finish suggestion banner when progress reaches 100% in percentage mode', () => {
      renderWithClient(
        h(UpdateProgressModal, {
          book: mockBookWithoutPages,
          isOpen: true,
          onClose: vi.fn()
        })
      )

      const pctInput = screen.getByTestId('modal-progress-percentage-input')
      fireEvent.change(pctInput, { target: { value: '100' } })

      expect(screen.getByTestId('finish-suggestion-banner')).toBeDefined()
      const checkbox = screen.getByTestId('finish-suggestion-checkbox') as HTMLInputElement
      expect(checkbox.checked).toBe(true)
    })

    it('submits progress update and marks book as FINISHED when banner checkbox is checked', async () => {
      const onClose = vi.fn()
      renderWithClient(
        h(UpdateProgressModal, {
          book: mockBookWithPages,
          isOpen: true,
          onClose
        })
      )

      const pageInput = screen.getByTestId('modal-progress-page-input')
      fireEvent.change(pageInput, { target: { value: '400' } })

      const submitBtn = screen.getByTestId('save-progress-modal-button')
      fireEvent.click(submitBtn)

      await waitFor(() => {
        expect(window.api.books.updateProgress).toHaveBeenCalledWith({
          id: 10,
          page: 400
        })
      })

      await waitFor(() => {
        expect(window.api.books.updateStatus).toHaveBeenCalledWith({
          id: 10,
          status: BookStatus.FINISHED
        })
      })

      expect(onClose).toHaveBeenCalled()
    })

    it('does not mark book as FINISHED when user unchecks completion suggestion', async () => {
      const onClose = vi.fn()
      renderWithClient(
        h(UpdateProgressModal, {
          book: mockBookWithPages,
          isOpen: true,
          onClose
        })
      )

      const pageInput = screen.getByTestId('modal-progress-page-input')
      fireEvent.change(pageInput, { target: { value: '400' } })

      const checkbox = screen.getByTestId('finish-suggestion-checkbox')
      fireEvent.click(checkbox)

      const submitBtn = screen.getByTestId('save-progress-modal-button')
      fireEvent.click(submitBtn)

      await waitFor(() => {
        expect(window.api.books.updateProgress).toHaveBeenCalledWith({
          id: 10,
          page: 400
        })
      })

      await waitFor(() => {
        expect(window.api.books.updateStatus).toHaveBeenCalledWith({
          id: 10,
          status: BookStatus.READING
        })
      })

      expect(onClose).toHaveBeenCalled()
    })

    it('displays error message when service rejects update', async () => {
      window.api.books.updateProgress = vi.fn().mockResolvedValue({
        success: false,
        error: 'Error de validación en base de datos'
      })

      renderWithClient(
        h(UpdateProgressModal, {
          book: mockBookWithPages,
          isOpen: true,
          onClose: vi.fn()
        })
      )

      const submitBtn = screen.getByTestId('save-progress-modal-button')
      fireEvent.click(submitBtn)

      await waitFor(() => {
        expect(screen.getByTestId('progress-modal-error')).toBeDefined()
        expect(screen.getByTestId('progress-modal-error').textContent).toContain(
          'Error de validación en base de datos'
        )
      })
    })

    it('closes on Escape key press and Cancel button click', () => {
      const onClose = vi.fn()
      renderWithClient(
        h(UpdateProgressModal, {
          book: mockBookWithPages,
          isOpen: true,
          onClose
        })
      )

      fireEvent.keyDown(window, { key: 'Escape' })
      expect(onClose).toHaveBeenCalledTimes(1)

      const cancelBtn = screen.getByTestId('cancel-progress-modal-button')
      fireEvent.click(cancelBtn)
      expect(onClose).toHaveBeenCalledTimes(2)
    })

    it('closes on backdrop click', () => {
      const onClose = vi.fn()
      renderWithClient(
        h(UpdateProgressModal, {
          book: mockBookWithPages,
          isOpen: true,
          onClose
        })
      )

      const backdrop = screen.getByTestId('update-progress-modal')
      fireEvent.click(backdrop)
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('AddNoteModal Component', () => {
    it('does not render when isOpen is false', () => {
      renderWithClient(
        h(AddNoteModal, {
          bookId: 10,
          isOpen: false,
          onClose: vi.fn()
        })
      )

      expect(screen.queryByTestId('add-note-modal')).toBeNull()
    })

    it('renders with bookTitle when provided', () => {
      renderWithClient(
        h(AddNoteModal, {
          bookId: 10,
          bookTitle: 'Clean Code',
          isOpen: true,
          onClose: vi.fn()
        })
      )

      expect(screen.getByTestId('add-note-modal')).toBeDefined()
      expect(screen.getByTestId('add-note-book-title').textContent).toBe('Clean Code')
    })

    it('shows error if submitted with empty content', () => {
      renderWithClient(
        h(AddNoteModal, {
          bookId: 10,
          isOpen: true,
          onClose: vi.fn()
        })
      )

      const submitBtn = screen.getByTestId('submit-note-button')
      fireEvent.click(submitBtn)

      expect(screen.getByTestId('note-content-error')).toBeDefined()
      expect(screen.getByTestId('note-content-error').textContent).toContain(
        'El contenido de la nota no puede estar vacío.'
      )
      expect(window.api.notes.create).not.toHaveBeenCalled()
    })

    it('submits on Ctrl+Enter keyboard shortcut', async () => {
      const onClose = vi.fn()
      renderWithClient(
        h(AddNoteModal, {
          bookId: 10,
          isOpen: true,
          onClose
        })
      )

      const textarea = screen.getByTestId('note-content-input')
      fireEvent.change(textarea, {
        target: { value: 'Una reflexión guardada con atajo de teclado' }
      })

      fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true })

      await waitFor(() => {
        expect(window.api.notes.create).toHaveBeenCalledWith({
          bookId: 10,
          content: 'Una reflexión guardada con atajo de teclado'
        })
      })

      expect(onClose).toHaveBeenCalled()
    })

    it('submits on Cmd+Enter keyboard shortcut', async () => {
      const onClose = vi.fn()
      renderWithClient(
        h(AddNoteModal, {
          bookId: 10,
          isOpen: true,
          onClose
        })
      )

      const textarea = screen.getByTestId('note-content-input')
      fireEvent.change(textarea, {
        target: { value: 'Reflexión desde Mac con Cmd+Enter' }
      })

      fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true })

      await waitFor(() => {
        expect(window.api.notes.create).toHaveBeenCalledWith({
          bookId: 10,
          content: 'Reflexión desde Mac con Cmd+Enter'
        })
      })

      expect(onClose).toHaveBeenCalled()
    })

    it('displays error message when noteService fails', async () => {
      window.api.notes.create = vi.fn().mockResolvedValue({
        success: false,
        error: 'Error interno al persistir la nota'
      })

      renderWithClient(
        h(AddNoteModal, {
          bookId: 10,
          isOpen: true,
          onClose: vi.fn()
        })
      )

      const textarea = screen.getByTestId('note-content-input')
      fireEvent.change(textarea, { target: { value: 'Prueba de fallo' } })

      const submitBtn = screen.getByTestId('submit-note-button')
      fireEvent.click(submitBtn)

      await waitFor(() => {
        expect(screen.getByTestId('note-content-error')).toBeDefined()
        expect(screen.getByTestId('note-content-error').textContent).toContain(
          'Error interno al persistir la nota'
        )
      })
    })

    it('closes on Escape key press and backdrop click', () => {
      const onClose = vi.fn()
      renderWithClient(
        h(AddNoteModal, {
          bookId: 10,
          isOpen: true,
          onClose
        })
      )

      fireEvent.keyDown(window, { key: 'Escape' })
      expect(onClose).toHaveBeenCalledTimes(1)

      const backdrop = screen.getByTestId('add-note-modal')
      fireEvent.click(backdrop)
      expect(onClose).toHaveBeenCalledTimes(2)
    })
  })

  describe('Integration in BookDetailPage', () => {
    it('opens UpdateProgressModal when clicking "Actualizar progreso..." button', async () => {
      renderWithClient(h(BookDetailPage, { bookId: 10, onBack: vi.fn() }))

      await waitFor(() => {
        expect(screen.getByTestId('open-update-progress-modal-button')).toBeDefined()
      })

      fireEvent.click(screen.getByTestId('open-update-progress-modal-button'))

      expect(screen.getByTestId('update-progress-modal')).toBeDefined()
      expect(screen.getByTestId('modal-progress-page-input')).toBeDefined()
    })

    it('opens AddNoteModal when clicking "+ Nueva Idea" button in BookDetailPage', async () => {
      renderWithClient(h(BookDetailPage, { bookId: 10, onBack: vi.fn() }))

      await waitFor(() => {
        expect(screen.getByTestId('add-note-button')).toBeDefined()
      })

      fireEvent.click(screen.getByTestId('add-note-button'))

      expect(screen.getByTestId('add-note-modal')).toBeDefined()
      expect(screen.getByTestId('add-note-book-title').textContent).toBe('Clean Code')
    })
  })
})

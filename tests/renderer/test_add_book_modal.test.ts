// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AddBookModal, type AddBookFormValues } from '../../src/renderer/src/components/AddBookModal.js'
import { LibraryPage } from '../../src/renderer/src/pages/LibraryPage.js'
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

describe('Feature #9 - UI Add Book Manual (AddBookModal)', () => {
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
            title: 'Libro Creado',
            authors: 'Autor Ejemplo',
            status: BookStatus.TO_READ,
            pageCount: 200,
            currentPage: 0,
            progressPercentage: 0,
            isbn: '1234567890',
            coverUrl: null,
            coverPath: null,
            rating: null
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
          data: 'covers/downloaded_cover.jpg'
        }),
        saveFromLocal: vi.fn()
      }
    } as unknown as typeof window.api
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Modal Lifecycle & Controls', () => {
    it('does not render when isOpen is false', () => {
      renderWithClient(h(AddBookModal, { isOpen: false, onClose: vi.fn() }))
      expect(screen.queryByTestId('add-book-modal')).toBeNull()
      expect(screen.queryByTestId('modal-backdrop')).toBeNull()
    })

    it('renders accessible dialog with title when isOpen is true', () => {
      renderWithClient(h(AddBookModal, { isOpen: true, onClose: vi.fn() }))
      expect(screen.getByTestId('add-book-modal')).toBeDefined()
      expect(screen.getByRole('dialog')).toBeDefined()
      expect(screen.getByTestId('modal-title').textContent).toBe('Agregar Libro')
    })

    it('invokes onClose when clicking the Cancel button', () => {
      const onClose = vi.fn()
      renderWithClient(h(AddBookModal, { isOpen: true, onClose }))

      const cancelButton = screen.getByTestId('cancel-button')
      fireEvent.click(cancelButton)

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('invokes onClose when clicking the top close (X) button', () => {
      const onClose = vi.fn()
      renderWithClient(h(AddBookModal, { isOpen: true, onClose }))

      const closeButton = screen.getByTestId('close-modal-button')
      fireEvent.click(closeButton)

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('invokes onClose when clicking outside on the backdrop overlay', () => {
      const onClose = vi.fn()
      renderWithClient(h(AddBookModal, { isOpen: true, onClose }))

      const backdrop = screen.getByTestId('modal-backdrop')
      fireEvent.click(backdrop)

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('does not invoke onClose when clicking inside the modal card', () => {
      const onClose = vi.fn()
      renderWithClient(h(AddBookModal, { isOpen: true, onClose }))

      const modalCard = screen.getByTestId('add-book-modal')
      fireEvent.click(modalCard)

      expect(onClose).not.toHaveBeenCalled()
    })

    it('invokes onClose when pressing the Escape key', () => {
      const onClose = vi.fn()
      renderWithClient(h(AddBookModal, { isOpen: true, onClose }))

      fireEvent.keyDown(window, { key: 'Escape' })

      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('Form Fields & Initial Values', () => {
    it('renders all form inputs with correct default values', () => {
      renderWithClient(h(AddBookModal, { isOpen: true, onClose: vi.fn() }))

      const titleInput = screen.getByTestId('input-book-title') as HTMLInputElement
      const authorsInput = screen.getByTestId('input-book-authors') as HTMLInputElement
      const pagesInput = screen.getByTestId('input-book-pages') as HTMLInputElement
      const isbnInput = screen.getByTestId('input-book-isbn') as HTMLInputElement
      const statusSelect = screen.getByTestId('select-book-status') as HTMLSelectElement
      const coverInput = screen.getByTestId('input-book-cover') as HTMLInputElement

      expect(titleInput.value).toBe('')
      expect(authorsInput.value).toBe('')
      expect(pagesInput.value).toBe('')
      expect(isbnInput.value).toBe('')
      expect(statusSelect.value).toBe(BookStatus.TO_READ)
      expect(coverInput.value).toBe('')
    })

    it('renders all status options in the select dropdown', () => {
      renderWithClient(h(AddBookModal, { isOpen: true, onClose: vi.fn() }))

      const statusSelect = screen.getByTestId('select-book-status') as HTMLSelectElement
      const options = Array.from(statusSelect.options).map((opt) => opt.value)

      expect(options).toEqual([
        BookStatus.TO_READ,
        BookStatus.READING,
        BookStatus.PAUSED,
        BookStatus.FINISHED,
        BookStatus.ABANDONED
      ])
    })

    it('pre-populates form when initialValues is passed', () => {
      const initialValues: Partial<AddBookFormValues> = {
        title: 'Cien Años de Soledad',
        authors: ['Gabriel García Márquez', 'Co-autor'],
        pageCount: 471,
        isbn: '9780307474728',
        status: BookStatus.READING,
        coverUrl: 'https://example.com/cover.jpg'
      }

      renderWithClient(h(AddBookModal, { isOpen: true, onClose: vi.fn(), initialValues }))

      expect((screen.getByTestId('input-book-title') as HTMLInputElement).value).toBe(
        'Cien Años de Soledad'
      )
      expect((screen.getByTestId('input-book-authors') as HTMLInputElement).value).toBe(
        'Gabriel García Márquez, Co-autor'
      )
      expect((screen.getByTestId('input-book-pages') as HTMLInputElement).value).toBe('471')
      expect((screen.getByTestId('input-book-isbn') as HTMLInputElement).value).toBe('9780307474728')
      expect((screen.getByTestId('select-book-status') as HTMLSelectElement).value).toBe(
        BookStatus.READING
      )
      expect((screen.getByTestId('input-book-cover') as HTMLInputElement).value).toBe(
        'https://example.com/cover.jpg'
      )
    })

    it('renders modular search slot when renderSearchSlot prop is supplied (Feature #10 compatibility)', () => {
      const renderSearchSlot = () =>
        h('div', { 'data-testid': 'custom-google-search' }, 'Google Books Search Slot')

      renderWithClient(
        h(AddBookModal, { isOpen: true, onClose: vi.fn(), renderSearchSlot })
      )

      expect(screen.getByTestId('search-slot')).toBeDefined()
      expect(screen.getByTestId('custom-google-search')).toBeDefined()
      expect(screen.getByText('Google Books Search Slot')).toBeDefined()
    })
  })

  describe('Form Validation', () => {
    it('shows validation error when title is empty and prevents submission', async () => {
      const createSpy = vi.spyOn(bookService, 'create')
      renderWithClient(h(AddBookModal, { isOpen: true, onClose: vi.fn() }))

      const submitButton = screen.getByTestId('submit-book-button')
      fireEvent.click(submitButton)

      expect(screen.getByTestId('title-error')).toBeDefined()
      expect(screen.getByTestId('title-error').textContent).toContain('El título es obligatorio')
      expect(createSpy).not.toHaveBeenCalled()
    })

    it('clears title validation error when user types into title field', () => {
      renderWithClient(h(AddBookModal, { isOpen: true, onClose: vi.fn() }))

      // Trigger error
      fireEvent.click(screen.getByTestId('submit-book-button'))
      expect(screen.getByTestId('title-error')).toBeDefined()

      // Type title
      const titleInput = screen.getByTestId('input-book-title')
      fireEvent.change(titleInput, { target: { value: 'Rayuela' } })

      expect(screen.queryByTestId('title-error')).toBeNull()
    })

    it('validates that pages must be a positive integer if provided', async () => {
      const createSpy = vi.spyOn(bookService, 'create')
      renderWithClient(h(AddBookModal, { isOpen: true, onClose: vi.fn() }))

      fireEvent.change(screen.getByTestId('input-book-title'), {
        target: { value: 'Ficciones' }
      })
      fireEvent.change(screen.getByTestId('input-book-pages'), {
        target: { value: '-10' }
      })

      fireEvent.click(screen.getByTestId('submit-book-button'))

      expect(screen.getByTestId('pages-error')).toBeDefined()
      expect(screen.getByTestId('pages-error').textContent).toContain(
        'La cantidad de páginas debe ser un entero mayor a 0'
      )
      expect(createSpy).not.toHaveBeenCalled()
    })
  })

  describe('Form Submission & IPC / TanStack Query Integration', () => {
    it('submits form successfully with parsed authors array and default TO_READ status', async () => {
      const onClose = vi.fn()
      const client = createTestQueryClient()
      const invalidateSpy = vi.spyOn(client, 'invalidateQueries')

      const createSpy = vi.spyOn(bookService, 'create').mockResolvedValueOnce({
        success: true,
        data: {
          id: 10,
          title: 'El Túnel',
          authors: 'Ernesto Sabato',
          status: BookStatus.TO_READ
        } as BookPrimitives
      })

      renderWithClient(h(AddBookModal, { isOpen: true, onClose }), client)

      fireEvent.change(screen.getByTestId('input-book-title'), {
        target: { value: 'El Túnel' }
      })
      fireEvent.change(screen.getByTestId('input-book-authors'), {
        target: { value: '  Ernesto Sabato  ' }
      })
      fireEvent.change(screen.getByTestId('input-book-pages'), {
        target: { value: '170' }
      })
      fireEvent.change(screen.getByTestId('input-book-isbn'), {
        target: { value: '9788437604374' }
      })

      fireEvent.click(screen.getByTestId('submit-book-button'))

      await waitFor(() => {
        expect(createSpy).toHaveBeenCalledWith({
          title: 'El Túnel',
          authors: ['Ernesto Sabato'],
          pageCount: 170,
          isbn: '9788437604374',
          status: BookStatus.TO_READ,
          coverUrl: null,
          coverPath: null
        })
      })

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['books'] })
        expect(onClose).toHaveBeenCalledTimes(1)
      })
    })

    it('processes multiple comma-separated authors into a clean string array', async () => {
      const createSpy = vi.spyOn(bookService, 'create').mockResolvedValueOnce({
        success: true,
        data: { id: 11, title: 'Antología Poética', authors: 'Autor 1, Autor 2, Autor 3' } as BookPrimitives
      })

      renderWithClient(h(AddBookModal, { isOpen: true, onClose: vi.fn() }))

      fireEvent.change(screen.getByTestId('input-book-title'), {
        target: { value: 'Antología Poética' }
      })
      fireEvent.change(screen.getByTestId('input-book-authors'), {
        target: { value: 'Jorge Luis Borges, Adolfo Bioy Casares, Silvina Ocampo' }
      })

      fireEvent.click(screen.getByTestId('submit-book-button'))

      await waitFor(() => {
        expect(createSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Antología Poética',
            authors: ['Jorge Luis Borges', 'Adolfo Bioy Casares', 'Silvina Ocampo']
          })
        )
      })
    })

    it('downloads external cover URL via window.api.covers.saveFromUrl and sets coverPath', async () => {
      const saveFromUrlSpy = vi.spyOn(window.api.covers, 'saveFromUrl').mockResolvedValueOnce({
        success: true,
        data: 'covers/quijote_123.jpg'
      })

      const createSpy = vi.spyOn(bookService, 'create').mockResolvedValueOnce({
        success: true,
        data: { id: 12, title: 'Don Quijote' } as BookPrimitives
      })

      renderWithClient(h(AddBookModal, { isOpen: true, onClose: vi.fn() }))

      fireEvent.change(screen.getByTestId('input-book-title'), {
        target: { value: 'Don Quijote' }
      })
      fireEvent.change(screen.getByTestId('input-book-cover'), {
        target: { value: 'https://images.example.com/quijote.jpg' }
      })

      fireEvent.click(screen.getByTestId('submit-book-button'))

      await waitFor(() => {
        expect(saveFromUrlSpy).toHaveBeenCalledWith('https://images.example.com/quijote.jpg')
      })

      await waitFor(() => {
        expect(createSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Don Quijote',
            coverUrl: 'https://images.example.com/quijote.jpg',
            coverPath: 'covers/quijote_123.jpg'
          })
        )
      })
    })

    it('handles cover download failure gracefully by creating book without coverPath', async () => {
      vi.spyOn(window.api.covers, 'saveFromUrl').mockRejectedValueOnce(
        new Error('Network error')
      )

      const createSpy = vi.spyOn(bookService, 'create').mockResolvedValueOnce({
        success: true,
        data: { id: 13, title: 'Libro Sin Portada Local' } as BookPrimitives
      })

      renderWithClient(h(AddBookModal, { isOpen: true, onClose: vi.fn() }))

      fireEvent.change(screen.getByTestId('input-book-title'), {
        target: { value: 'Libro Sin Portada Local' }
      })
      fireEvent.change(screen.getByTestId('input-book-cover'), {
        target: { value: 'https://example.com/fail.jpg' }
      })

      fireEvent.click(screen.getByTestId('submit-book-button'))

      await waitFor(() => {
        expect(createSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Libro Sin Portada Local',
            coverUrl: 'https://example.com/fail.jpg',
            coverPath: null
          })
        )
      })
    })

    it('assigns local cover path directly without calling saveFromUrl', async () => {
      const saveFromUrlSpy = vi.spyOn(window.api.covers, 'saveFromUrl')
      const createSpy = vi.spyOn(bookService, 'create').mockResolvedValueOnce({
        success: true,
        data: { id: 14, title: 'Libro Local' } as BookPrimitives
      })

      renderWithClient(h(AddBookModal, { isOpen: true, onClose: vi.fn() }))

      fireEvent.change(screen.getByTestId('input-book-title'), {
        target: { value: 'Libro Local' }
      })
      fireEvent.change(screen.getByTestId('input-book-cover'), {
        target: { value: 'covers/local_cover.jpg' }
      })

      fireEvent.click(screen.getByTestId('submit-book-button'))

      await waitFor(() => {
        expect(saveFromUrlSpy).not.toHaveBeenCalled()
        expect(createSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Libro Local',
            coverUrl: null,
            coverPath: 'covers/local_cover.jpg'
          })
        )
      })
    })

    it('displays error banner if bookService.create fails', async () => {
      vi.spyOn(bookService, 'create').mockResolvedValueOnce({
        success: false,
        error: 'El ISBN ya se encuentra registrado.'
      })

      renderWithClient(h(AddBookModal, { isOpen: true, onClose: vi.fn() }))

      fireEvent.change(screen.getByTestId('input-book-title'), {
        target: { value: 'Libro Duplicado' }
      })

      fireEvent.click(screen.getByTestId('submit-book-button'))

      await waitFor(() => {
        expect(screen.getByTestId('form-error-banner')).toBeDefined()
        expect(screen.getByTestId('form-error-banner').textContent).toContain(
          'El ISBN ya se encuentra registrado.'
        )
      })
    })
  })

  describe('LibraryPage Integration with AddBookModal', () => {
    it('renders "+ Agregar Libro" button in LibraryPage header', async () => {
      vi.spyOn(bookService, 'list').mockResolvedValueOnce({
        success: true,
        data: []
      })

      renderWithClient(h(LibraryPage))

      const addButton = screen.getByTestId('add-book-button')
      expect(addButton).toBeDefined()
      expect(addButton.textContent).toContain('+ Agregar Libro')
    })

    it('opens AddBookModal when "+ Agregar Libro" is clicked in LibraryPage', async () => {
      vi.spyOn(bookService, 'list').mockResolvedValueOnce({
        success: true,
        data: []
      })

      renderWithClient(h(LibraryPage))

      expect(screen.queryByTestId('add-book-modal')).toBeNull()

      fireEvent.click(screen.getByTestId('add-book-button'))

      expect(screen.getByTestId('add-book-modal')).toBeDefined()
      expect(screen.getByTestId('modal-title').textContent).toBe('Agregar Libro')
    })

    it('closes AddBookModal and refreshes list after adding a book from LibraryPage', async () => {
      const listSpy = vi.spyOn(bookService, 'list')
      listSpy.mockResolvedValueOnce({
        success: true,
        data: []
      })

      const newBook: BookPrimitives = {
        id: 99,
        title: 'Nuevo Libro Agregado',
        authors: 'Autor Genial',
        status: BookStatus.TO_READ,
        pageCount: 300,
        currentPage: 0,
        progressPercentage: 0,
        rating: null,
        coverUrl: null,
        coverPath: null
      }

      vi.spyOn(bookService, 'create').mockResolvedValueOnce({
        success: true,
        data: newBook
      })

      renderWithClient(h(LibraryPage))

      await waitFor(() => {
        expect(screen.getByTestId('empty-library-state')).toBeDefined()
      })

      // Open modal
      fireEvent.click(screen.getByTestId('add-book-button'))
      expect(screen.getByTestId('add-book-modal')).toBeDefined()

      // Mock next list query response with the new book
      listSpy.mockResolvedValueOnce({
        success: true,
        data: [newBook]
      })

      // Fill in and submit
      fireEvent.change(screen.getByTestId('input-book-title'), {
        target: { value: 'Nuevo Libro Agregado' }
      })
      fireEvent.change(screen.getByTestId('input-book-authors'), {
        target: { value: 'Autor Genial' }
      })

      fireEvent.click(screen.getByTestId('submit-book-button'))

      // Modal closes
      await waitFor(() => {
        expect(screen.queryByTestId('add-book-modal')).toBeNull()
      })

      // LibraryPage renders the newly added book
      await waitFor(() => {
        expect(screen.getByText('Nuevo Libro Agregado')).toBeDefined()
        expect(screen.getByText('Autor Genial')).toBeDefined()
      })
    })
  })
})

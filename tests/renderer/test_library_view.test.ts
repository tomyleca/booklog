// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StatusFilterTabs } from '../../src/renderer/src/components/StatusFilterTabs.js'
import { BookCard } from '../../src/renderer/src/components/BookCard.js'
import { BookGrid } from '../../src/renderer/src/components/BookGrid.js'
import { EmptyLibraryState } from '../../src/renderer/src/components/EmptyLibraryState.js'
import { LibraryPage } from '../../src/renderer/src/pages/LibraryPage.js'
import { App } from '../../src/renderer/src/App.js'
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
      }
    }
  })
}

function renderWithClient(ui: React.ReactElement, client = createTestQueryClient()) {
  return render(h(QueryClientProvider, { client }, ui))
}

const sampleBookReading: BookPrimitives = {
  id: 1,
  title: 'El Quijote de la Mancha',
  authors: 'Miguel de Cervantes',
  coverUrl: 'https://example.com/quijote.jpg',
  coverPath: null,
  pageCount: 500,
  currentPage: 325,
  progressPercentage: 65,
  status: BookStatus.READING,
  rating: 4
}

const sampleBookFinished: BookPrimitives = {
  id: 2,
  title: 'Cien Años de Soledad',
  authors: 'Gabriel García Márquez',
  coverUrl: null,
  coverPath: null,
  pageCount: 400,
  currentPage: 400,
  progressPercentage: 100,
  status: BookStatus.FINISHED,
  rating: 5
}

const sampleBookToRead: BookPrimitives = {
  id: 3,
  title: 'Ficciones',
  authors: 'Jorge Luis Borges',
  coverUrl: null,
  coverPath: null,
  pageCount: 200,
  currentPage: 0,
  progressPercentage: 0,
  status: BookStatus.TO_READ,
  rating: null
}

const sampleBookPaused: BookPrimitives = {
  id: 4,
  title: 'Rayuela',
  authors: 'Julio Cortázar',
  coverUrl: null,
  coverPath: null,
  pageCount: 600,
  currentPage: 150,
  progressPercentage: 25,
  status: BookStatus.PAUSED,
  rating: 3
}

const sampleBookAbandoned: BookPrimitives = {
  id: 5,
  title: 'En busca del tiempo perdido',
  authors: 'Marcel Proust',
  coverUrl: null,
  coverPath: null,
  pageCount: 1000,
  currentPage: 100,
  progressPercentage: 10,
  status: BookStatus.ABANDONED,
  rating: 2
}

describe('Feature #8 - UI Library View', () => {
  describe('StatusFilterTabs Component', () => {
    it('renders all filter options correctly', () => {
      render(h(StatusFilterTabs, { selectedStatus: 'ALL', onSelectStatus: vi.fn() }))

      expect(screen.getByText('Todos')).toBeDefined()
      expect(screen.getByText('Por leer')).toBeDefined()
      expect(screen.getByText('Leyendo')).toBeDefined()
      expect(screen.getByText('Pausados')).toBeDefined()
      expect(screen.getByText('Terminados')).toBeDefined()
      expect(screen.getByText('Abandonados')).toBeDefined()
    })

    it('highlights the active tab with aria-selected true', () => {
      render(h(StatusFilterTabs, { selectedStatus: 'READING', onSelectStatus: vi.fn() }))

      const activeTab = screen.getByTestId('tab-reading')
      expect(activeTab.getAttribute('aria-selected')).toBe('true')

      const inactiveTab = screen.getByTestId('tab-to_read')
      expect(inactiveTab.getAttribute('aria-selected')).toBe('false')
    })

    it('triggers onSelectStatus callback when a tab is clicked', () => {
      const onSelectStatus = vi.fn()
      render(h(StatusFilterTabs, { selectedStatus: 'ALL', onSelectStatus }))

      const finishedTab = screen.getByTestId('tab-finished')
      fireEvent.click(finishedTab)

      expect(onSelectStatus).toHaveBeenCalledWith('FINISHED')
    })

    it('displays count badges when counts prop is provided', () => {
      const counts = { ALL: 12, READING: 3, FINISHED: 5 }
      render(h(StatusFilterTabs, { selectedStatus: 'ALL', onSelectStatus: vi.fn(), counts }))

      expect(screen.getByText('12')).toBeDefined()
      expect(screen.getByText('3')).toBeDefined()
      expect(screen.getByText('5')).toBeDefined()
    })
  })

  describe('BookCard Component', () => {
    it('renders book title and authors', () => {
      render(h(BookCard, { book: sampleBookReading }))

      expect(screen.getByTestId('book-title').textContent).toBe('El Quijote de la Mancha')
      expect(screen.getByTestId('book-authors').textContent).toBe('Miguel de Cervantes')
    })

    it('renders distinctive status badges for each status', () => {
      const { rerender } = render(h(BookCard, { book: sampleBookReading }))
      expect(screen.getByTestId('book-status-badge').textContent).toBe('Leyendo')

      rerender(h(BookCard, { book: sampleBookFinished }))
      expect(screen.getByTestId('book-status-badge').textContent).toBe('Terminado')

      rerender(h(BookCard, { book: sampleBookToRead }))
      expect(screen.getByTestId('book-status-badge').textContent).toBe('Por leer')

      rerender(h(BookCard, { book: sampleBookPaused }))
      expect(screen.getByTestId('book-status-badge').textContent).toBe('Pausado')

      rerender(h(BookCard, { book: sampleBookAbandoned }))
      expect(screen.getByTestId('book-status-badge').textContent).toBe('Abandonado')
    })

    it('renders progress bar ONLY with clean percentage for states with progress (READING, PAUSED, ABANDONED)', () => {
      const { rerender } = render(h(BookCard, { book: sampleBookReading }))
      const progressReading = screen.getByTestId('book-progress')
      expect(progressReading.textContent).toBe('65%')

      rerender(h(BookCard, { book: sampleBookPaused }))
      const progressPaused = screen.getByTestId('book-progress')
      expect(progressPaused.textContent).toBe('25%')

      rerender(h(BookCard, { book: sampleBookAbandoned }))
      const progressAbandoned = screen.getByTestId('book-progress')
      expect(progressAbandoned.textContent).toBe('10%')
    })

    it('does NOT render progress bar for TO_READ or FINISHED books', () => {
      const { rerender } = render(h(BookCard, { book: sampleBookToRead }))
      expect(screen.queryByTestId('book-progress')).toBeNull()

      rerender(h(BookCard, { book: sampleBookFinished }))
      expect(screen.queryByTestId('book-progress')).toBeNull()
    })

    it('calculates progress percentage from currentPage and pageCount if progressPercentage is not present', () => {
      const bookWithoutDirectPercentage: BookPrimitives = {
        ...sampleBookReading,
        currentPage: 50,
        pageCount: 200,
        progressPercentage: null
      }
      render(h(BookCard, { book: bookWithoutDirectPercentage }))
      expect(screen.getByTestId('book-progress').textContent).toBe('25%')
    })

    it('renders cover image when valid URL is available', () => {
      render(h(BookCard, { book: sampleBookReading }))
      const img = screen.getByTestId('book-cover-image') as HTMLImageElement
      expect(img).toBeDefined()
      expect(img.src).toBe('https://example.com/quijote.jpg')
      expect(screen.queryByTestId('book-cover-placeholder')).toBeNull()
    })

    it('renders neutral placeholder with BookOpen icon when cover is not available', () => {
      render(h(BookCard, { book: sampleBookToRead }))
      expect(screen.queryByTestId('book-cover-image')).toBeNull()
      expect(screen.getByTestId('book-cover-placeholder')).toBeDefined()
    })

    it('falls back to neutral placeholder if image fails to load (onError)', () => {
      render(h(BookCard, { book: sampleBookReading }))
      const img = screen.getByTestId('book-cover-image')
      fireEvent.error(img)

      expect(screen.queryByTestId('book-cover-image')).toBeNull()
      expect(screen.getByTestId('book-cover-placeholder')).toBeDefined()
    })

    it('renders 5 star rating correctly based on rating value', () => {
      const { rerender } = render(h(BookCard, { book: sampleBookReading })) // rating 4
      expect(screen.getByTestId('star-1-filled')).toBeDefined()
      expect(screen.getByTestId('star-2-filled')).toBeDefined()
      expect(screen.getByTestId('star-3-filled')).toBeDefined()
      expect(screen.getByTestId('star-4-filled')).toBeDefined()
      expect(screen.getByTestId('star-5')).toBeDefined()

      rerender(h(BookCard, { book: sampleBookToRead })) // rating null -> 0 filled
      expect(screen.getByTestId('star-1')).toBeDefined()
      expect(screen.getByTestId('star-5')).toBeDefined()
    })

    it('invokes onClick callback with book when clicked', () => {
      const onClick = vi.fn()
      render(h(BookCard, { book: sampleBookReading, onClick }))

      fireEvent.click(screen.getByTestId('book-card'))
      expect(onClick).toHaveBeenCalledWith(sampleBookReading)
    })
  })

  describe('BookGrid Component', () => {
    it('renders responsive grid with books', () => {
      render(
        h(BookGrid, {
          books: [sampleBookReading, sampleBookFinished, sampleBookToRead]
        })
      )

      const grid = screen.getByTestId('book-grid')
      expect(grid.className).toContain('grid')
      expect(grid.className).toContain('sm:grid-cols-2')
      expect(grid.className).toContain('md:grid-cols-3')
      expect(grid.className).toContain('lg:grid-cols-4')

      const cards = screen.getAllByTestId('book-card')
      expect(cards.length).toBe(3)
    })
  })

  describe('EmptyLibraryState Component', () => {
    it('displays general empty library message when filter is ALL', () => {
      render(h(EmptyLibraryState, { filter: 'ALL' }))

      expect(screen.getByTestId('empty-state-title').textContent).toBe('Tu biblioteca está vacía')
      expect(screen.queryByTestId('reset-filter-button')).toBeNull()
    })

    it('displays filtered empty message and reset button when filter is specific', () => {
      const onReset = vi.fn()
      render(h(EmptyLibraryState, { filter: 'FINISHED', onResetFilter: onReset }))

      expect(screen.getByTestId('empty-state-title').textContent).toBe(
        'No hay libros con este estado'
      )
      const resetBtn = screen.getByTestId('reset-filter-button')
      expect(resetBtn).toBeDefined()

      fireEvent.click(resetBtn)
      expect(onReset).toHaveBeenCalledTimes(1)
    })
  })

  describe('LibraryPage Integration', () => {
    beforeEach(() => {
      vi.restoreAllMocks()
    })

    it('renders loading state initially and then displays books when fetch succeeds', async () => {
      vi.spyOn(bookService, 'list').mockResolvedValueOnce({
        success: true,
        data: [sampleBookReading, sampleBookFinished]
      })

      renderWithClient(h(LibraryPage))

      expect(screen.getByTestId('loading-state')).toBeDefined()
      expect(screen.getByText('Cargando biblioteca...')).toBeDefined()

      await waitFor(() => {
        expect(screen.queryByTestId('loading-state')).toBeNull()
      })

      expect(screen.getByTestId('library-title').textContent).toBe('Mi Biblioteca')
      expect(screen.getByTestId('library-book-count').textContent).toBe('2 libros')
      expect(screen.getAllByTestId('book-card').length).toBe(2)
      expect(screen.getByText('El Quijote de la Mancha')).toBeDefined()
      expect(screen.getByText('Cien Años de Soledad')).toBeDefined()
    })

    it('filters books by clicking on status filter tabs', async () => {
      const listSpy = vi.spyOn(bookService, 'list')
      listSpy.mockResolvedValueOnce({
        success: true,
        data: [sampleBookReading, sampleBookFinished]
      })

      renderWithClient(h(LibraryPage))

      await waitFor(() => {
        expect(screen.queryByTestId('loading-state')).toBeNull()
      })

      expect(listSpy).toHaveBeenCalledWith(undefined)

      // Click on "Leyendo" tab
      listSpy.mockResolvedValueOnce({
        success: true,
        data: [sampleBookReading]
      })

      fireEvent.click(screen.getByTestId('tab-reading'))

      await waitFor(() => {
        expect(listSpy).toHaveBeenCalledWith({ status: 'READING' })
      })

      await waitFor(() => {
        expect(screen.getAllByTestId('book-card').length).toBe(1)
      })
      expect(screen.getByText('El Quijote de la Mancha')).toBeDefined()
    })

    it('shows empty state when library has no books', async () => {
      vi.spyOn(bookService, 'list').mockResolvedValueOnce({
        success: true,
        data: []
      })

      renderWithClient(h(LibraryPage))

      await waitFor(() => {
        expect(screen.queryByTestId('loading-state')).toBeNull()
      })

      expect(screen.getByTestId('empty-library-state')).toBeDefined()
      expect(screen.getByText('Tu biblioteca está vacía')).toBeDefined()
    })

    it('shows error state when bookService returns success: false', async () => {
      vi.spyOn(bookService, 'list').mockResolvedValueOnce({
        success: false,
        error: 'Fallo al conectar con la base de datos'
      })

      renderWithClient(h(LibraryPage))

      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeDefined()
      })

      expect(screen.getByTestId('error-message').textContent).toContain(
        'Fallo al conectar con la base de datos'
      )
      expect(screen.getByTestId('retry-button')).toBeDefined()
    })

    it('refetches when retry button is clicked after error', async () => {
      const listSpy = vi.spyOn(bookService, 'list')
      listSpy.mockResolvedValueOnce({
        success: false,
        error: 'Error de red temporal'
      })

      renderWithClient(h(LibraryPage))

      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeDefined()
      })

      // Next call succeeds
      listSpy.mockResolvedValueOnce({
        success: true,
        data: [sampleBookReading]
      })

      fireEvent.click(screen.getByTestId('retry-button'))

      await waitFor(() => {
        expect(screen.queryByTestId('error-state')).toBeNull()
      })
      expect(screen.getByText('El Quijote de la Mancha')).toBeDefined()
    })
  })

  describe('App Component', () => {
    it('renders LibraryPage inside QueryClientProvider', async () => {
      vi.spyOn(bookService, 'list').mockResolvedValueOnce({
        success: true,
        data: [sampleBookReading]
      })

      const testClient = createTestQueryClient()
      render(h(App, { queryClient: testClient }))

      expect(screen.getByTestId('library-page')).toBeDefined()

      await waitFor(() => {
        expect(screen.queryByTestId('loading-state')).toBeNull()
      })
      expect(screen.getByText('El Quijote de la Mancha')).toBeDefined()
    })
  })
})

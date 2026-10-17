// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import React from 'react'
import { readFileSync } from 'fs'
import { join, resolve } from 'path'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BookCard } from '../../src/renderer/src/components/BookCard.js'
import { BookGrid } from '../../src/renderer/src/components/BookGrid.js'
import { LibraryPage } from '../../src/renderer/src/pages/LibraryPage.js'
import { bookService } from '../../src/renderer/src/services/bookService.js'
import { BookStatus } from '../../src/shared/domain/entities/BookStatus.js'
import type { BookPrimitives } from '../../src/shared/infrastructure/ipc/contracts.js'

const h = React.createElement

const MAIN_CSS = readFileSync(
  join(resolve(__dirname, '../..'), 'src/renderer/src/assets/main.css'),
  'utf-8'
)

function utilityBlock(name: string): string {
  const match = new RegExp(`@utility ${name}\\s*\\{`).exec(MAIN_CSS)
  if (!match) return ''
  const start = MAIN_CSS.indexOf('{', match.index) + 1
  let depth = 1
  let i = start
  while (i < MAIN_CSS.length && depth > 0) {
    if (MAIN_CSS[i] === '{') depth++
    if (MAIN_CSS[i] === '}') depth--
    i++
  }
  return MAIN_CSS.slice(start, i - 1)
}

function makeBook(overrides: Partial<BookPrimitives>): BookPrimitives {
  return {
    id: 1,
    title: 'Ficciones',
    authors: 'Jorge Luis Borges',
    coverUrl: null,
    coverPath: null,
    pageCount: 200,
    currentPage: 50,
    progressPercentage: 25,
    status: BookStatus.READING,
    rating: 3,
    ...overrides
  }
}

describe('Feature #17 - Library bookshelf view', () => {
  describe('Book on the shelf (BookCard)', () => {
    it('should stack cover, shelf plank and catalog card (ficha) in that order', () => {
      render(h(BookCard, { book: makeBook({ coverUrl: 'https://example.com/c.jpg' }) }))

      const card = screen.getByTestId('book-card')
      const cover = within(card).getByTestId('book-cover')
      const plank = within(card).getByTestId('shelf-plank')
      const ficha = within(card).getByTestId('book-ficha')

      const follows = (a: Element, b: Element): boolean =>
        Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
      expect(follows(cover, plank)).toBe(true)
      expect(follows(plank, ficha)).toBe(true)

      expect(plank.className).toContain('shelf-plank')
      expect(plank.hasAttribute('data-shelf-plank')).toBe(true)
      expect(plank.getAttribute('aria-hidden')).toBe('true')
      expect(ficha.className).toContain('ficha')
      expect(within(cover).getByTestId('book-cover-image')).toBeDefined()
    })

    it('should keep all book information inside the ficha below the shelf', () => {
      render(h(BookCard, { book: makeBook({ rating: 4, progressPercentage: 65 }) }))

      const ficha = screen.getByTestId('book-ficha')
      expect(within(ficha).getByTestId('book-title').textContent).toBe('Ficciones')
      expect(within(ficha).getByTestId('book-authors').textContent).toBe('Jorge Luis Borges')
      expect(within(ficha).getByTestId('book-status-badge').textContent).toBe('Leyendo')
      expect(within(ficha).getByTestId('book-progress').textContent).toBe('65%')
      expect(within(ficha).getByTestId('book-rating')).toBeDefined()
      expect(within(ficha).getAllByTestId(/^star-\d-filled$/).length).toBe(4)

      const cover = screen.getByTestId('book-cover')
      expect(within(cover).queryByTestId('book-status-badge')).toBeNull()
    })

    it('should omit the progress bar in the ficha for statuses without progress', () => {
      render(h(BookCard, { book: makeBook({ status: BookStatus.FINISHED, rating: 5 }) }))

      const ficha = screen.getByTestId('book-ficha')
      expect(within(ficha).queryByTestId('book-progress')).toBeNull()
      expect(within(ficha).getByTestId('book-status-badge').textContent).toBe('Terminado')
      expect(within(ficha).getAllByTestId(/^star-\d-filled$/).length).toBe(5)
    })

    it('should open the detail when clicking anywhere on the book or its ficha', () => {
      const onClick = vi.fn()
      const book = makeBook({ id: 9 })
      render(h(BookCard, { book, onClick }))

      fireEvent.click(screen.getByTestId('book-cover'))
      fireEvent.click(screen.getByTestId('book-ficha'))
      expect(onClick).toHaveBeenCalledTimes(2)
      expect(onClick).toHaveBeenCalledWith(book)
    })
  })

  describe('Leather placeholder cover', () => {
    it('should render a leather-bound placeholder with brass frame when there is no cover', () => {
      render(h(BookCard, { book: makeBook({ id: 2 }) }))

      const placeholder = screen.getByTestId('book-cover-placeholder')
      expect(placeholder.getAttribute('data-cover-tone')).toBe('leather')
      expect(placeholder.className).toContain('bg-leather')
      expect(placeholder.className).toContain('text-brass')

      const frame = within(placeholder).getByTestId('book-cover-placeholder-frame')
      expect(frame.className).toContain('border-double')
      expect(frame.className).toContain('border-brass')
    })

    it('should alternate leather and green spine tones deterministically by id', () => {
      const { rerender } = render(h(BookCard, { book: makeBook({ id: 3 }) }))
      const odd = screen.getByTestId('book-cover-placeholder')
      expect(odd.getAttribute('data-cover-tone')).toBe('spine')
      expect(odd.className).toContain('bg-spine')

      rerender(h(BookCard, { book: makeBook({ id: 4 }) }))
      expect(screen.getByTestId('book-cover-placeholder').getAttribute('data-cover-tone')).toBe(
        'leather'
      )

      rerender(h(BookCard, { book: makeBook({ id: undefined }) }))
      expect(screen.getByTestId('book-cover-placeholder').getAttribute('data-cover-tone')).toBe(
        'leather'
      )
    })

    it('should switch to the leather placeholder when the cover image fails', () => {
      render(h(BookCard, { book: makeBook({ id: 1, coverUrl: 'https://example.com/x.jpg' }) }))
      fireEvent.error(screen.getByTestId('book-cover-image'))

      const placeholder = screen.getByTestId('book-cover-placeholder')
      expect(placeholder.getAttribute('data-cover-tone')).toBe('spine')
    })
  })

  describe('Bookshelf grid (BookGrid)', () => {
    it('should adapt books per shelf to the width with an auto-fill grid and no horizontal gap', () => {
      render(h(BookGrid, { books: [makeBook({ id: 1 }), makeBook({ id: 2 })] }))

      const grid = screen.getByTestId('book-grid')
      expect(grid.className).toMatch(/grid-cols-\[repeat\(auto-fill,minmax\(\d+(\.\d+)?rem,1fr\)\)\]/)
      expect(grid.className).toContain('gap-x-0')
      expect(grid.className).toContain('bookshelf')
    })

    it('should give every book its own shelf segment so rows read as continuous shelves', () => {
      const books = [1, 2, 3, 4, 5].map((id) => makeBook({ id, title: `Libro ${id}` }))
      render(h(BookGrid, { books }))

      const grid = screen.getByTestId('book-grid')
      const cells = Array.from(grid.children)
      expect(cells.length).toBe(5)
      for (const cell of cells) {
        expect(cell.getAttribute('data-testid')).toBe('book-card')
        expect(cell.querySelectorAll('[data-shelf-plank]').length).toBe(1)
      }
      expect(cells[cells.length - 1]?.querySelector('[data-shelf-plank]')).not.toBeNull()
    })
  })

  describe('Shelf styles in main.css', () => {
    const plank = utilityBlock('shelf-plank')
    const bookshelf = utilityBlock('bookshelf')
    const hinge = utilityBlock('book-hinge')

    it('should define the wooden shelf plank with the wood texture and theme tokens only', () => {
      expect(plank).not.toBe('')
      expect(plank).toContain('var(--texture-wood)')
      expect(plank).toContain('var(--color-chrome)')
      expect(plank).toContain('var(--color-brass)')
      expect(plank).toContain('var(--relief-deep)')
      expect(plank).toContain('position: relative')
    })

    it('should extend the last plank to the shelf edge and clip it at the container', () => {
      expect(bookshelf).toContain('overflow: hidden')
      expect(bookshelf).toMatch(/&\s*>\s*:last-child\s*\[data-shelf-plank\]::after/)
      expect(bookshelf).toContain('background: inherit')
      expect(bookshelf).toContain('left: 100%')
    })

    it('should not hardcode colors in the bookshelf utilities', () => {
      for (const block of [plank, bookshelf, hinge]) {
        expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
        expect(block).not.toMatch(/rgba?\(/)
      }
    })
  })

  describe('LibraryPage integration', () => {
    beforeEach(() => {
      vi.restoreAllMocks()
    })

    function renderPage(onSelectBook = vi.fn()): ReturnType<typeof vi.fn> {
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, gcTime: 0 } }
      })
      render(h(QueryClientProvider, { client }, h(LibraryPage, { onSelectBook })))
      return onSelectBook
    }

    it('should show the books on the bookshelf and open the detail on click', async () => {
      vi.spyOn(bookService, 'list').mockResolvedValueOnce({
        success: true,
        data: [makeBook({ id: 7, title: 'Rayuela' }), makeBook({ id: 8, title: 'Pedro Páramo' })]
      })
      const onSelectBook = renderPage()

      const grid = await screen.findByTestId('book-grid')
      expect(grid.className).toContain('bookshelf')
      expect(within(grid).getAllByTestId('shelf-plank').length).toBe(2)

      fireEvent.click(within(grid).getByText('Pedro Páramo'))
      expect(onSelectBook).toHaveBeenCalledWith(8)
    })

    it('should keep the empty state instead of an empty shelf', async () => {
      vi.spyOn(bookService, 'list').mockResolvedValueOnce({ success: true, data: [] })
      renderPage()

      await waitFor(() => {
        expect(screen.getByTestId('empty-library-state')).toBeDefined()
      })
      expect(screen.queryByTestId('book-grid')).toBeNull()
      expect(screen.queryByTestId('shelf-plank')).toBeNull()
    })
  })
})

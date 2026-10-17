// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { readFileSync } from 'fs'
import { join, resolve } from 'path'
import { QueryClient } from '@tanstack/react-query'
import { App } from '../../src/renderer/src/App.js'
import { BookCard } from '../../src/renderer/src/components/BookCard.js'
import { BookGrid } from '../../src/renderer/src/components/BookGrid.js'
import { SettingsPage } from '../../src/renderer/src/pages/SettingsPage.js'
import {
  STATUS_CONFIG,
  STATUS_ORDER,
  getStatusConfig
} from '../../src/renderer/src/components/statusConfig.js'
import { bookService } from '../../src/renderer/src/services/bookService.js'
import { settingsService } from '../../src/renderer/src/services/settingsService.js'
import { BookStatus } from '../../src/shared/domain/entities/BookStatus.js'
import type { BookPrimitives } from '../../src/shared/infrastructure/ipc/contracts.js'

const h = React.createElement
const ROOT = resolve(__dirname, '../..')
const RENDERER_SRC = join(ROOT, 'src/renderer/src')

function readSource(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf-8')
}

function makeBook(overrides: Partial<BookPrimitives> = {}): BookPrimitives {
  return {
    id: 7,
    title: 'Rayuela',
    authors: 'Julio Cortázar',
    coverUrl: null,
    coverPath: null,
    pageCount: 600,
    currentPage: 120,
    progressPercentage: 20,
    status: BookStatus.READING,
    rating: 4,
    ...overrides
  }
}

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, gcTime: 0 } }
  })
}

describe('Feature #18 - UI polish fixes', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    document.documentElement.className = ''
  })

  describe('Light theme by default', () => {
    it('should not ship a dark class in index.html, so the first paint is light', () => {
      const html = readFileSync(join(ROOT, 'src/renderer/index.html'), 'utf-8')
      const htmlTag = /<html[^>]*>/.exec(html)?.[0] ?? ''

      expect(htmlTag).not.toMatch(/class=/)
      expect(readSource('src/renderer/src/main.tsx')).not.toMatch(/['"]dark['"]/)
    })

    it('should fall back to light in App when settings cannot be loaded', async () => {
      document.documentElement.classList.add('dark')
      vi.spyOn(bookService, 'list').mockResolvedValue({ success: true, data: [] })
      vi.spyOn(settingsService, 'get').mockRejectedValue(new Error('IPC unavailable'))

      render(h(App, { queryClient: createTestQueryClient() }))

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(false)
      })
    })

    it('should fall back to light in App when settings respond with an error', async () => {
      document.documentElement.classList.add('dark')
      vi.spyOn(bookService, 'list').mockResolvedValue({ success: true, data: [] })
      vi.spyOn(settingsService, 'get').mockResolvedValue({ success: false, error: 'boom' })

      render(h(App, { queryClient: createTestQueryClient() }))

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(false)
      })
    })

    it('should respect a saved dark preference in App', async () => {
      vi.spyOn(bookService, 'list').mockResolvedValue({ success: true, data: [] })
      vi.spyOn(settingsService, 'get').mockResolvedValue({
        success: true,
        data: { googleBooksApiKey: '', theme: 'dark' }
      })

      render(h(App, { queryClient: createTestQueryClient() }))

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true)
      })
    })

    it('should preselect the light option in SettingsPage when settings are unavailable', async () => {
      vi.spyOn(settingsService, 'get').mockResolvedValue({ success: false, error: 'boom' })
      vi.spyOn(settingsService, 'getAppInfo').mockResolvedValue({ success: false, error: 'boom' })

      render(h(SettingsPage))

      const light = await screen.findByTestId('theme-option-light')
      expect(light.className).toContain('border-accent')
      expect(screen.getByTestId('theme-option-dark').className).not.toContain('border-accent')
    })
  })

  describe('Single "+" on the add book button', () => {
    it('should not prefix the label with a literal "+" next to the Plus icon', () => {
      const source = readSource('src/renderer/src/pages/LibraryPage.tsx')

      expect(source).not.toMatch(/\+\s*Agregar Libro/)
      expect(source).toMatch(/<span>Agregar Libro<\/span>/)
    })
  })

  describe('Single status configuration module', () => {
    it('should define label and classes for every BookStatus', () => {
      for (const status of Object.values(BookStatus)) {
        const cfg = STATUS_CONFIG[status]
        expect(cfg.label).toBeTruthy()
        expect(cfg.shelfBadgeClass).toContain(`text-status-`)
        expect(cfg.badgeClass).toMatch(/bg-status-[a-z-]+\/10/)
        expect(cfg.barClass).toMatch(/^bg-status-/)
        expect(cfg.textClass).toMatch(/^text-status-/)
        expect(cfg.icon).toBeDefined()
      }
      expect([...STATUS_ORDER].sort()).toEqual([...Object.values(BookStatus)].sort())
    })

    it('should return a neutral fallback for unknown statuses', () => {
      const cfg = getStatusConfig('UNKNOWN')

      expect(cfg.label).toBe('UNKNOWN')
      expect(cfg.badgeClass).toContain('text-ink-muted')
    })

    it.each([
      'src/renderer/src/components/BookCard.tsx',
      'src/renderer/src/pages/BookDetailPage.tsx',
      'src/renderer/src/pages/DashboardPage.tsx'
    ])('%s should import the shared config instead of declaring its own', (file) => {
      const source = readSource(file)

      expect(source).not.toMatch(/const STATUS_CONFIG/)
      expect(source).toMatch(/from '(\.\.\/components|\.)\/statusConfig\.js'/)
    })

    it('should use the solid shelf badge variant on the BookCard', () => {
      render(h(BookCard, { book: makeBook({ status: BookStatus.FINISHED }) }))

      const badge = screen.getByTestId('book-status-badge')
      expect(badge.textContent).toBe(STATUS_CONFIG[BookStatus.FINISHED].label)
      expect(badge.className).toContain(STATUS_CONFIG[BookStatus.FINISHED].shelfBadgeClass)
      expect(badge.className).toContain('bg-card')
    })

    it('should only use theme tokens (no raw palette colors, no dark: variants)', () => {
      const source = readFileSync(join(RENDERER_SRC, 'components/statusConfig.ts'), 'utf-8')

      expect(source).not.toMatch(/\bdark:/)
      expect(source).not.toMatch(
        /-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|green|blue|indigo|purple|rose)-\d{2,3}\b/
      )
    })
  })

  describe('Keyboard accessible BookCard', () => {
    it('should be focusable and expose a button role with an accessible name', () => {
      render(h(BookCard, { book: makeBook(), onClick: vi.fn() }))

      const card = screen.getByRole('button', { name: 'Rayuela, de Julio Cortázar' })
      expect(card).toBe(screen.getByTestId('book-card'))
      expect(card.tabIndex).toBe(0)

      card.focus()
      expect(document.activeElement).toBe(card)
    })

    it.each(['Enter', ' '])('should open the detail when pressing "%s"', (key) => {
      const onClick = vi.fn()
      const book = makeBook()
      render(h(BookCard, { book, onClick }))

      const card = screen.getByTestId('book-card')
      const notPrevented = fireEvent.keyDown(card, { key })

      expect(onClick).toHaveBeenCalledTimes(1)
      expect(onClick).toHaveBeenCalledWith(book)
      expect(notPrevented).toBe(false)
    })

    it('should ignore other keys', () => {
      const onClick = vi.fn()
      render(h(BookCard, { book: makeBook(), onClick }))

      fireEvent.keyDown(screen.getByTestId('book-card'), { key: 'a' })
      fireEvent.keyDown(screen.getByTestId('book-card'), { key: 'Tab' })

      expect(onClick).not.toHaveBeenCalled()
    })

    it('should not be focusable nor announced as a button without onClick', () => {
      render(h(BookCard, { book: makeBook() }))

      const card = screen.getByTestId('book-card')
      expect(card.getAttribute('role')).toBeNull()
      expect(card.hasAttribute('tabindex')).toBe(false)
    })

    it('should draw a token-based focus ring inside the card so the bookshelf does not clip it', () => {
      render(h(BookCard, { book: makeBook(), onClick: vi.fn() }))

      const classes = screen.getByTestId('book-card').className
      expect(classes).toContain('focus-visible:outline-accent')
      expect(classes).toContain('focus-visible:outline-2')
      expect(classes).toMatch(/focus-visible:outline-offset-\[-\d+px\]/)
      expect(classes).not.toMatch(/focus-visible:ring/)
    })

    it('should keep every card reachable and operable from the bookshelf grid', () => {
      const onBookClick = vi.fn()
      const books = [makeBook({ id: 1, title: 'A' }), makeBook({ id: 2, title: 'B' })]
      render(h(BookGrid, { books, onBookClick }))

      const cards = screen.getAllByRole('button')
      expect(cards).toHaveLength(2)
      fireEvent.keyDown(cards[1] as HTMLElement, { key: 'Enter' })

      expect(onBookClick).toHaveBeenCalledWith(books[1])
    })

    it('should keep all BookCard data-testids', () => {
      render(h(BookCard, { book: makeBook(), onClick: vi.fn() }))

      for (const id of [
        'book-card',
        'book-cover',
        'book-cover-placeholder',
        'shelf-plank',
        'book-ficha',
        'book-title',
        'book-authors',
        'book-status-badge',
        'book-rating',
        'book-progress'
      ]) {
        expect(screen.getByTestId(id)).toBeDefined()
      }
    })
  })

  describe('lint:check script', () => {
    it('should run eslint like lint but without --fix', () => {
      const pkg = JSON.parse(readSource('package.json')) as { scripts: Record<string, string> }

      expect(pkg.scripts['lint:check']).toBeDefined()
      expect(pkg.scripts['lint:check']).not.toContain('--fix')
      expect(pkg.scripts['lint:check']).toBe(pkg.scripts.lint?.replace(/\s*--fix\b/, ''))
    })
  })
})

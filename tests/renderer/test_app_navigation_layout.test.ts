// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClient } from '@tanstack/react-query'
import { TitleBar } from '../../src/renderer/src/components/TitleBar.js'
import { NavigationDrawer } from '../../src/renderer/src/components/NavigationDrawer.js'
import { SettingsPage } from '../../src/renderer/src/pages/SettingsPage.js'
import { App } from '../../src/renderer/src/App.js'
import { windowService } from '../../src/renderer/src/services/windowService.js'
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

const mockBook: BookPrimitives = {
  id: 101,
  title: 'El Aleph',
  authors: 'Jorge Luis Borges',
  coverUrl: null,
  coverPath: null,
  pageCount: 180,
  currentPage: 90,
  progressPercentage: 50,
  status: BookStatus.READING,
  rating: 5,
  synopsis: 'Colección de cuentos de Jorge Luis Borges.',
  publisher: 'Losada',
  publishedDate: '1949',
  isbn: '9788420658421',
  createdAt: '2026-09-01T12:00:00.000Z',
  updatedAt: '2026-09-01T12:00:00.000Z'
}

describe('Feature #14 - App Navigation & Layout (TitleBar, Drawer, App Routing)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(bookService, 'list').mockResolvedValue({
      success: true,
      data: [mockBook]
    })
    vi.spyOn(bookService, 'getById').mockResolvedValue({
      success: true,
      data: mockBook
    })
  })

  describe('TitleBar Component', () => {
    it('renders title, logo, and window controls', async () => {
      render(h(TitleBar, { title: 'BookLog Custom' }))

      expect(screen.getByTestId('app-titlebar')).toBeDefined()
      expect(screen.getByText('BookLog Custom')).toBeDefined()
      expect(screen.getByTestId('titlebar-menu-button')).toBeDefined()
      expect(screen.getByTestId('window-minimize-button')).toBeDefined()
      expect(screen.getByTestId('window-maximize-button')).toBeDefined()
      expect(screen.getByTestId('window-close-button')).toBeDefined()
    })

    it('calls onToggleMenu when clicking the hamburger menu button', () => {
      const onToggleMenu = vi.fn()
      render(h(TitleBar, { onToggleMenu }))

      const menuBtn = screen.getByTestId('titlebar-menu-button')
      fireEvent.click(menuBtn)
      expect(onToggleMenu).toHaveBeenCalledTimes(1)
    })

    it('invokes windowService.minimize when clicking minimize button', async () => {
      const minimizeSpy = vi.spyOn(windowService, 'minimize').mockResolvedValue({
        success: true,
        data: undefined
      })
      render(h(TitleBar, {}))

      const btn = screen.getByTestId('window-minimize-button')
      fireEvent.click(btn)

      expect(minimizeSpy).toHaveBeenCalledTimes(1)
    })

    it('invokes windowService.maximize when clicking maximize button and toggles state', async () => {
      const maximizeSpy = vi.spyOn(windowService, 'maximize').mockResolvedValue({
        success: true,
        data: true
      })
      render(h(TitleBar, {}))

      const btn = screen.getByTestId('window-maximize-button')
      expect(btn.getAttribute('aria-label')).toBe('Maximizar ventana')

      fireEvent.click(btn)
      expect(maximizeSpy).toHaveBeenCalledTimes(1)

      await waitFor(() => {
        expect(btn.getAttribute('aria-label')).toBe('Restaurar ventana')
      })
    })

    it('invokes windowService.close when clicking close button', async () => {
      const closeSpy = vi.spyOn(windowService, 'close').mockResolvedValue({
        success: true,
        data: undefined
      })
      render(h(TitleBar, {}))

      const btn = screen.getByTestId('window-close-button')
      fireEvent.click(btn)

      expect(closeSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('NavigationDrawer Component', () => {
    it('does not render when isOpen is false', () => {
      render(
        h(NavigationDrawer, {
          isOpen: false,
          onClose: vi.fn(),
          currentView: 'library',
          onNavigate: vi.fn()
        })
      )

      expect(screen.queryByTestId('navigation-drawer')).toBeNull()
    })

    it('renders drawer, backdrop, nav buttons and version when isOpen is true', () => {
      render(
        h(NavigationDrawer, {
          isOpen: true,
          onClose: vi.fn(),
          currentView: 'library',
          onNavigate: vi.fn()
        })
      )

      expect(screen.getByTestId('navigation-drawer')).toBeDefined()
      expect(screen.getByTestId('drawer-backdrop')).toBeDefined()
      expect(screen.getByTestId('drawer-panel')).toBeDefined()
      expect(screen.getByTestId('drawer-close-button')).toBeDefined()
      expect(screen.getByTestId('drawer-nav-dashboard')).toBeDefined()
      expect(screen.getByTestId('drawer-nav-library')).toBeDefined()
      expect(screen.getByTestId('drawer-nav-settings')).toBeDefined()
      expect(screen.getByText('v0.1.0')).toBeDefined()
    })

    it('calls onClose when clicking close button (X)', () => {
      const onClose = vi.fn()
      render(
        h(NavigationDrawer, {
          isOpen: true,
          onClose,
          currentView: 'library',
          onNavigate: vi.fn()
        })
      )

      fireEvent.click(screen.getByTestId('drawer-close-button'))
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('calls onClose when clicking backdrop', () => {
      const onClose = vi.fn()
      render(
        h(NavigationDrawer, {
          isOpen: true,
          onClose,
          currentView: 'library',
          onNavigate: vi.fn()
        })
      )

      fireEvent.click(screen.getByTestId('drawer-backdrop'))
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('calls onClose when pressing Escape key', () => {
      const onClose = vi.fn()
      render(
        h(NavigationDrawer, {
          isOpen: true,
          onClose,
          currentView: 'library',
          onNavigate: vi.fn()
        })
      )

      fireEvent.keyDown(window, { key: 'Escape' })
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('triggers onNavigate and closes drawer when clicking a navigation link', () => {
      const onNavigate = vi.fn()
      const onClose = vi.fn()

      render(
        h(NavigationDrawer, {
          isOpen: true,
          onClose,
          currentView: 'library',
          onNavigate
        })
      )

      fireEvent.click(screen.getByTestId('drawer-nav-dashboard'))
      expect(onNavigate).toHaveBeenCalledWith('dashboard')
      expect(onClose).toHaveBeenCalledTimes(1)

      fireEvent.click(screen.getByTestId('drawer-nav-settings'))
      expect(onNavigate).toHaveBeenCalledWith('settings')
      expect(onClose).toHaveBeenCalledTimes(2)
    })
  })

  describe('SettingsPage Component', () => {
    it('renders heading, description and configuration sections', async () => {
      render(h(SettingsPage, {}))

      await waitFor(() => {
        expect(screen.getByTestId('settings-page')).toBeDefined()
        expect(screen.getByText('Configuración')).toBeDefined()
        expect(screen.getByText(/Preferencias Generales/i)).toBeDefined()
        expect(screen.getByText(/Almacenamiento Local/i)).toBeDefined()
        expect(screen.getByText(/Privacidad y Datos/i)).toBeDefined()
        expect(screen.getByText(/BookLog v0.1.0/i)).toBeDefined()
      })
    })
  })

  describe('App Layout & Routing Integration', () => {
    it('renders custom TitleBar and defaults to Library view', async () => {
      const testClient = createTestQueryClient()
      render(h(App, { queryClient: testClient }))

      expect(screen.getByTestId('app-titlebar')).toBeDefined()
      expect(screen.getByTestId('app-navigation')).toBeDefined()

      await waitFor(() => {
        expect(screen.getByTestId('library-page')).toBeDefined()
      })
    })

    it('opens NavigationDrawer when clicking the hamburger button and navigates to Dashboard', async () => {
      const testClient = createTestQueryClient()
      render(h(App, { queryClient: testClient }))

      // Initially closed
      expect(screen.queryByTestId('navigation-drawer')).toBeNull()

      // Click hamburger button in TitleBar
      fireEvent.click(screen.getByTestId('titlebar-menu-button'))

      // Drawer opens
      expect(screen.getByTestId('navigation-drawer')).toBeDefined()

      // Click Dashboard link inside drawer
      fireEvent.click(screen.getByTestId('drawer-nav-dashboard'))

      // Drawer closes and Dashboard page is rendered
      expect(screen.queryByTestId('navigation-drawer')).toBeNull()
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-page')).toBeDefined()
      })
    })

    it('navigates to Settings page via NavigationDrawer', async () => {
      const testClient = createTestQueryClient()
      render(h(App, { queryClient: testClient }))

      fireEvent.click(screen.getByTestId('titlebar-menu-button'))
      fireEvent.click(screen.getByTestId('drawer-nav-settings'))

      await waitFor(() => {
        expect(screen.getByTestId('settings-page')).toBeDefined()
      })
    })

    it('preserves contextual navigation back from BookDetailPage to previous view', async () => {
      const testClient = createTestQueryClient()
      render(h(App, { queryClient: testClient, initialView: { type: 'settings' } }))

      await waitFor(() => {
        expect(screen.getByTestId('settings-page')).toBeDefined()
      })

      // Navigate to Dashboard via top nav
      fireEvent.click(screen.getByTestId('nav-dashboard-button'))
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-page')).toBeDefined()
      })

      // Click recent book in Dashboard to go to Detail
      await waitFor(() => {
        expect(screen.getByText('El Aleph')).toBeDefined()
      })
      const recentItems = screen.getAllByTestId('recent-book-item')
      fireEvent.click(recentItems[0])

      // Detail page is shown
      await waitFor(() => {
        expect(screen.getByTestId('book-detail-page')).toBeDefined()
      })

      // Click Back button -> returns to Dashboard (previousView was dashboard)
      fireEvent.click(screen.getByTestId('back-button'))
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-page')).toBeDefined()
      })
    })
  })
})

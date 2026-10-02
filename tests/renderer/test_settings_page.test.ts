// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { SettingsPage } from '../../src/renderer/src/pages/SettingsPage.js'
import { settingsService } from '../../src/renderer/src/services/settingsService.js'
import type {
  AppSettingsDTO,
  AppInfoDTO
} from '../../src/shared/infrastructure/ipc/contracts.js'

const mockSettings: AppSettingsDTO = {
  googleBooksApiKey: 'AIzaSyInitialTestKey',
  theme: 'dark'
}

const mockAppInfo: AppInfoDTO = {
  name: 'BookLog',
  version: '1.2.3',
  electronVersion: '28.2.0',
  nodeVersion: '18.19.0',
  chromeVersion: '120.0.0',
  repositoryUrl: 'https://github.com/tomas/booklog',
  license: 'MIT'
}

describe('Feature #15 - SettingsPage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    document.documentElement.className = ''

    // Default mocks for settingsService
    vi.spyOn(settingsService, 'get').mockResolvedValue({
      success: true,
      data: { ...mockSettings }
    })

    vi.spyOn(settingsService, 'getAppInfo').mockResolvedValue({
      success: true,
      data: { ...mockAppInfo }
    })

    vi.spyOn(settingsService, 'save').mockImplementation(async (dto) => ({
      success: true,
      data: {
        googleBooksApiKey: dto.googleBooksApiKey ?? mockSettings.googleBooksApiKey,
        theme: dto.theme ?? mockSettings.theme
      }
    }))

    vi.spyOn(settingsService, 'testApiKey').mockImplementation(async (apiKey) => {
      if (apiKey === 'invalid-key') {
        return { success: false, error: 'Clave de API inválida o cuota superada' }
      }
      return { success: true, data: { valid: true } }
    })
  })

  it('renders initial settings and application information correctly', async () => {
    render(React.createElement(SettingsPage))

    // Header
    expect(screen.getByText('Configuración')).toBeDefined()

    // Wait for settings to load into inputs
    await waitFor(() => {
      const input = screen.getByTestId('api-key-input') as HTMLInputElement
      expect(input.value).toBe('AIzaSyInitialTestKey')
    })

    // App info elements
    await waitFor(() => {
      expect(screen.getByTestId('app-version').textContent).toContain('v1.2.3')
      expect(screen.getByTestId('electron-version').textContent).toContain('v28.2.0')
      expect(screen.getByTestId('node-version').textContent).toContain('v18.19.0')
      expect(screen.getByTestId('chrome-version').textContent).toContain('v120.0.0')
      expect(screen.getByText('MIT')).toBeDefined()
    })
  })

  it('toggles API key input visibility between password and text', async () => {
    render(React.createElement(SettingsPage))

    await waitFor(() => {
      const input = screen.getByTestId('api-key-input') as HTMLInputElement
      expect(input.value).toBe('AIzaSyInitialTestKey')
    })

    const input = screen.getByTestId('api-key-input') as HTMLInputElement
    const toggleButton = screen.getByTestId('toggle-api-key-visibility')

    // Initial state is password
    expect(input.type).toBe('password')

    // Click to show
    fireEvent.click(toggleButton)
    expect(input.type).toBe('text')

    // Click to hide again
    fireEvent.click(toggleButton)
    expect(input.type).toBe('password')
  })

  it('tests a valid API key and shows success feedback', async () => {
    render(React.createElement(SettingsPage))

    await waitFor(() => {
      expect((screen.getByTestId('api-key-input') as HTMLInputElement).value).toBe('AIzaSyInitialTestKey')
    })

    const testButton = screen.getByTestId('test-api-key-button')
    fireEvent.click(testButton)

    await waitFor(() => {
      expect(settingsService.testApiKey).toHaveBeenCalledWith('AIzaSyInitialTestKey')
      const feedback = screen.getByTestId('api-key-feedback')
      expect(feedback.textContent).toContain('Clave de API válida y conectada correctamente.')
    })
  })

  it('tests an invalid API key and shows error feedback', async () => {
    render(React.createElement(SettingsPage))

    const input = (await screen.findByTestId('api-key-input')) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'invalid-key' } })

    const testButton = screen.getByTestId('test-api-key-button')
    fireEvent.click(testButton)

    await waitFor(() => {
      expect(settingsService.testApiKey).toHaveBeenCalledWith('invalid-key')
      const feedback = screen.getByTestId('api-key-feedback')
      expect(feedback.textContent).toContain('Clave de API inválida o cuota superada')
    })
  })

  it('prevents testing when API key input is empty or whitespace', async () => {
    render(React.createElement(SettingsPage))

    const input = (await screen.findByTestId('api-key-input')) as HTMLInputElement
    fireEvent.change(input, { target: { value: '   ' } })

    const testButton = screen.getByTestId('test-api-key-button')
    fireEvent.click(testButton)

    await waitFor(() => {
      expect(settingsService.testApiKey).not.toHaveBeenCalled()
      const feedback = screen.getByTestId('api-key-feedback')
      expect(feedback.textContent).toContain('Introduce una clave de API')
    })
  })

  it('saves updated API key and shows success notification', async () => {
    render(React.createElement(SettingsPage))

    const input = (await screen.findByTestId('api-key-input')) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'AIzaSyNewSavedKey999' } })

    const saveButton = screen.getByTestId('save-api-key-button')
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(settingsService.save).toHaveBeenCalledWith({
        googleBooksApiKey: 'AIzaSyNewSavedKey999'
      })
      expect(screen.getByTestId('save-success-indicator')).toBeDefined()
    })
  })

  it('changes theme to light, updates document class and calls save', async () => {
    render(React.createElement(SettingsPage))

    await screen.findByTestId('theme-option-light')

    // Initially dark class should be present from loaded dark theme
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    const lightOption = screen.getByTestId('theme-option-light')
    fireEvent.click(lightOption)

    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(false)
      expect(settingsService.save).toHaveBeenCalledWith({ theme: 'light' })
    })
  })

  it('changes theme to dark, adds dark class to document and calls save', async () => {
    // Start with light
    vi.spyOn(settingsService, 'get').mockResolvedValueOnce({
      success: true,
      data: { googleBooksApiKey: '', theme: 'light' }
    })

    render(React.createElement(SettingsPage))

    await screen.findByTestId('theme-option-dark')
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    const darkOption = screen.getByTestId('theme-option-dark')
    fireEvent.click(darkOption)

    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true)
      expect(settingsService.save).toHaveBeenCalledWith({ theme: 'dark' })
    })
  })

  it('changes theme to system and checks matchMedia', async () => {
    // Mock matchMedia returning prefers-color-scheme: dark
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))

    render(React.createElement(SettingsPage))

    const systemOption = await screen.findByTestId('theme-option-system')
    fireEvent.click(systemOption)

    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true)
      expect(settingsService.save).toHaveBeenCalledWith({ theme: 'system' })
    })
  })
})

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { SettingsPage } from '../../src/renderer/src/pages/SettingsPage.js'
import { HighlightsSection } from '../../src/renderer/src/components/HighlightsSection.js'
import { settingsService } from '../../src/renderer/src/services/settingsService.js'
import { kindleService } from '../../src/renderer/src/services/kindleService.js'
import { bookService } from '../../src/renderer/src/services/bookService.js'
import {
  initialKindleSelection,
  notebookStateBadge
} from '../../src/renderer/src/components/kindleImport.js'
import { highlightColorMark } from '../../src/renderer/src/components/annotations.js'
import { BookStatus } from '../../src/shared/domain/entities/BookStatus.js'
import type {
  BookPrimitives,
  HighlightPrimitives,
  KindleImportGroupPreview,
  KindlePreviewResultDTO
} from '../../src/shared/infrastructure/ipc/contracts.js'

const h = React.createElement

function book(id: number, title: string, authors: string): BookPrimitives {
  return {
    id,
    googleBooksId: null,
    title,
    authors,
    coverUrl: null,
    coverPath: null,
    pageCount: null,
    currentPage: null,
    progressPercentage: null,
    isbn: null,
    status: BookStatus.READING,
    rating: null,
    finishedAt: null,
    createdAt: new Date('2026-01-01T10:00:00Z'),
    updatedAt: new Date('2026-01-01T10:00:00Z')
  }
}

function group(
  key: string,
  title: string,
  importState: KindleImportGroupPreview['importState'],
  bookId: number | null
): KindleImportGroupPreview {
  return {
    key,
    rawTitle: `${title} -- Autor -- 0123456789abcdef0123456789abcdef -- Anna’s Archive`,
    title,
    author: 'Autor',
    isbn: null,
    highlightCount: 3,
    noteCount: 1,
    supersededHighlights: 0,
    supersededNotes: 0,
    lastCapturedAt: null,
    match: bookId ? { bookId, method: 'TITLE_AUTHOR', confidence: 'HIGH', score: 1 } : null,
    fileName: key,
    importState
  }
}

const groups = [
  group('Ya-Bloc de notas.html', 'Ya importado', 'IMPORTED', 1),
  group('Cambio-Bloc de notas.html', 'Cambiado', 'CHANGED', 2),
  group('Nuevo-Notebook.html', 'Nuevo', 'NEW', 1)
]

const notebookResult: KindlePreviewResultDTO = {
  sourceId: 'notebook-1',
  source: 'NOTEBOOK',
  sourceLabel: 'E:\\Tomas\\Documents',
  preview: {
    fileCount: 4,
    totalEntries: 20,
    ignoredBookmarks: 0,
    ignoredEmpty: 0,
    unrecognizedEntries: 0,
    groups
  }
}

let client: QueryClient

function renderSettings(): void {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } }
  })
  render(h(QueryClientProvider, { client }, h(SettingsPage)))
}

describe('Feature #26 — notebook helpers', () => {
  it('should leave already imported exports unselected', () => {
    expect(initialKindleSelection(groups)).toEqual({
      'Ya-Bloc de notas.html': null,
      'Cambio-Bloc de notas.html': 2,
      'Nuevo-Notebook.html': 1
    })
  })

  it('should label the import state with token classes only', () => {
    expect(notebookStateBadge('IMPORTED')?.label).toBe('Ya importado')
    expect(notebookStateBadge('CHANGED')?.label).toContain('Cambió')
    expect(notebookStateBadge('NEW')).toBeNull()
    expect(notebookStateBadge(undefined)).toBeNull()
  })

  it('should map each highlight color to a theme token', () => {
    expect(highlightColorMark('YELLOW')).toEqual({
      label: 'Amarillo',
      className: 'bg-highlight-yellow'
    })
    expect(highlightColorMark(null)).toBeNull()
    const css = readFileSync(resolve(__dirname, '../../src/renderer/src/assets/main.css'), 'utf-8')
    for (const color of ['yellow', 'blue', 'pink', 'orange']) {
      const occurrences = css.match(new RegExp(`--color-highlight-${color}:`, 'gu')) ?? []
      expect(occurrences, `light and dark values for ${color}`).toHaveLength(2)
    }
  })
})

describe('Feature #26 — import app exports from Settings', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(settingsService, 'get').mockResolvedValue({
      success: true,
      data: { googleBooksApiKey: '', theme: 'light' }
    })
    vi.spyOn(settingsService, 'getAppInfo').mockResolvedValue({ success: false, error: 'n/a' })
    vi.spyOn(bookService, 'list').mockResolvedValue({
      success: true,
      data: [book(1, 'Libro uno', 'Autor'), book(2, 'Libro dos', 'Autor')]
    })
    vi.spyOn(kindleService, 'getNotebookFolder').mockResolvedValue({
      success: true,
      data: { folder: 'E:\\Tomas\\Documents', isDefault: true }
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('should show the new button next to the existing ones', () => {
    renderSettings()
    const section = screen.getByTestId('kindle-import-settings-section')
    expect(within(section).getByTestId('kindle-import-button')).toBeTruthy()
    expect(within(section).getByTestId('kindle-import-file-button')).toBeTruthy()
    expect(within(section).getByTestId('kindle-notebook-import-button').textContent).toContain(
      'Importar exportaciones de la app'
    )
  })

  it('should preview the exports, mark the imported ones and commit the selected files', async () => {
    const preview = vi
      .spyOn(kindleService, 'previewNotebooks')
      .mockResolvedValue({ success: true, data: notebookResult })
    const device = vi.spyOn(kindleService, 'previewFromDevice')
    const commit = vi.spyOn(kindleService, 'commit').mockResolvedValue({
      success: true,
      data: {
        highlightsImported: 6,
        notesImported: 2,
        highlightsSkipped: 1,
        notesSkipped: 0,
        groupsNotImported: 1,
        books: []
      }
    })
    renderSettings()

    fireEvent.click(screen.getByTestId('kindle-notebook-import-button'))
    const rows = await screen.findAllByTestId('kindle-import-group')
    expect(preview).toHaveBeenCalledTimes(1)
    expect(device).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'Importar exportaciones de la app' })).toBeTruthy()
    expect(screen.getByText('Carpeta: E:\\Tomas\\Documents')).toBeTruthy()
    expect(screen.getByTestId('kindle-import-summary').textContent).toContain(
      '4 exportaciones en la carpeta'
    )

    const imported = rows.find((row) => row.textContent?.includes('Ya-Bloc de notas.html'))!
    expect(within(imported).getByTestId('kindle-import-group-state').textContent).toBe(
      'Ya importado'
    )
    expect(within(imported).getByText('Archivo: Ya-Bloc de notas.html')).toBeTruthy()
    expect(
      (within(imported).getByTestId('kindle-import-group-select') as HTMLSelectElement).value
    ).toBe('')
    const fresh = rows.find((row) => row.textContent?.includes('Nuevo-Notebook.html'))!
    expect(within(fresh).queryByTestId('kindle-import-group-state')).toBeNull()

    await waitFor(() =>
      expect(screen.getByTestId('kindle-import-totals').textContent).toContain('6 subrayados')
    )
    fireEvent.click(screen.getByTestId('kindle-import-confirm'))
    await screen.findByTestId('kindle-import-report')
    expect(commit).toHaveBeenCalledWith({
      sourceId: 'notebook-1',
      assignments: [
        { groupKey: 'Cambio-Bloc de notas.html', bookId: 2 },
        { groupKey: 'Nuevo-Notebook.html', bookId: 1 }
      ]
    })
  })

  it('should show the folder error and let the user search again', async () => {
    const preview = vi
      .spyOn(kindleService, 'previewNotebooks')
      .mockResolvedValueOnce({
        success: false,
        error: 'No se pudo abrir la carpeta de exportaciones',
        code: 'KINDLE_FILE_ERROR'
      })
      .mockResolvedValueOnce({
        success: true,
        data: { ...notebookResult, preview: { ...notebookResult.preview, groups: [] } }
      })
    renderSettings()

    fireEvent.click(screen.getByTestId('kindle-notebook-import-button'))
    expect((await screen.findByTestId('kindle-import-error')).textContent).toContain(
      'No se pudo abrir la carpeta'
    )
    expect(screen.queryByTestId('kindle-import-choose-file')).toBeNull()
    fireEvent.click(screen.getByTestId('kindle-import-retry-notebook'))
    expect((await screen.findByTestId('kindle-import-empty')).textContent).toContain(
      'No hay exportaciones'
    )
    expect(preview).toHaveBeenCalledTimes(2)
  })

  it('should show the folder and let the user change it and go back to Documents', async () => {
    const choose = vi.spyOn(kindleService, 'chooseNotebookFolder').mockResolvedValue({
      success: true,
      data: { folder: 'D:\\Kindle', isDefault: false }
    })
    const reset = vi.spyOn(kindleService, 'resetNotebookFolder').mockResolvedValue({
      success: true,
      data: { folder: 'E:\\Tomas\\Documents', isDefault: true }
    })
    renderSettings()

    await waitFor(() =>
      expect(screen.getByTestId('kindle-notebook-folder-path').textContent).toBe(
        'E:\\Tomas\\Documents'
      )
    )
    expect(screen.getByTestId('kindle-notebook-folder').textContent).toContain('predeterminada')
    expect(screen.queryByTestId('kindle-notebook-folder-reset')).toBeNull()

    fireEvent.click(screen.getByTestId('kindle-notebook-folder-choose'))
    await waitFor(() =>
      expect(screen.getByTestId('kindle-notebook-folder-path').textContent).toBe('D:\\Kindle')
    )
    expect(choose).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByTestId('kindle-notebook-folder-reset'))
    await waitFor(() =>
      expect(screen.getByTestId('kindle-notebook-folder-path').textContent).toBe(
        'E:\\Tomas\\Documents'
      )
    )
    expect(reset).toHaveBeenCalledTimes(1)
  })
})

describe('Feature #26 — highlight color in the Subrayados section', () => {
  afterEach(() => {
    cleanup()
  })

  it('should show a small color mark only for highlights with color', () => {
    const highlights: HighlightPrimitives[] = [
      {
        id: 1,
        bookId: 1,
        content: 'Con color',
        location: { page: null, position: { start: 10, end: null } },
        capturedAt: null,
        fingerprint: 'kindle-nb-v1:a',
        color: 'PINK'
      },
      {
        id: 2,
        bookId: 1,
        content: 'De My Clippings',
        location: { page: null, position: { start: 20, end: 22 } },
        capturedAt: new Date(2025, 6, 14, 22, 15),
        fingerprint: 'kindle-v1:b',
        color: null
      }
    ]
    render(
      h(HighlightsSection, {
        highlights,
        notes: [],
        isLoading: false,
        errorMessage: null,
        isDeleting: false,
        onDelete: () => undefined
      })
    )
    const items = screen.getAllByTestId('highlight-item')
    const mark = within(items[0]!).getByTestId('highlight-color')
    expect(mark.textContent).toBe('Rosa')
    expect(mark.getAttribute('title')).toBe('Subrayado rosa')
    expect(mark.innerHTML).toContain('bg-highlight-pink')
    expect(within(items[0]!).queryByTestId('highlight-date')).toBeNull()
    expect(within(items[1]!).queryByTestId('highlight-color')).toBeNull()
    expect(within(items[1]!).getByTestId('highlight-date')).toBeTruthy()
  })
})

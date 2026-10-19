// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SettingsPage } from '../../src/renderer/src/pages/SettingsPage.js'
import { settingsService } from '../../src/renderer/src/services/settingsService.js'
import { kindleService } from '../../src/renderer/src/services/kindleService.js'
import { bookService } from '../../src/renderer/src/services/bookService.js'
import {
  buildKindleAssignments,
  countSelectedAnnotations,
  initialKindleSelection,
  matchBadge
} from '../../src/renderer/src/components/kindleImport.js'
import { BookStatus } from '../../src/shared/domain/entities/BookStatus.js'
import type {
  BookPrimitives,
  KindleImportGroupPreview,
  KindleImportReport,
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

const groups: KindleImportGroupPreview[] = [
  {
    key: 'Legado de cenizas - Tim Weiner (Tim Weiner)',
    rawTitle: 'Legado de cenizas - Tim Weiner (Tim Weiner)',
    title: 'Legado de cenizas',
    author: 'Tim Weiner',
    isbn: null,
    highlightCount: 2,
    noteCount: 1,
    supersededHighlights: 0,
    supersededNotes: 0,
    lastCapturedAt: new Date(2025, 7, 8),
    match: { bookId: 1, method: 'TITLE_AUTHOR', confidence: 'HIGH', score: 1 }
  },
  {
    key: '_OceanofPDF.com_Eisenhorn_The_Omnibus_-_Dan_Abnett (Dan Abnett)',
    rawTitle: '_OceanofPDF.com_Eisenhorn_The_Omnibus_-_Dan_Abnett (Dan Abnett)',
    title: 'Eisenhorn The Omnibus',
    author: 'Dan Abnett',
    isbn: null,
    highlightCount: 1,
    noteCount: 0,
    supersededHighlights: 0,
    supersededNotes: 0,
    lastCapturedAt: null,
    match: null
  }
]

const previewResult: KindlePreviewResultDTO = {
  sourceId: 'session-1',
  source: 'DEVICE',
  sourceLabel: 'Kindle Paperwhite',
  preview: { totalEntries: 6, ignoredBookmarks: 1, ignoredEmpty: 1, unrecognizedEntries: 0, groups }
}

const report: KindleImportReport = {
  highlightsImported: 3,
  notesImported: 1,
  highlightsSkipped: 0,
  notesSkipped: 0,
  groupsNotImported: 0,
  books: [
    {
      bookId: 1,
      title: 'Legado de cenizas',
      highlightsImported: 2,
      notesImported: 1,
      highlightsSkipped: 0,
      notesSkipped: 0
    },
    {
      bookId: 9,
      title: 'Eisenhorn The Omnibus',
      highlightsImported: 1,
      notesImported: 0,
      highlightsSkipped: 0,
      notesSkipped: 0
    }
  ]
}

let client: QueryClient

function renderSettings(): void {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } }
  })
  render(h(QueryClientProvider, { client }, h(SettingsPage)))
}

describe('Feature #23 — kindle import helpers', () => {
  it('should preselect the proposed book and skip groups without match', () => {
    const selection = initialKindleSelection(groups)
    expect(selection).toEqual({ [groups[0]!.key]: 1, [groups[1]!.key]: null })
    expect(buildKindleAssignments(selection)).toEqual([{ groupKey: groups[0]!.key, bookId: 1 }])
    expect(countSelectedAnnotations(groups, selection)).toEqual({
      groups: 1,
      highlights: 2,
      notes: 1
    })
  })

  it('should label the match origin with token classes only', () => {
    expect(matchBadge(groups[0]!.match).label).toBe('Título y autor')
    expect(matchBadge(null).label).toBe('Sin coincidencia')
    expect(
      matchBadge({ bookId: 1, method: 'SIMILARITY', confidence: 'LOW', score: 0.6 }).className
    ).toContain('text-star')
  })
})

describe('Feature #23 — Kindle import from Settings', () => {
  let books: BookPrimitives[]

  beforeEach(() => {
    vi.restoreAllMocks()
    books = [book(1, 'Legado de cenizas', 'Tim Weiner'), book(2, 'Ficciones', 'Jorge Luis Borges')]
    vi.spyOn(settingsService, 'get').mockResolvedValue({
      success: true,
      data: { googleBooksApiKey: '', theme: 'light' }
    })
    vi.spyOn(settingsService, 'getAppInfo').mockResolvedValue({ success: false, error: 'n/a' })
    vi.spyOn(bookService, 'list').mockImplementation(async () => ({ success: true, data: books }))
  })

  afterEach(() => {
    cleanup()
  })

  it('should show the import section in Settings', () => {
    renderSettings()
    const section = screen.getByTestId('kindle-import-settings-section')
    expect(within(section).getByTestId('kindle-import-button').textContent).toContain(
      'Importar del Kindle'
    )
  })

  it('should preview, let the user correct the book and show the final report', async () => {
    vi.spyOn(kindleService, 'previewFromDevice').mockResolvedValue({
      success: true,
      data: previewResult
    })
    const commit = vi
      .spyOn(kindleService, 'commit')
      .mockResolvedValue({ success: true, data: report })
    renderSettings()
    const invalidate = vi.spyOn(client, 'invalidateQueries')

    fireEvent.click(screen.getByTestId('kindle-import-button'))

    const rows = await screen.findAllByTestId('kindle-import-group')
    expect(rows).toHaveLength(2)
    expect(within(rows[0]!).getByTestId('kindle-import-group-counts').textContent).toBe(
      '2 subrayados · 1 nota'
    )
    expect(screen.getByTestId('kindle-import-totals').textContent).toContain('2 subrayados')

    const selects = screen.getAllByTestId('kindle-import-group-select') as HTMLSelectElement[]
    await waitFor(() => expect(selects[1]!.querySelectorAll('option').length).toBe(4))
    expect(selects[0]!.value).toBe('1')
    expect(selects[1]!.value).toBe('')
    fireEvent.change(selects[1]!, { target: { value: '1' } })
    expect(screen.getByTestId('kindle-import-totals').textContent).toContain('3 subrayados')

    fireEvent.click(screen.getByTestId('kindle-import-confirm'))

    await screen.findByTestId('kindle-import-report')
    expect(commit).toHaveBeenCalledWith({
      sourceId: 'session-1',
      assignments: [
        { groupKey: groups[0]!.key, bookId: 1 },
        { groupKey: groups[1]!.key, bookId: 1 }
      ]
    })
    expect(screen.getByTestId('kindle-import-report-imported').textContent).toContain(
      '3 subrayados y 1 nota'
    )
    expect(screen.getByTestId('kindle-import-report-skipped').textContent).toContain('0 subrayados')
    const keys = invalidate.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey))
    expect(keys).toEqual(expect.arrayContaining(['["highlights"]', '["notes"]', '["books"]']))
  })

  it('should offer the file picker when the Kindle is not found', async () => {
    vi.spyOn(kindleService, 'previewFromDevice').mockResolvedValue({
      success: false,
      error: 'No encontré un Kindle conectado',
      code: 'KINDLE_NOT_FOUND'
    })
    const fromFile = vi
      .spyOn(kindleService, 'previewFromFile')
      .mockResolvedValueOnce({ success: true, data: null })
      .mockResolvedValueOnce({
        success: true,
        data: { ...previewResult, source: 'FILE', sourceLabel: 'My Clippings.txt' }
      })
    renderSettings()

    fireEvent.click(screen.getByTestId('kindle-import-button'))
    expect((await screen.findByTestId('kindle-import-error')).textContent).toContain(
      'No encontré un Kindle'
    )

    fireEvent.click(screen.getByTestId('kindle-import-choose-file'))
    await waitFor(() => expect(fromFile).toHaveBeenCalledTimes(1))
    expect(await screen.findByTestId('kindle-import-fallback')).toBeTruthy()

    fireEvent.click(screen.getByTestId('kindle-import-choose-file'))
    expect(await screen.findAllByTestId('kindle-import-group')).toHaveLength(2)
    expect(screen.getByText('Origen: My Clippings.txt')).toBeTruthy()
  })

  it('should create a book with the normalized title and author and assign it to the group', async () => {
    vi.spyOn(kindleService, 'previewFromDevice').mockResolvedValue({
      success: true,
      data: previewResult
    })
    const create = vi.spyOn(bookService, 'create').mockImplementation(async (dto) => {
      const created = book(9, dto.title, (dto.authors as string[]).join(', '))
      books = [...books, created]
      return { success: true, data: created }
    })
    renderSettings()
    fireEvent.click(screen.getByTestId('kindle-import-button'))
    await screen.findAllByTestId('kindle-import-group')

    const selects = screen.getAllByTestId('kindle-import-group-select') as HTMLSelectElement[]
    fireEvent.change(selects[1]!, { target: { value: '__create__' } })

    const title = (await screen.findByTestId('input-book-title')) as HTMLInputElement
    expect(title.value).toBe('Eisenhorn The Omnibus')
    expect((screen.getByTestId('input-book-authors') as HTMLInputElement).value).toBe('Dan Abnett')
    fireEvent.click(screen.getByTestId('submit-book-button'))

    await waitFor(() => expect(create).toHaveBeenCalled())
    await waitFor(() => {
      const current = screen.getAllByTestId('kindle-import-group-select') as HTMLSelectElement[]
      expect(current[1]!.value).toBe('9')
    })
    expect(screen.queryByTestId('add-book-modal')).toBeNull()
  })
})

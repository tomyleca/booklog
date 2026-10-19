// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SettingsPage } from '../../src/renderer/src/pages/SettingsPage.js'
import { settingsService } from '../../src/renderer/src/services/settingsService.js'
import { kindleService } from '../../src/renderer/src/services/kindleService.js'
import { bookService } from '../../src/renderer/src/services/bookService.js'
import { searchService } from '../../src/renderer/src/services/searchService.js'
import {
  buildKindleAssignments,
  countSelectedAnnotations,
  initialKindleSelection,
  KindleGroupSort,
  matchBadge,
  sortKindleGroups
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

    const search = vi.spyOn(searchService, 'searchBooks').mockResolvedValue({
      success: true,
      data: [
        {
          googleBooksId: 'eisenhorn',
          title: 'Eisenhorn: The Omnibus',
          authors: ['Dan Abnett'],
          coverUrl: null,
          isbn: '9781849707251'
        }
      ]
    })
    const selects = screen.getAllByTestId('kindle-import-group-select') as HTMLSelectElement[]
    fireEvent.change(selects[1]!, { target: { value: '__create__' } })

    // Feature #25: abre en la pestaña de búsqueda, precargada, y busca sin esperar el debounce.
    const query = (await screen.findByTestId('search-books-input')) as HTMLInputElement
    expect(query.value).toBe('Eisenhorn The Omnibus')
    expect((screen.getByTestId('search-author-input') as HTMLInputElement).value).toBe('Dan Abnett')
    await waitFor(() => expect(search).toHaveBeenCalledWith('Eisenhorn The Omnibus', 'Dan Abnett'))
    expect(search).toHaveBeenCalledTimes(1)
    fireEvent.click(await screen.findByTestId('search-result-card-0'))

    const title = (await screen.findByTestId('input-book-title')) as HTMLInputElement
    expect(title.value).toBe('Eisenhorn: The Omnibus')
    expect((screen.getByTestId('input-book-authors') as HTMLInputElement).value).toBe('Dan Abnett')
    fireEvent.click(screen.getByTestId('submit-book-button'))

    await waitFor(() => expect(create).toHaveBeenCalled())
    await waitFor(() => {
      const current = screen.getAllByTestId('kindle-import-group-select') as HTMLSelectElement[]
      expect(current[1]!.value).toBe('9')
    })
    expect(screen.queryByTestId('add-book-modal')).toBeNull()
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Eisenhorn: The Omnibus', googleBooksId: 'eisenhorn' })
    )
  })

  it('should keep the manual tab prefilled when the user skips the search', async () => {
    vi.spyOn(kindleService, 'previewFromDevice').mockResolvedValue({
      success: true,
      data: previewResult
    })
    vi.spyOn(searchService, 'searchBooks').mockResolvedValue({ success: true, data: [] })
    renderSettings()
    fireEvent.click(screen.getByTestId('kindle-import-button'))
    await screen.findAllByTestId('kindle-import-group')

    const selects = screen.getAllByTestId('kindle-import-group-select') as HTMLSelectElement[]
    fireEvent.change(selects[1]!, { target: { value: '__create__' } })
    await screen.findByTestId('search-no-results')
    fireEvent.click(screen.getByTestId('tab-manual'))

    expect((screen.getByTestId('input-book-title') as HTMLInputElement).value).toBe(
      'Eisenhorn The Omnibus'
    )
    expect((screen.getByTestId('input-book-authors') as HTMLInputElement).value).toBe('Dan Abnett')
  })

  it('should reorder the preview without changing the chosen books', async () => {
    vi.spyOn(kindleService, 'previewFromDevice').mockResolvedValue({
      success: true,
      data: previewResult
    })
    renderSettings()
    fireEvent.click(screen.getByTestId('kindle-import-button'))
    await screen.findAllByTestId('kindle-import-group')

    const sort = screen.getByTestId('kindle-import-sort') as HTMLSelectElement
    expect(sort.value).toBe(KindleGroupSort.HIGHLIGHTS)
    const titles = (): string[] =>
      screen
        .getAllByTestId('kindle-import-group')
        .map(
          (li) =>
            within(li).getByTestId('kindle-import-group-select').getAttribute('aria-label') ?? ''
        )
    expect(titles()).toEqual(['Libro para Legado de cenizas', 'Libro para Eisenhorn The Omnibus'])

    let selects = screen.getAllByTestId('kindle-import-group-select') as HTMLSelectElement[]
    fireEvent.change(selects[1]!, { target: { value: '2' } })

    fireEvent.change(sort, { target: { value: KindleGroupSort.TITLE } })
    expect(titles()).toEqual(['Libro para Eisenhorn The Omnibus', 'Libro para Legado de cenizas'])
    selects = screen.getAllByTestId('kindle-import-group-select') as HTMLSelectElement[]
    expect(selects.map((select) => select.value)).toEqual(['2', '1'])
  })
})

describe('Feature #25 — preview order', () => {
  const group = (
    key: string,
    highlightCount: number,
    noteCount: number,
    lastCapturedAt: Date | null
  ): KindleImportGroupPreview => ({
    key,
    rawTitle: key,
    title: key,
    author: null,
    isbn: null,
    highlightCount,
    noteCount,
    supersededHighlights: 0,
    supersededNotes: 0,
    lastCapturedAt,
    match: null
  })
  const sample = [
    group('Borges', 3, 0, new Date(2025, 0, 2)),
    group('ábaco', 10, 1, null),
    group('Cortázar', 3, 5, new Date(2025, 5, 1)),
    group('Dune', 1, 2, new Date(2024, 0, 1))
  ]
  const keys = (sort: KindleGroupSort): string[] => sortKindleGroups(sample, sort).map((g) => g.key)

  it('should sort by highlights (desc) by default and break ties by title', () => {
    expect(keys(KindleGroupSort.HIGHLIGHTS)).toEqual(['ábaco', 'Borges', 'Cortázar', 'Dune'])
  })

  it('should sort by notes, by latest date (undated last) and by title A-Z', () => {
    expect(keys(KindleGroupSort.NOTES)).toEqual(['Cortázar', 'Dune', 'ábaco', 'Borges'])
    expect(keys(KindleGroupSort.LAST_DATE)).toEqual(['Cortázar', 'Borges', 'Dune', 'ábaco'])
    expect(keys(KindleGroupSort.TITLE)).toEqual(['ábaco', 'Borges', 'Cortázar', 'Dune'])
  })

  it('should not mutate the original list', () => {
    const before = sample.map((g) => g.key)
    sortKindleGroups(sample, KindleGroupSort.TITLE)
    expect(sample.map((g) => g.key)).toEqual(before)
  })
})

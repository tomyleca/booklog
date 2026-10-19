import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, CheckCircle2, FileText, Loader2, RefreshCw, Tablet, X } from 'lucide-react'
import { bookService } from '../services/bookService.js'
import { kindleService } from '../services/kindleService.js'
import { AddBookModal } from './AddBookModal.js'
import type { AddBookFormValues, AddBookInitialSearch } from './AddBookModal.js'
import {
  buildKindleAssignments,
  countSelectedAnnotations,
  DEFAULT_KINDLE_GROUP_SORT,
  initialKindleSelection,
  KINDLE_GROUP_SORT_OPTIONS,
  matchBadge,
  notebookStateBadge,
  pluralize,
  SELECT_CREATE,
  SELECT_SKIP,
  sortKindleGroups
} from './kindleImport.js'
import type { KindleGroupSort, KindleSelection } from './kindleImport.js'
import type {
  BookPrimitives,
  IpcResult,
  KindleImportGroupPreview,
  KindleImportReport,
  KindleImportSource,
  KindlePreviewResultDTO
} from '../../../shared/infrastructure/ipc/contracts.js'

export interface KindleImportModalProps {
  /**
   * Por dónde empezar: buscar el Kindle conectado, elegir un archivo (`My Clippings.txt`) o
   * buscar las exportaciones del Cuaderno de la app en su carpeta (#26).
   */
  initialSource: KindleImportSource
  onClose: () => void
}

type Phase =
  | { name: 'choose' }
  | { name: 'loading'; source: KindleImportSource }
  | { name: 'error'; message: string }
  | { name: 'preview' }
  | { name: 'committing' }
  | { name: 'done'; report: KindleImportReport }

const BUTTON_PRIMARY =
  'inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md text-accent-ink bg-accent hover:bg-accent-strong shadow-sm transition-colors disabled:opacity-50'
const BUTTON_SECONDARY =
  'inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md text-ink bg-shelf hover:bg-rule border border-rule transition-colors disabled:opacity-50'

const LOADING_MESSAGES: Record<KindleImportSource, string> = {
  DEVICE: 'Buscando el Kindle y copiando My Clippings.txt...',
  FILE: 'Leyendo el archivo elegido...',
  NOTEBOOK: 'Buscando exportaciones del Cuaderno de la app de Kindle...'
}

async function readSource(
  source: KindleImportSource
): Promise<IpcResult<KindlePreviewResultDTO | null>> {
  if (source === 'DEVICE') return await kindleService.previewFromDevice()
  if (source === 'NOTEBOOK') return await kindleService.previewNotebooks()
  return await kindleService.previewFromFile()
}

/**
 * Importación del Kindle con vista previa. Dos fuentes con el mismo flujo: `My Clippings.txt`
 * (feature #23: lee el Kindle o un archivo; un grupo por título) y las exportaciones del
 * Cuaderno de la app (#26: un grupo por archivo, con los ya importados marcados y
 * desmarcados). Muestra el libro propuesto de cada grupo y permite corregirlo, crear el libro
 * o no importarlo; después confirma y muestra el informe.
 */
export function KindleImportModal({ initialSource, onClose }: KindleImportModalProps): JSX.Element {
  const queryClient = useQueryClient()
  const [phase, setPhase] = useState<Phase>({ name: 'loading', source: initialSource })
  const [result, setResult] = useState<KindlePreviewResultDTO | null>(null)
  const [selection, setSelection] = useState<KindleSelection>({})
  const [creatingFor, setCreatingFor] = useState<KindleImportGroupPreview | null>(null)
  const [commitError, setCommitError] = useState<string | null>(null)
  const [sort, setSort] = useState<KindleGroupSort>(DEFAULT_KINDLE_GROUP_SORT)
  const started = useRef(false)

  const { data: books = [] } = useQuery<BookPrimitives[], Error>({
    queryKey: ['books', 'ALL'],
    queryFn: async () => {
      const res = await bookService.list(undefined)
      if (!res.success) throw new Error(res.error || 'No se pudo cargar la biblioteca')
      return res.data
    }
  })

  const sortedBooks = useMemo(
    () => [...books].sort((a, b) => a.title.localeCompare(b.title, 'es')),
    [books]
  )

  const load = useCallback(
    async (source: KindleImportSource) => {
      setPhase({ name: 'loading', source })
      setCommitError(null)
      try {
        const res = await readSource(source)
        if (!res.success) {
          setPhase({ name: 'error', message: res.error })
          return
        }
        if (res.data === null) {
          setPhase(result ? { name: 'preview' } : { name: 'choose' })
          return
        }
        setResult(res.data)
        setSelection(initialKindleSelection(res.data.preview.groups))
        setPhase({ name: 'preview' })
      } catch (err) {
        setPhase({
          name: 'error',
          message: err instanceof Error ? err.message : 'No se pudo leer el archivo del Kindle.'
        })
      }
    },
    [result]
  )

  useEffect(() => {
    // Evita una segunda lectura del dispositivo con el doble montaje de StrictMode.
    if (started.current) return
    started.current = true
    void load(initialSource)
  }, [initialSource, load])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !creatingFor && phase.name !== 'committing') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [creatingFor, phase.name, onClose])

  const handleSelect = (group: KindleImportGroupPreview, value: string): void => {
    if (value === SELECT_CREATE) {
      setCreatingFor(group)
      return
    }
    setSelection((prev) => ({ ...prev, [group.key]: value === SELECT_SKIP ? null : Number(value) }))
  }

  const handleCommit = async (): Promise<void> => {
    if (!result) return
    setCommitError(null)
    setPhase({ name: 'committing' })
    try {
      const res = await kindleService.commit({
        sourceId: result.sourceId,
        assignments: buildKindleAssignments(selection)
      })
      if (!res.success) {
        setCommitError(res.error)
        setPhase({ name: 'preview' })
        return
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['highlights'] }),
        queryClient.invalidateQueries({ queryKey: ['notes'] }),
        queryClient.invalidateQueries({ queryKey: ['books'] }),
        queryClient.invalidateQueries({ queryKey: ['book'] })
      ])
      setPhase({ name: 'done', report: res.data })
    } catch (err) {
      setCommitError(err instanceof Error ? err.message : 'No se pudo importar.')
      setPhase({ name: 'preview' })
    }
  }

  const isNotebook = initialSource === 'NOTEBOOK'
  const groups = useMemo(() => result?.preview.groups ?? [], [result])
  const sortedGroups = useMemo(() => sortKindleGroups(groups, sort), [groups, sort])
  const totals = countSelectedAnnotations(groups, selection)

  // Memoizado: AddBookModal reinicia el formulario cada vez que cambia `initialValues`.
  const createValues = useMemo<Partial<AddBookFormValues> | undefined>(
    () =>
      creatingFor
        ? {
            title: creatingFor.title,
            authors: creatingFor.author ?? '',
            isbn: creatingFor.isbn ?? null
          }
        : undefined,
    [creatingFor]
  )

  // Feature #25: el modal abre en la pestaña de búsqueda y busca solo con título y autor.
  const createSearch = useMemo<AddBookInitialSearch | undefined>(
    () =>
      creatingFor ? { query: creatingFor.title, author: creatingFor.author ?? '' } : undefined,
    [creatingFor]
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-backdrop/70 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="kindle-import-title"
      data-testid="kindle-import-modal"
    >
      <div className="relative w-full max-w-3xl ficha ficha-float rounded-md p-6 text-ink flex flex-col gap-4 my-8">
        <div className="flex items-start justify-between pb-3 rule-double">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-leather texture-wood text-brass border border-backdrop/30 shadow-sm">
              <Tablet className="w-5 h-5" />
            </div>
            <div>
              <h2 id="kindle-import-title" className="text-lg font-bold tracking-tight text-ink">
                {isNotebook ? 'Importar exportaciones de la app' : 'Importar del Kindle'}
              </h2>
              <p className="text-xs text-ink-muted mt-0.5 break-all">
                {result
                  ? `${isNotebook ? 'Carpeta' : 'Origen'}: ${result.sourceLabel}`
                  : isNotebook
                    ? 'Subrayados y notas desde el Cuaderno de la app de Kindle'
                    : 'Subrayados y notas desde My Clippings.txt'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={phase.name === 'committing'}
            className="p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-shelf transition-colors"
            aria-label="Cerrar importación"
            data-testid="kindle-import-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {phase.name === 'loading' && (
          <div
            className="flex flex-col items-center justify-center py-12 text-ink-muted gap-3"
            data-testid="kindle-import-loading"
          >
            <Loader2 className="w-7 h-7 animate-spin text-accent" />
            <p className="text-sm">{LOADING_MESSAGES[phase.source]}</p>
          </div>
        )}

        {(phase.name === 'error' || phase.name === 'choose') && (
          <div className="flex flex-col gap-4 py-4" data-testid="kindle-import-fallback">
            {phase.name === 'error' && (
              <div
                className="flex items-start gap-2.5 p-3 rounded-md bg-danger/10 border border-danger/30 text-danger text-xs"
                data-testid="kindle-import-error"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{phase.message}</span>
              </div>
            )}
            {isNotebook ? (
              <>
                <p className="text-xs text-ink-muted">
                  En la app de Kindle para PC abrí el libro, mostrá el Cuaderno y usá{' '}
                  <span className="font-semibold">Exportar cuaderno</span>. BookLog busca los
                  archivos <span className="font-mono">*-Bloc de notas.html</span> y{' '}
                  <span className="font-mono">*-Notebook.html</span> en la carpeta elegida en
                  Configuración.
                </p>
                <div className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={() => void load('NOTEBOOK')}
                    className={BUTTON_PRIMARY}
                    data-testid="kindle-import-retry-notebook"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Buscar de nuevo</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-ink-muted">
                  Conectá el Kindle por USB y desbloquealo, o elegí el archivo{' '}
                  <span className="font-mono">documents/My Clippings.txt</span> copiado a tu equipo.
                </p>
                <div className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={() => void load('DEVICE')}
                    className={BUTTON_SECONDARY}
                    data-testid="kindle-import-retry-device"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Buscar el Kindle de nuevo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void load('FILE')}
                    className={BUTTON_PRIMARY}
                    data-testid="kindle-import-choose-file"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Elegir archivo .txt</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {(phase.name === 'preview' || phase.name === 'committing') && result && (
          <div className="flex flex-col gap-4" data-testid="kindle-import-preview">
            <p className="text-xs text-ink-muted" data-testid="kindle-import-summary">
              {isNotebook &&
                `${pluralize(result.preview.fileCount ?? groups.length, 'exportación', 'exportaciones')} en la carpeta · `}
              {pluralize(result.preview.totalEntries, 'entrada', 'entradas')}
              {isNotebook ? '' : ' en el archivo'} · {pluralize(groups.length, 'título', 'títulos')}{' '}
              · se ignoran {pluralize(result.preview.ignoredBookmarks, 'marcador', 'marcadores')} y{' '}
              {pluralize(result.preview.ignoredEmpty, 'entrada vacía', 'entradas vacías')}
              {result.preview.unrecognizedEntries > 0 &&
                ` · ${pluralize(result.preview.unrecognizedEntries, 'entrada no reconocida', 'entradas no reconocidas')}`}
            </p>

            {commitError && (
              <div
                className="flex items-start gap-2.5 p-3 rounded-md bg-danger/10 border border-danger/30 text-danger text-xs"
                data-testid="kindle-import-commit-error"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{commitError}</span>
              </div>
            )}

            {groups.length > 1 && (
              <label className="flex items-center gap-2 text-xs text-ink-muted self-end">
                <span>Ordenar por</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as KindleGroupSort)}
                  disabled={phase.name === 'committing'}
                  className="px-2 py-1.5 rounded-md bg-card border border-rule text-xs text-ink focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                  data-testid="kindle-import-sort"
                >
                  {KINDLE_GROUP_SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {groups.length === 0 ? (
              <p
                className="text-sm text-ink-muted py-6 text-center"
                data-testid="kindle-import-empty"
              >
                {isNotebook
                  ? 'No hay exportaciones del Cuaderno con subrayados o notas en esta carpeta.'
                  : 'El archivo no tiene subrayados ni notas para importar.'}
              </p>
            ) : (
              <ul className="flex flex-col gap-2 max-h-[55vh] overflow-y-auto pr-1">
                {sortedGroups.map((group) => {
                  const badge = matchBadge(group.match)
                  const stateBadge = notebookStateBadge(group.importState)
                  const selected = selection[group.key]
                  const selectedMissing =
                    typeof selected === 'number' && !sortedBooks.some((b) => b.id === selected)
                  return (
                    <li
                      key={group.key}
                      className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-md bg-well/60 border border-rule/80"
                      data-testid="kindle-import-group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-ink truncate" title={group.title}>
                          {group.title}
                        </p>
                        <p className="text-xs text-ink-muted truncate">
                          {group.author ?? 'Autor desconocido'}
                        </p>
                        <p
                          className="text-[11px] text-ink-faint truncate"
                          title={group.fileName ?? group.rawTitle}
                        >
                          {group.fileName
                            ? `Archivo: ${group.fileName}`
                            : `Kindle: ${group.rawTitle}`}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-ink-muted">
                          <span data-testid="kindle-import-group-counts">
                            {pluralize(group.highlightCount, 'subrayado', 'subrayados')} ·{' '}
                            {pluralize(group.noteCount, 'nota', 'notas')}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded border ${badge.className}`}
                            data-testid="kindle-import-group-badge"
                          >
                            {badge.label}
                          </span>
                          {stateBadge && (
                            <span
                              className={`px-1.5 py-0.5 rounded border ${stateBadge.className}`}
                              data-testid="kindle-import-group-state"
                            >
                              {stateBadge.label}
                            </span>
                          )}
                        </div>
                      </div>
                      <select
                        aria-label={`Libro para ${group.title}`}
                        value={typeof selected === 'number' ? String(selected) : SELECT_SKIP}
                        onChange={(e) => handleSelect(group, e.target.value)}
                        disabled={phase.name === 'committing'}
                        className="sm:w-64 px-3 py-2 rounded-md bg-card border border-rule text-xs text-ink focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                        data-testid="kindle-import-group-select"
                      >
                        <option value={SELECT_SKIP}>— No importar —</option>
                        <option value={SELECT_CREATE}>+ Crear libro…</option>
                        {selectedMissing && (
                          <option value={String(selected)}>Libro nuevo (#{selected})</option>
                        )}
                        {sortedBooks.map((book) => (
                          <option key={book.id} value={String(book.id)}>
                            {book.title} — {book.authors}
                          </option>
                        ))}
                      </select>
                    </li>
                  )
                })}
              </ul>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-rule">
              <span className="text-xs text-ink-muted" data-testid="kindle-import-totals">
                Se importarán {pluralize(totals.highlights, 'subrayado', 'subrayados')} y{' '}
                {pluralize(totals.notes, 'nota', 'notas')} de{' '}
                {pluralize(totals.groups, 'título', 'títulos')}. Lo ya importado se omite.
              </span>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={phase.name === 'committing'}
                  className={BUTTON_SECONDARY}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void handleCommit()}
                  disabled={phase.name === 'committing' || totals.groups === 0}
                  className={BUTTON_PRIMARY}
                  data-testid="kindle-import-confirm"
                >
                  {phase.name === 'committing' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{phase.name === 'committing' ? 'Importando...' : 'Importar'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {phase.name === 'done' && (
          <div className="flex flex-col gap-4" data-testid="kindle-import-report">
            <div className="flex items-start gap-2.5 p-3 rounded-md bg-success/10 border border-success/30 text-success text-sm">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span data-testid="kindle-import-report-imported">
                Importados: {pluralize(phase.report.highlightsImported, 'subrayado', 'subrayados')}{' '}
                y {pluralize(phase.report.notesImported, 'nota', 'notas')}.
              </span>
            </div>
            <p className="text-xs text-ink-muted" data-testid="kindle-import-report-skipped">
              Omitidos por estar ya importados:{' '}
              {pluralize(phase.report.highlightsSkipped, 'subrayado', 'subrayados')} y{' '}
              {pluralize(phase.report.notesSkipped, 'nota', 'notas')}.
              {phase.report.groupsNotImported > 0 &&
                ` Títulos no importados: ${phase.report.groupsNotImported}.`}
            </p>
            {phase.report.books.length > 0 && (
              <ul className="flex flex-col gap-1.5 text-xs">
                {phase.report.books.map((book) => (
                  <li
                    key={book.bookId}
                    className="flex justify-between gap-3 px-3 py-2 rounded-md bg-well/60 border border-rule/80"
                  >
                    <span className="font-semibold text-ink truncate">{book.title}</span>
                    <span className="text-ink-muted shrink-0">
                      +{book.highlightsImported} subrayados · +{book.notesImported} notas
                      {book.highlightsSkipped + book.notesSkipped > 0 &&
                        ` · ${book.highlightsSkipped + book.notesSkipped} omitidos`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end pt-3 border-t border-rule">
              <button
                type="button"
                onClick={onClose}
                className={BUTTON_PRIMARY}
                data-testid="kindle-import-done"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>

      <AddBookModal
        isOpen={creatingFor !== null}
        onClose={() => setCreatingFor(null)}
        initialValues={createValues}
        initialSearch={createSearch}
        onCreated={(book) => {
          if (creatingFor && book.id !== undefined) {
            const key = creatingFor.key
            setSelection((prev) => ({ ...prev, [key]: book.id as number }))
          }
        }}
      />
    </div>
  )
}

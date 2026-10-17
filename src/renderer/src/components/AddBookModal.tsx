import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  X,
  BookPlus,
  AlertCircle,
  Search,
  PenLine,
  BookOpen,
  Calendar,
  Loader2,
  CheckCircle2
} from 'lucide-react'
import { BookStatus } from '../../../shared/domain/entities/BookStatus.js'
import { bookService } from '../services/bookService.js'
import { searchService } from '../services/searchService.js'
import type { BookSearchResult } from '../../../shared/domain/ports/BookSearchService.js'
import { FinishedDateField } from './FinishedDateField.js'
import { defaultFinishedDateInput, validateFinishedDateInput } from './finishedDate.js'

export interface AddBookFormValues {
  title: string
  authors: string | string[]
  pageCount?: number | string | null
  isbn?: string | null
  status?: BookStatus
  coverUrl?: string | null
  googleBooksId?: string | null
}

export interface AddBookModalProps {
  isOpen: boolean
  onClose: () => void
  initialValues?: Partial<AddBookFormValues>
  renderSearchSlot?: () => React.ReactNode
}

export function AddBookModal({
  isOpen,
  onClose,
  initialValues,
  renderSearchSlot
}: AddBookModalProps): JSX.Element | null {
  const queryClient = useQueryClient()

  // Tab state: 'search' (default) or 'manual'
  const [activeTab, setActiveTab] = useState<'search' | 'manual'>('search')

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<BookSearchResult[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [lastSearchedQuery, setLastSearchedQuery] = useState('')
  const [autoFilledNotice, setAutoFilledNotice] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [authors, setAuthors] = useState('')
  const [pageCount, setPageCount] = useState('')
  const [isbn, setIsbn] = useState('')
  const [status, setStatus] = useState<BookStatus>(BookStatus.TO_READ)
  const [finishedDate, setFinishedDate] = useState(() => defaultFinishedDateInput())
  const [finishedDateError, setFinishedDateError] = useState<string | null>(null)
  const [coverUrl, setCoverUrl] = useState('')
  const [googleBooksId, setGoogleBooksId] = useState<string | null>(null)

  // Form error state
  const [titleError, setTitleError] = useState<string | null>(null)
  const [pageCountError, setPageCountError] = useState<string | null>(null)
  const [generalError, setGeneralError] = useState<string | null>(null)

  // Refs for search race conditions and debounce timer
  const searchRequestIdRef = useRef(0)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (isOpen) {
      const hasInitialData = Boolean(
        initialValues?.title ||
          initialValues?.isbn ||
          (Array.isArray(initialValues?.authors)
            ? initialValues.authors.length > 0
            : Boolean(initialValues?.authors))
      )
      setActiveTab(hasInitialData ? 'manual' : 'search')
      setSearchQuery('')
      setSearchResults([])
      setSearchError(null)
      setHasSearched(false)
      setLastSearchedQuery('')
      setAutoFilledNotice(false)

      setTitle(initialValues?.title ?? '')
      const initialAuthors = initialValues?.authors
      if (Array.isArray(initialAuthors)) {
        setAuthors(initialAuthors.join(', '))
      } else {
        setAuthors(initialAuthors ?? '')
      }
      setPageCount(
        initialValues?.pageCount !== undefined && initialValues?.pageCount !== null
          ? String(initialValues.pageCount)
          : ''
      )
      setIsbn(initialValues?.isbn ?? '')
      setStatus(initialValues?.status ?? BookStatus.TO_READ)
      setFinishedDate(defaultFinishedDateInput())
      setFinishedDateError(null)
      setCoverUrl(initialValues?.coverUrl ?? '')
      setGoogleBooksId(initialValues?.googleBooksId ?? null)

      setTitleError(null)
      setPageCountError(null)
      setGeneralError(null)
    }
  }, [isOpen, initialValues])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  const executeSearch = useCallback(async (queryToSearch: string) => {
    const trimmed = queryToSearch.trim()
    if (trimmed.length < 3) {
      setSearchResults([])
      setHasSearched(false)
      setIsSearching(false)
      return
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }

    const requestId = ++searchRequestIdRef.current
    setIsSearching(true)
    setSearchError(null)
    setLastSearchedQuery(trimmed)

    try {
      const res = await searchService.searchBooks(trimmed)
      if (requestId !== searchRequestIdRef.current) {
        return
      }
      if (res.success) {
        setSearchResults(res.data)
        setHasSearched(true)
      } else {
        setSearchError(res.error || 'Error al buscar libros en Google Books.')
        setSearchResults([])
        setHasSearched(true)
      }
    } catch (err) {
      if (requestId !== searchRequestIdRef.current) {
        return
      }
      setSearchError(
        err instanceof Error ? err.message : 'Error de red al conectar con Google Books.'
      )
      setSearchResults([])
      setHasSearched(true)
    } finally {
      if (requestId === searchRequestIdRef.current) {
        setIsSearching(false)
      }
    }
  }, [])

  const handleSearchChange = (value: string): void => {
    setSearchQuery(value)
    setSearchError(null)

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    if (value.trim().length >= 3) {
      debounceTimerRef.current = setTimeout(() => {
        executeSearch(value)
      }, 500)
    } else {
      setSearchResults([])
      setHasSearched(false)
      setIsSearching(false)
    }
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
      executeSearch(searchQuery)
    }
  }

  const handleSearchClick = (): void => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    executeSearch(searchQuery)
  }

  const handleSelectResult = (result: BookSearchResult): void => {
    setTitle(result.title)
    setAuthors(result.authors.join(', '))
    setPageCount(result.pageCount ? String(result.pageCount) : '')
    setIsbn(result.isbn ?? '')
    setCoverUrl(result.coverUrl ?? '')
    setGoogleBooksId(result.googleBooksId ?? null)
    setTitleError(null)
    setPageCountError(null)
    setAutoFilledNotice(true)
    setActiveTab('manual')
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const trimmedTitle = title.trim()
      if (!trimmedTitle) {
        throw new Error('El título del libro es obligatorio.')
      }

      let parsedPageCount: number | null = null
      if (pageCount.trim()) {
        const parsed = parseInt(pageCount.trim(), 10)
        if (Number.isNaN(parsed) || parsed <= 0) {
          throw new Error('La cantidad de páginas debe ser un número entero mayor a 0.')
        }
        parsedPageCount = parsed
      }

      const authorsList = authors
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean)

      const trimmedCover = coverUrl.trim()
      let coverPath: string | null = null
      let coverUrlToSave: string | null = null

      if (trimmedCover) {
        if (trimmedCover.startsWith('http://') || trimmedCover.startsWith('https://')) {
          coverUrlToSave = trimmedCover
          try {
            if (typeof window !== 'undefined' && window.api?.covers?.saveFromUrl) {
              const coverRes = await window.api.covers.saveFromUrl(trimmedCover)
              if (coverRes && coverRes.success) {
                coverPath = coverRes.data
              }
            }
          } catch (err) {
            console.warn('Error al descargar portada desde URL:', err)
          }
        } else {
          coverPath = trimmedCover
        }
      }

      const res = await bookService.create({
        title: trimmedTitle,
        authors: authorsList.length > 0 ? authorsList : ['Desconocido'],
        pageCount: parsedPageCount,
        isbn: isbn.trim() || null,
        status,
        ...(status === BookStatus.FINISHED ? { finishedAt: finishedDate } : {}),
        coverUrl: coverUrlToSave,
        coverPath,
        ...(googleBooksId ? { googleBooksId } : {})
      })

      if (!res.success) {
        throw new Error(res.error || 'Error al guardar el libro')
      }

      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['books'] })
      onClose()
    },
    onError: (err: Error) => {
      setGeneralError(err.message)
    }
  })

  if (!isOpen) {
    return null
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault()

    let hasErrors = false

    if (!title.trim()) {
      setTitleError('El título es obligatorio.')
      hasErrors = true
    } else {
      setTitleError(null)
    }

    if (pageCount.trim()) {
      const parsed = parseInt(pageCount.trim(), 10)
      if (Number.isNaN(parsed) || parsed <= 0) {
        setPageCountError('La cantidad de páginas debe ser un entero mayor a 0.')
        hasErrors = true
      } else {
        setPageCountError(null)
      }
    } else {
      setPageCountError(null)
    }

    if (status === BookStatus.FINISHED) {
      const dateError = validateFinishedDateInput(finishedDate)
      setFinishedDateError(dateError)
      if (dateError) hasErrors = true
    } else {
      setFinishedDateError(null)
    }

    if (hasErrors) {
      return
    }

    setGeneralError(null)
    mutation.mutate()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-backdrop/70 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
      data-testid="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-book-modal-title"
    >
      <div
        className="relative w-full max-w-xl ficha ficha-float rounded-md p-6 text-ink flex flex-col gap-4 my-8"
        onClick={(e) => e.stopPropagation()}
        data-testid="add-book-modal"
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3 rule-double">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-leather texture-wood text-brass border border-backdrop/30 shadow-sm">
              <BookPlus className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="add-book-modal-title"
                className="text-lg font-bold tracking-tight text-ink"
                data-testid="modal-title"
              >
                Agregar Libro
              </h2>
              <p className="text-xs text-ink-muted mt-0.5">
                Busca en Google Books o ingresa los datos manualmente
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-shelf transition-colors"
            aria-label="Cerrar modal"
            data-testid="close-modal-button"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-rule pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('search')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'search'
                ? 'bg-accent/10 text-accent border border-accent/40 shadow-sm'
                : 'text-ink-muted hover:text-ink hover:bg-shelf/60 border border-transparent'
            }`}
            data-testid="tab-search"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Buscar en Google</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'manual'
                ? 'bg-accent/10 text-accent border border-accent/40 shadow-sm'
                : 'text-ink-muted hover:text-ink hover:bg-shelf/60 border border-transparent'
            }`}
            data-testid="tab-manual"
          >
            <PenLine className="w-3.5 h-3.5" />
            <span>Carga manual</span>
          </button>
        </div>

        {/* Modular Search Slot (Feature #10 compatibility) */}
        {renderSearchSlot && (
          <div className="search-slot pb-2 border-b border-rule" data-testid="search-slot">
            {renderSearchSlot()}
          </div>
        )}

        {/* SEARCH TAB CONTENT */}
        <div
          className={activeTab === 'search' ? 'flex flex-col gap-4' : 'hidden'}
          data-testid="search-tab-content"
        >
          {/* Search Input Bar */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Buscar por título, autor o ISBN (mín. 3 letras)..."
                className="w-full pl-9 pr-3.5 py-2 rounded-md bg-well border border-rule text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                data-testid="search-books-input"
              />
            </div>
            <button
              type="button"
              onClick={handleSearchClick}
              disabled={isSearching || searchQuery.trim().length < 3}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md text-accent-ink bg-accent hover:bg-accent-strong transition-colors disabled:opacity-40 disabled:hover:bg-accent shadow-sm"
              data-testid="search-books-button"
            >
              {isSearching ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Search className="w-3.5 h-3.5" />
              )}
              <span>Buscar</span>
            </button>
          </div>

          {/* Search Error Alert */}
          {searchError && (
            <div
              className="flex items-start gap-2.5 p-3 rounded-md bg-danger/10 border border-danger/30 text-danger text-xs"
              data-testid="search-error-banner"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-danger" />
              <span>{searchError}</span>
            </div>
          )}

          {/* Loading Indicator */}
          {isSearching && (
            <div
              className="flex flex-col items-center justify-center py-10 text-ink-muted gap-2"
              data-testid="search-loading"
            >
              <Loader2 className="w-6 h-6 animate-spin text-accent" />
              <span className="text-xs">Buscando libros en Google Books...</span>
            </div>
          )}

          {/* Less than 3 chars friendly message */}
          {!isSearching && searchQuery.trim().length < 3 && (
            <div
              className="flex flex-col items-center justify-center py-10 text-ink-faint text-center gap-2"
              data-testid="search-min-chars-message"
            >
              <Search className="w-8 h-8 text-ink-faint stroke-[1.5]" />
              <p className="text-xs">Ingresa al menos 3 caracteres para buscar libros.</p>
            </div>
          )}

          {/* No results message */}
          {!isSearching &&
            searchQuery.trim().length >= 3 &&
            hasSearched &&
            searchResults.length === 0 && (
              <div
                className="flex flex-col items-center justify-center py-10 text-ink-muted text-center gap-2"
                data-testid="search-no-results"
              >
                <AlertCircle className="w-8 h-8 text-ink-faint stroke-[1.5]" />
                <p className="text-xs font-medium text-ink">
                  No se encontraron libros para &ldquo;{lastSearchedQuery}&rdquo;
                </p>
                <p className="text-[11px] text-ink-faint">
                  Intenta con otro término o utiliza la pestaña de &ldquo;Carga manual&rdquo;.
                </p>
              </div>
            )}

          {/* Search Results List */}
          {!isSearching && searchResults.length > 0 && (
            <div
              className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1"
              data-testid="search-results-list"
            >
              {searchResults.map((result, idx) => (
                <div
                  key={result.googleBooksId || `${result.title}-${idx}`}
                  onClick={() => handleSelectResult(result)}
                  className="flex items-start gap-3 p-3 rounded-md bg-well/40 border border-rule/80 hover:border-accent/50 hover:bg-shelf/50 cursor-pointer transition-all group"
                  data-testid={`search-result-card-${idx}`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleSelectResult(result)
                    }
                  }}
                >
                  {/* Thumbnail */}
                  <div className="w-12 h-16 shrink-0 rounded-md overflow-hidden border border-rule bg-shelf flex items-center justify-center text-ink-faint">
                    {result.coverUrl ? (
                      <img
                        src={result.coverUrl}
                        alt={result.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    ) : (
                      <BookOpen className="w-5 h-5 text-ink-faint" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-ink group-hover:text-accent line-clamp-1 transition-colors">
                      {result.title}
                    </h4>
                    <p className="text-xs text-ink-muted truncate mt-0.5">
                      {result.authors.length > 0 ? result.authors.join(', ') : 'Autor desconocido'}
                    </p>

                    <div className="flex items-center gap-3 mt-2 text-[11px] text-ink-faint">
                      {result.publishedDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-ink-faint" />
                          <span>{result.publishedDate}</span>
                        </span>
                      )}
                      {result.pageCount && (
                        <span className="flex items-center gap-1">
                          <BookOpen className="w-3 h-3 text-ink-faint" />
                          <span>{result.pageCount} págs.</span>
                        </span>
                      )}
                      {result.isbn && (
                        <span className="truncate max-w-[130px] font-mono text-[10px] bg-shelf/80 px-1.5 py-0.5 rounded text-ink-muted">
                          ISBN {result.isbn}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer for search tab */}
          <div className="flex items-center justify-between pt-2 border-t border-rule text-xs text-ink-faint">
            <span>Haz clic en un libro para autocompletar el formulario</span>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium rounded-md text-ink-muted hover:text-ink hover:bg-shelf transition-colors"
              data-testid="cancel-search-button"
            >
              Cancelar
            </button>
          </div>
        </div>

        {/* MANUAL FORM CONTENT */}
        <div
          className={activeTab === 'manual' ? 'flex flex-col gap-4' : 'hidden'}
          data-testid="manual-tab-content"
        >
          {/* Pre-fill Notice Banner */}
          {autoFilledNotice && (
            <div
              className="flex items-center justify-between p-3 rounded-md bg-accent/10 border border-accent/40 text-accent text-xs"
              data-testid="prefill-notice"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
                <span>
                  Datos autocompletados desde Google Books. Revisa los datos antes de guardar.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAutoFilledNotice(false)}
                className="text-accent hover:text-accent-strong transition-colors"
                aria-label="Cerrar notificación"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Error Alert */}
          {(generalError || mutation.error) && (
            <div
              className="flex items-start gap-2.5 p-3 rounded-md bg-danger/10 border border-danger/30 text-danger text-xs"
              data-testid="form-error-banner"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-danger" />
              <span>{generalError || mutation.error?.message}</span>
            </div>
          )}

          {/* Manual Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="book-title" className="text-xs font-semibold text-ink">
                Título <span className="text-danger">*</span>
              </label>
              <input
                id="book-title"
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  if (titleError) setTitleError(null)
                }}
                placeholder="Ej. Cien Años de Soledad"
                className={`w-full px-3.5 py-2 rounded-md bg-well border text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 transition-all ${
                  titleError
                    ? 'border-danger focus:ring-danger/30'
                    : 'border-rule focus:border-accent focus:ring-accent/20'
                }`}
                data-testid="input-book-title"
                required
              />
              {titleError && (
                <p className="text-xs text-danger" data-testid="title-error">
                  {titleError}
                </p>
              )}
            </div>

            {/* Authors */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="book-authors" className="text-xs font-semibold text-ink">
                Autor(es){' '}
                <span className="text-ink-muted text-xs font-normal">(separados por coma)</span>
              </label>
              <input
                id="book-authors"
                type="text"
                value={authors}
                onChange={(e) => setAuthors(e.target.value)}
                placeholder="Ej. Gabriel García Márquez, Mario Vargas Llosa"
                className="w-full px-3.5 py-2 rounded-md bg-well border border-rule text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                data-testid="input-book-authors"
              />
              <p className="text-[11px] text-ink-muted">
                Si son varios autores, puedes escribirlos separados por comas.
              </p>
            </div>

            {/* Pages and ISBN */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="book-pages" className="text-xs font-semibold text-ink">
                  Páginas
                </label>
                <input
                  id="book-pages"
                  type="number"
                  min="1"
                  step="1"
                  value={pageCount}
                  onChange={(e) => {
                    setPageCount(e.target.value)
                    if (pageCountError) setPageCountError(null)
                  }}
                  placeholder="Ej. 350"
                  className={`w-full px-3.5 py-2 rounded-md bg-well border text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 transition-all ${
                    pageCountError
                      ? 'border-danger focus:ring-danger/30'
                      : 'border-rule focus:border-accent focus:ring-accent/20'
                  }`}
                  data-testid="input-book-pages"
                />
                {pageCountError && (
                  <p className="text-xs text-danger" data-testid="pages-error">
                    {pageCountError}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="book-isbn" className="text-xs font-semibold text-ink">
                  ISBN
                </label>
                <input
                  id="book-isbn"
                  type="text"
                  value={isbn}
                  onChange={(e) => setIsbn(e.target.value)}
                  placeholder="Ej. 9780307474728"
                  className="w-full px-3.5 py-2 rounded-md bg-well border border-rule text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                  data-testid="input-book-isbn"
                />
              </div>
            </div>

            {/* Initial Status */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="book-status" className="text-xs font-semibold text-ink">
                Estado inicial
              </label>
              <select
                id="book-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as BookStatus)}
                className="w-full px-3.5 py-2 rounded-md bg-well border border-rule text-sm text-ink focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                data-testid="select-book-status"
              >
                <option value={BookStatus.TO_READ}>Por leer</option>
                <option value={BookStatus.READING}>Leyendo</option>
                <option value={BookStatus.PAUSED}>Pausado</option>
                <option value={BookStatus.FINISHED}>Terminado</option>
                <option value={BookStatus.ABANDONED}>Abandonado</option>
              </select>
            </div>

            {status === BookStatus.FINISHED && (
              <FinishedDateField
                id="book-finished-date"
                value={finishedDate}
                onChange={(value) => {
                  setFinishedDate(value)
                  setFinishedDateError(null)
                }}
                error={finishedDateError}
                testId="input-book-finished-date"
              />
            )}

            {/* Cover URL */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="book-cover" className="text-xs font-semibold text-ink">
                Portada (URL o ruta opcional)
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="book-cover"
                  type="text"
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  placeholder="https://ejemplo.com/portada.jpg"
                  className="flex-1 px-3.5 py-2 rounded-md bg-well border border-rule text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                  data-testid="input-book-cover"
                />
                {coverUrl.trim().length > 0 && (
                  <div className="w-10 h-14 shrink-0 rounded-md overflow-hidden border border-rule bg-shelf flex items-center justify-center text-ink-muted">
                    <img
                      src={coverUrl}
                      alt="Vista previa"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                      data-testid="cover-preview-image"
                    />
                  </div>
                )}
              </div>
              <p className="text-[11px] text-ink-muted">
                Las URLs externas de portada se descargarán y guardarán localmente en BookLog.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-rule">
              <button
                type="button"
                onClick={onClose}
                disabled={mutation.isPending}
                className="px-4 py-2 text-xs font-semibold rounded-md text-ink hover:text-ink hover:bg-shelf transition-colors disabled:opacity-50"
                data-testid="cancel-button"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={mutation.isPending}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-md text-accent-ink bg-accent hover:bg-accent-strong transition-colors shadow-sm disabled:opacity-50"
                data-testid="submit-book-button"
              >
                {mutation.isPending && (
                  <div className="w-3.5 h-3.5 border-2 border-accent-ink border-t-transparent rounded-full animate-spin" />
                )}
                <span>{mutation.isPending ? 'Guardando...' : 'Guardar Libro'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

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

    if (hasErrors) {
      return
    }

    setGeneralError(null)
    mutation.mutate()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs overflow-y-auto"
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
        className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-100 flex flex-col gap-4 my-8"
        onClick={(e) => e.stopPropagation()}
        data-testid="add-book-modal"
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 shadow-xs">
              <BookPlus className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="add-book-modal-title"
                className="text-lg font-bold tracking-tight text-slate-100"
                data-testid="modal-title"
              >
                Agregar Libro
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Busca en Google Books o ingresa los datos manualmente
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            aria-label="Cerrar modal"
            data-testid="close-modal-button"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('search')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'search'
                ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
            data-testid="tab-search"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Buscar en Google</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'manual'
                ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
            data-testid="tab-manual"
          >
            <PenLine className="w-3.5 h-3.5" />
            <span>Carga manual</span>
          </button>
        </div>

        {/* Modular Search Slot (Feature #10 compatibility) */}
        {renderSearchSlot && (
          <div className="search-slot pb-2 border-b border-slate-800" data-testid="search-slot">
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
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Buscar por título, autor o ISBN (mín. 3 letras)..."
                className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                data-testid="search-books-input"
              />
            </div>
            <button
              type="button"
              onClick={handleSearchClick}
              disabled={isSearching || searchQuery.trim().length < 3}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-40 disabled:hover:bg-indigo-600 shadow-sm"
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
              className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs"
              data-testid="search-error-banner"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{searchError}</span>
            </div>
          )}

          {/* Loading Indicator */}
          {isSearching && (
            <div
              className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2"
              data-testid="search-loading"
            >
              <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
              <span className="text-xs">Buscando libros en Google Books...</span>
            </div>
          )}

          {/* Less than 3 chars friendly message */}
          {!isSearching && searchQuery.trim().length < 3 && (
            <div
              className="flex flex-col items-center justify-center py-10 text-slate-500 text-center gap-2"
              data-testid="search-min-chars-message"
            >
              <Search className="w-8 h-8 text-slate-600 stroke-[1.5]" />
              <p className="text-xs">Ingresa al menos 3 caracteres para buscar libros.</p>
            </div>
          )}

          {/* No results message */}
          {!isSearching &&
            searchQuery.trim().length >= 3 &&
            hasSearched &&
            searchResults.length === 0 && (
              <div
                className="flex flex-col items-center justify-center py-10 text-slate-400 text-center gap-2"
                data-testid="search-no-results"
              >
                <AlertCircle className="w-8 h-8 text-slate-500 stroke-[1.5]" />
                <p className="text-xs font-medium text-slate-300">
                  No se encontraron libros para &ldquo;{lastSearchedQuery}&rdquo;
                </p>
                <p className="text-[11px] text-slate-500">
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
                  className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 hover:border-indigo-500/50 hover:bg-slate-800/50 cursor-pointer transition-all group"
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
                  <div className="w-12 h-16 shrink-0 rounded-lg overflow-hidden border border-slate-800 bg-slate-800 flex items-center justify-center text-slate-500">
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
                      <BookOpen className="w-5 h-5 text-slate-600" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-slate-200 group-hover:text-indigo-300 line-clamp-1 transition-colors">
                      {result.title}
                    </h4>
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      {result.authors.length > 0 ? result.authors.join(', ') : 'Autor desconocido'}
                    </p>

                    <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500">
                      {result.publishedDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          <span>{result.publishedDate}</span>
                        </span>
                      )}
                      {result.pageCount && (
                        <span className="flex items-center gap-1">
                          <BookOpen className="w-3 h-3 text-slate-500" />
                          <span>{result.pageCount} págs.</span>
                        </span>
                      )}
                      {result.isbn && (
                        <span className="truncate max-w-[130px] font-mono text-[10px] bg-slate-800/80 px-1.5 py-0.5 rounded text-slate-400">
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
          <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs text-slate-500">
            <span>Haz clic en un libro para autocompletar el formulario</span>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
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
              className="flex items-center justify-between p-3 rounded-xl bg-indigo-950/40 border border-indigo-800/60 text-indigo-300 text-xs"
              data-testid="prefill-notice"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>
                  Datos autocompletados desde Google Books. Revisa los datos antes de guardar.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAutoFilledNotice(false)}
                className="text-indigo-400 hover:text-indigo-200 transition-colors"
                aria-label="Cerrar notificación"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Error Alert */}
          {(generalError || mutation.error) && (
            <div
              className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs"
              data-testid="form-error-banner"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{generalError || mutation.error?.message}</span>
            </div>
          )}

          {/* Manual Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="book-title" className="text-xs font-semibold text-slate-300">
                Título <span className="text-rose-400">*</span>
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
                className={`w-full px-3.5 py-2 rounded-xl bg-slate-950/60 border text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-all ${
                  titleError
                    ? 'border-rose-500 focus:ring-rose-500/30'
                    : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20'
                }`}
                data-testid="input-book-title"
                required
              />
              {titleError && (
                <p className="text-xs text-rose-400" data-testid="title-error">
                  {titleError}
                </p>
              )}
            </div>

            {/* Authors */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="book-authors" className="text-xs font-semibold text-slate-300">
                Autor(es){' '}
                <span className="text-slate-400 text-xs font-normal">(separados por coma)</span>
              </label>
              <input
                id="book-authors"
                type="text"
                value={authors}
                onChange={(e) => setAuthors(e.target.value)}
                placeholder="Ej. Gabriel García Márquez, Mario Vargas Llosa"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                data-testid="input-book-authors"
              />
              <p className="text-[11px] text-slate-400">
                Si son varios autores, puedes escribirlos separados por comas.
              </p>
            </div>

            {/* Pages and ISBN */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="book-pages" className="text-xs font-semibold text-slate-300">
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
                  className={`w-full px-3.5 py-2 rounded-xl bg-slate-950/60 border text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-all ${
                    pageCountError
                      ? 'border-rose-500 focus:ring-rose-500/30'
                      : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20'
                  }`}
                  data-testid="input-book-pages"
                />
                {pageCountError && (
                  <p className="text-xs text-rose-400" data-testid="pages-error">
                    {pageCountError}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="book-isbn" className="text-xs font-semibold text-slate-300">
                  ISBN
                </label>
                <input
                  id="book-isbn"
                  type="text"
                  value={isbn}
                  onChange={(e) => setIsbn(e.target.value)}
                  placeholder="Ej. 9780307474728"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  data-testid="input-book-isbn"
                />
              </div>
            </div>

            {/* Initial Status */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="book-status" className="text-xs font-semibold text-slate-300">
                Estado inicial
              </label>
              <select
                id="book-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as BookStatus)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                data-testid="select-book-status"
              >
                <option value={BookStatus.TO_READ}>Por leer</option>
                <option value={BookStatus.READING}>Leyendo</option>
                <option value={BookStatus.PAUSED}>Pausado</option>
                <option value={BookStatus.FINISHED}>Terminado</option>
                <option value={BookStatus.ABANDONED}>Abandonado</option>
              </select>
            </div>

            {/* Cover URL */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="book-cover" className="text-xs font-semibold text-slate-300">
                Portada (URL o ruta opcional)
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="book-cover"
                  type="text"
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  placeholder="https://ejemplo.com/portada.jpg"
                  className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  data-testid="input-book-cover"
                />
                {coverUrl.trim().length > 0 && (
                  <div className="w-10 h-14 shrink-0 rounded-lg overflow-hidden border border-slate-700 bg-slate-800 flex items-center justify-center text-slate-400">
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
              <p className="text-[11px] text-slate-400">
                Las URLs externas de portada se descargarán y guardarán localmente en BookLog.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                disabled={mutation.isPending}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-300 hover:text-slate-100 hover:bg-slate-800 transition-colors disabled:opacity-50"
                data-testid="cancel-button"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={mutation.isPending}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-sm disabled:opacity-50"
                data-testid="submit-book-button"
              >
                {mutation.isPending && (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
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

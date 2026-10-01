import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  BookOpen,
  Star,
  Trash2,
  Plus,
  X,
  AlertCircle,
  Check,
  Loader2,
  Sparkles,
  Calendar
} from 'lucide-react'
import { BookStatus } from '../../../shared/domain/entities/BookStatus.js'
import type { BookPrimitives, NotePrimitives } from '../../../shared/infrastructure/ipc/contracts.js'
import { bookService } from '../services/bookService.js'
import { noteService } from '../services/noteService.js'
import { resolveCoverUrl } from '../services/coverService.js'

export interface BookDetailPageProps {
  bookId: number
  onBack: () => void
}

const STATUS_CONFIG: Record<BookStatus, { label: string; badgeClass: string }> = {
  [BookStatus.TO_READ]: {
    label: 'Por leer',
    badgeClass: 'bg-sky-500/10 text-sky-400 border-sky-500/30'
  },
  [BookStatus.READING]: {
    label: 'Leyendo',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
  },
  [BookStatus.PAUSED]: {
    label: 'Pausado',
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30'
  },
  [BookStatus.FINISHED]: {
    label: 'Terminado',
    badgeClass: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
  },
  [BookStatus.ABANDONED]: {
    label: 'Abandonado',
    badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/30'
  }
}

export function BookDetailPage({ bookId, onBack }: BookDetailPageProps): JSX.Element {
  const queryClient = useQueryClient()

  // Local state for image error handling
  const [imageError, setImageError] = useState(false)

  // Local state for progress editing
  const [currentPageInput, setCurrentPageInput] = useState<number | ''>(0)
  const [percentageInput, setPercentageInput] = useState<number | ''>(0)
  const [isProgressDirty, setIsProgressDirty] = useState(false)
  const [progressSuccessNotice, setProgressSuccessNotice] = useState(false)
  const [progressErrorMessage, setProgressErrorMessage] = useState<string | null>(null)

  // Local state for rating hover
  const [hoveredRating, setHoveredRating] = useState<number | null>(null)

  // Modals state
  const [isAddNoteModalOpen, setIsAddNoteModalOpen] = useState(false)
  const [newNoteContent, setNewNoteContent] = useState('')
  const [newNoteError, setNewNoteError] = useState<string | null>(null)

  const [isDeleteBookModalOpen, setIsDeleteBookModalOpen] = useState(false)

  // Book Query
  const {
    data: book,
    isLoading: isBookLoading,
    isError: isBookError,
    error: bookError,
    refetch: refetchBook
  } = useQuery<BookPrimitives, Error>({
    queryKey: ['book', bookId],
    queryFn: async () => {
      const res = await bookService.getById(bookId)
      if (!res.success) {
        throw new Error(res.error || 'No se pudo cargar el libro')
      }
      return res.data
    }
  })

  // Notes Query
  const {
    data: notes,
    isLoading: isNotesLoading,
    isError: isNotesError,
    error: notesError
  } = useQuery<NotePrimitives[], Error>({
    queryKey: ['notes', bookId],
    queryFn: async () => {
      const res = await noteService.getByBook(bookId)
      if (!res.success) {
        throw new Error(res.error || 'No se pudieron cargar las notas')
      }
      return res.data
    }
  })

  // Sync progress inputs with book query data
  useEffect(() => {
    if (book) {
      setCurrentPageInput(book.currentPage ?? 0)
      setPercentageInput(book.progressPercentage ?? 0)
      setIsProgressDirty(false)
      setImageError(false)
    }
  }, [book])

  // Mutation: Update Status
  const statusMutation = useMutation({
    mutationFn: async (newStatus: BookStatus) => {
      const res = await bookService.updateStatus({ id: bookId, status: newStatus })
      if (!res.success) {
        throw new Error(res.error || 'Error al actualizar el estado')
      }
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book', bookId] })
      queryClient.invalidateQueries({ queryKey: ['books'] })
    }
  })

  // Mutation: Rate Book
  const rateMutation = useMutation({
    mutationFn: async (rating: number | null) => {
      const res = await bookService.rate({ id: bookId, rating })
      if (!res.success) {
        throw new Error(res.error || 'Error al actualizar la calificación')
      }
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book', bookId] })
      queryClient.invalidateQueries({ queryKey: ['books'] })
    }
  })

  // Mutation: Update Progress
  const progressMutation = useMutation({
    mutationFn: async ({ page, percentage }: { page?: number; percentage?: number }) => {
      const res = await bookService.updateProgress({ id: bookId, page, percentage })
      if (!res.success) {
        throw new Error(res.error || 'Error al actualizar el avance de lectura')
      }
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book', bookId] })
      queryClient.invalidateQueries({ queryKey: ['books'] })
      setIsProgressDirty(false)
      setProgressErrorMessage(null)
      setProgressSuccessNotice(true)
      setTimeout(() => setProgressSuccessNotice(false), 2500)
    },
    onError: (err: Error) => {
      setProgressErrorMessage(err.message)
    }
  })

  // Mutation: Delete Book
  const deleteBookMutation = useMutation({
    mutationFn: async () => {
      const res = await bookService.delete(bookId)
      if (!res.success) {
        throw new Error(res.error || 'Error al eliminar el libro')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['books'] })
      queryClient.removeQueries({ queryKey: ['book', bookId] })
      queryClient.removeQueries({ queryKey: ['notes', bookId] })
      setIsDeleteBookModalOpen(false)
      onBack()
    }
  })

  // Mutation: Add Note
  const addNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await noteService.create({ bookId, content })
      if (!res.success) {
        throw new Error(res.error || 'Error al agregar la nota')
      }
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', bookId] })
      setNewNoteContent('')
      setNewNoteError(null)
      setIsAddNoteModalOpen(false)
    },
    onError: (err: Error) => {
      setNewNoteError(err.message)
    }
  })

  // Mutation: Delete Note
  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: number) => {
      const res = await noteService.delete(noteId)
      if (!res.success) {
        throw new Error(res.error || 'Error al eliminar la nota')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', bookId] })
    }
  })

  // Progress input handlers
  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const rawValue = e.target.value
    setProgressErrorMessage(null)
    if (rawValue === '') {
      setCurrentPageInput('')
      setIsProgressDirty(true)
      return
    }

    const page = parseInt(rawValue, 10)
    if (isNaN(page)) return

    const pageCount = book?.pageCount
    let clampedPage = Math.max(0, page)
    if (pageCount && pageCount > 0) {
      clampedPage = Math.min(pageCount, clampedPage)
      const computedPct = Math.round((clampedPage / pageCount) * 100)
      setPercentageInput(computedPct)
    }
    setCurrentPageInput(clampedPage)
    setIsProgressDirty(true)
  }

  const handlePercentageInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const rawValue = e.target.value
    setProgressErrorMessage(null)
    if (rawValue === '') {
      setPercentageInput('')
      setIsProgressDirty(true)
      return
    }

    const pct = parseInt(rawValue, 10)
    if (isNaN(pct)) return

    const clampedPct = Math.min(100, Math.max(0, pct))
    setPercentageInput(clampedPct)

    const pageCount = book?.pageCount
    if (pageCount && pageCount > 0) {
      const computedPage = Math.round((clampedPct / 100) * pageCount)
      setCurrentPageInput(computedPage)
    }
    setIsProgressDirty(true)
  }

  const handleSaveProgress = (): void => {
    if (currentPageInput !== '') {
      progressMutation.mutate({ page: Number(currentPageInput) })
    } else if (percentageInput !== '') {
      progressMutation.mutate({ percentage: Number(percentageInput) })
    }
  }

  // Handle Note Submission
  const handleCreateNoteSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    if (!newNoteContent.trim()) {
      setNewNoteError('El contenido de la nota no puede estar vacío.')
      return
    }
    addNoteMutation.mutate(newNoteContent.trim())
  }

  // Cover image resolution
  const coverUrl = resolveCoverUrl(book?.coverPath, book?.coverUrl ?? '')
  const hasCover = Boolean(coverUrl && !imageError)

  const currentRating = book?.rating ?? 0
  const activeRatingDisplay = hoveredRating !== null ? hoveredRating : currentRating
  const progressPercentValue = Math.min(100, Math.max(0, Number(percentageInput) || 0))

  // Sort notes newest first
  const sortedNotes = notes
    ? [...notes].sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return timeB - timeA
      })
    : []

  if (isBookLoading) {
    return (
      <div
        className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col items-center justify-center min-h-[50vh] text-slate-400 gap-3"
        data-testid="detail-loading"
      >
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <p className="text-sm font-medium">Cargando información del libro...</p>
      </div>
    )
  }

  if (isBookError || !book) {
    return (
      <div
        className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12"
        data-testid="detail-error"
      >
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-rose-900/30 bg-rose-950/10 p-8">
          <div className="w-12 h-12 rounded-full bg-rose-950/50 text-rose-400 flex items-center justify-center mb-3 border border-rose-800/40">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-200">No se pudo cargar el libro</h2>
          <p className="text-sm text-slate-400 max-w-md mt-1 mb-6">
            {bookError?.message || 'El libro solicitado no existe o fue eliminado.'}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => refetchBook()}
              className="px-4 py-2 text-xs font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-sm"
            >
              Reintentar
            </button>
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2 text-xs font-medium rounded-lg text-slate-300 bg-slate-800 hover:bg-slate-700/80 border border-slate-700/60 transition-colors"
              data-testid="back-button"
            >
              Volver a la Biblioteca
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="book-detail-page">
      {/* Top Navigation & Action Bar */}
      <nav className="flex items-center justify-between gap-4 pb-6 mb-8 border-b border-slate-800">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 rounded-lg transition-colors shadow-xs"
          data-testid="back-button"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver a la Biblioteca</span>
        </button>

        <button
          type="button"
          onClick={() => setIsDeleteBookModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-400 hover:text-rose-300 bg-rose-950/20 hover:bg-rose-950/40 border border-rose-800/30 rounded-lg transition-colors shadow-xs"
          data-testid="delete-book-button"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Eliminar libro</span>
        </button>
      </nav>

      {/* Main Book Detail Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
        {/* Cover Column */}
        <div className="lg:col-span-4 xl:col-span-3 flex flex-col items-center">
          <div className="w-full max-w-[260px] aspect-[2/3] rounded-2xl overflow-hidden bg-slate-800/80 border border-slate-700/80 shadow-xl flex items-center justify-center relative">
            {hasCover ? (
              <img
                src={coverUrl}
                alt={book.title}
                onError={() => setImageError(true)}
                className="w-full h-full object-cover"
                data-testid="detail-cover-image"
              />
            ) : (
              <div
                className="w-full h-full flex flex-col items-center justify-center text-slate-500 bg-slate-850 p-6 text-center"
                data-testid="detail-cover-placeholder"
              >
                <BookOpen className="w-16 h-16 stroke-[1.25] mb-2" />
                <span className="text-xs text-slate-400">Sin portada disponible</span>
              </div>
            )}
          </div>
        </div>

        {/* Info & Controls Column */}
        <div className="lg:col-span-8 xl:col-span-9 flex flex-col gap-6">
          <div>
            <h1
              className="text-3xl sm:text-4xl font-extrabold text-slate-100 tracking-tight leading-tight"
              data-testid="detail-title"
            >
              {book.title}
            </h1>
            <p
              className="text-lg sm:text-xl text-slate-300 font-medium mt-2"
              data-testid="detail-authors"
            >
              {book.authors}
            </p>

            {/* Badges / Metadata */}
            <div className="flex flex-wrap items-center gap-3 mt-4 text-xs text-slate-400">
              {book.pageCount !== null && book.pageCount !== undefined && (
                <div
                  className="px-3 py-1 rounded-full bg-slate-800/90 border border-slate-700/60 font-mono text-slate-300"
                  data-testid="detail-page-count"
                >
                  {book.pageCount} páginas
                </div>
              )}
              {book.isbn && (
                <div
                  className="px-3 py-1 rounded-full bg-slate-800/90 border border-slate-700/60 font-mono text-slate-300"
                  data-testid="detail-isbn"
                >
                  ISBN: {book.isbn}
                </div>
              )}
            </div>
          </div>

          {/* Status & Rating Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 rounded-xl bg-slate-800/60 border border-slate-700/60 backdrop-blur-xs">
            {/* Status Selector */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="book-status-select"
                className="text-xs font-semibold uppercase tracking-wider text-slate-400"
              >
                Estado de lectura
              </label>
              <div className="flex items-center gap-2">
                <select
                  id="book-status-select"
                  value={book.status}
                  onChange={(e) => statusMutation.mutate(e.target.value as BookStatus)}
                  disabled={statusMutation.isPending}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors cursor-pointer"
                  data-testid="detail-status-select"
                >
                  {Object.entries(STATUS_CONFIG).map(([value, conf]) => (
                    <option key={value} value={value}>
                      {conf.label}
                    </option>
                  ))}
                </select>
                {statusMutation.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />
                )}
              </div>
            </div>

            {/* Interactive Rating */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Calificación
                </label>
                {currentRating > 0 && (
                  <button
                    type="button"
                    onClick={() => rateMutation.mutate(null)}
                    disabled={rateMutation.isPending}
                    className="text-[11px] text-slate-400 hover:text-rose-400 transition-colors"
                    data-testid="detail-clear-rating-button"
                  >
                    Quitar
                  </button>
                )}
              </div>
              <div
                className="flex items-center gap-1.5 py-1"
                data-testid="detail-rating"
                onMouseLeave={() => setHoveredRating(null)}
              >
                {[1, 2, 3, 4, 5].map((starValue) => {
                  const isFilled = activeRatingDisplay >= starValue
                  return (
                    <button
                      key={starValue}
                      type="button"
                      onClick={() => {
                        const newRating = currentRating === starValue ? null : starValue
                        rateMutation.mutate(newRating)
                      }}
                      onMouseEnter={() => setHoveredRating(starValue)}
                      disabled={rateMutation.isPending}
                      className="p-1 rounded hover:bg-slate-700/50 transition-colors text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                      aria-label={`Calificar con ${starValue} estrella${starValue > 1 ? 's' : ''}`}
                      data-testid={`star-button-${starValue}`}
                    >
                      <Star
                        className={`w-6 h-6 transition-transform hover:scale-110 ${
                          isFilled
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-slate-600 fill-transparent'
                        }`}
                        data-testid={`star-${starValue}${isFilled ? '-filled' : ''}`}
                      />
                    </button>
                  )
                })}
                {rateMutation.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin text-amber-400 shrink-0 ml-2" />
                )}
              </div>
            </div>
          </div>

          {/* Reading Progress Section (Direct Inline Editing) */}
          <div className="p-5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Avance de Lectura
              </span>
              <span className="text-xs font-mono font-medium text-indigo-400">
                {progressPercentValue}% completado
              </span>
            </div>

            {/* Visual Progress Bar */}
            <div
              className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-700/50"
              data-testid="detail-progress-bar-container"
            >
              <div
                className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${progressPercentValue}%` }}
                data-testid="detail-progress-bar"
              />
            </div>

            {/* Inline Direct Numeric Inputs */}
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <div className="flex items-center gap-2">
                <label
                  htmlFor="progress-page-input"
                  className="text-xs text-slate-400 font-medium"
                >
                  Página:
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    id="progress-page-input"
                    type="number"
                    min="0"
                    max={book.pageCount ?? undefined}
                    value={currentPageInput}
                    onChange={handlePageInputChange}
                    className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-sm text-slate-100 font-mono text-center focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    data-testid="detail-progress-page-input"
                  />
                  {book.pageCount !== null && book.pageCount !== undefined && (
                    <span className="text-xs text-slate-400 font-mono">
                      / {book.pageCount}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label
                  htmlFor="progress-percentage-input"
                  className="text-xs text-slate-400 font-medium"
                >
                  Porcentaje:
                </label>
                <div className="flex items-center gap-1">
                  <input
                    id="progress-percentage-input"
                    type="number"
                    min="0"
                    max="100"
                    value={percentageInput}
                    onChange={handlePercentageInputChange}
                    className="w-18 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-sm text-slate-100 font-mono text-center focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    data-testid="detail-progress-percentage-input"
                  />
                  <span className="text-xs text-slate-400 font-mono">%</span>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={handleSaveProgress}
                  disabled={progressMutation.isPending || !isProgressDirty}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1 text-xs font-semibold rounded-lg transition-all shadow-xs ${
                    isProgressDirty
                      ? 'text-white bg-indigo-600 hover:bg-indigo-500 cursor-pointer ring-1 ring-indigo-400/40'
                      : 'text-slate-400 bg-slate-800/80 border border-slate-700/60 cursor-not-allowed opacity-60'
                  }`}
                  data-testid="detail-save-progress-button"
                >
                  {progressMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>Guardar progreso</span>
                </button>

                {progressSuccessNotice && (
                  <span
                    className="text-xs font-medium text-emerald-400 flex items-center gap-1 animate-fade-in"
                    data-testid="progress-success-notice"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Guardado
                  </span>
                )}
              </div>
            </div>

            {progressErrorMessage && (
              <p
                className="text-xs text-rose-400 flex items-center gap-1"
                data-testid="progress-error-message"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                {progressErrorMessage}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Notes and Ideas Section */}
      <section className="mt-8 pt-8 border-t border-slate-800">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              <span>Notas e Ideas</span>
            </h2>
            {notes && !isNotesLoading && (
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60"
                data-testid="notes-count-badge"
              >
                {notes.length}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setNewNoteContent('')
              setNewNoteError(null)
              setIsAddNoteModalOpen(true)
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-500 shadow-sm transition-colors"
            data-testid="add-note-button"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Nueva Idea</span>
          </button>
        </div>

        {/* Notes Content */}
        {isNotesLoading && (
          <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
            <span className="text-xs">Cargando notas...</span>
          </div>
        )}

        {isNotesError && (
          <div className="p-4 rounded-xl border border-rose-900/40 bg-rose-950/10 text-rose-400 text-xs">
            {notesError?.message || 'Error al cargar las notas'}
          </div>
        )}

        {!isNotesLoading && !isNotesError && (
          <>
            {sortedNotes.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-14 px-4 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 text-slate-400"
                data-testid="no-notes-message"
              >
                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center mb-3 text-slate-500">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold text-slate-300">
                  Aún no tienes notas para este libro
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Captura citas memorables, reflexiones, aprendizajes o ideas clave mientras lees.
                </p>
                <button
                  type="button"
                  onClick={() => setIsAddNoteModalOpen(true)}
                  className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-indigo-400 bg-indigo-950/30 hover:bg-indigo-950/60 border border-indigo-800/40 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Crear primera nota</span>
                </button>
              </div>
            ) : (
              <div
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                data-testid="notes-list"
              >
                {sortedNotes.map((note) => {
                  const noteId = note.id
                  const formattedDate = note.createdAt
                    ? new Date(note.createdAt).toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : ''

                  return (
                    <article
                      key={noteId ?? Math.random()}
                      className="group flex flex-col justify-between p-4 rounded-xl bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-600 transition-all shadow-sm"
                      data-testid="note-item"
                    >
                      <p
                        className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed break-words"
                        data-testid="note-content"
                      >
                        {note.content}
                      </p>

                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-700/40 text-xs text-slate-400">
                        <span
                          className="flex items-center gap-1 text-[11px] text-slate-400"
                          data-testid="note-date"
                        >
                          <Calendar className="w-3 h-3" />
                          {formattedDate}
                        </span>

                        {noteId !== undefined && (
                          <button
                            type="button"
                            onClick={() => deleteNoteMutation.mutate(noteId)}
                            disabled={deleteNoteMutation.isPending}
                            className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-rose-950/30 transition-colors opacity-80 group-hover:opacity-100"
                            title="Eliminar nota"
                            data-testid={`delete-note-button-${noteId}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </>
        )}
      </section>

      {/* Modal: Agregar Nueva Nota / Idea */}
      {isAddNoteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fade-in"
          role="dialog"
          aria-modal="true"
          data-testid="add-note-modal"
        >
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-semibold text-slate-100">
                  Nueva Idea / Reflexión
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddNoteModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                data-testid="cancel-note-button"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNoteSubmit} className="flex flex-col gap-4">
              <div>
                <label
                  htmlFor="new-note-textarea"
                  className="block text-xs font-semibold text-slate-300 mb-1.5"
                >
                  Contenido de la nota <span className="text-rose-400">*</span>
                </label>
                <textarea
                  id="new-note-textarea"
                  rows={4}
                  value={newNoteContent}
                  onChange={(e) => {
                    setNewNoteContent(e.target.value)
                    if (newNoteError) setNewNoteError(null)
                  }}
                  autoFocus
                  placeholder="Escribe tu reflexión, frase destacada o aprendizaje sobre esta lectura..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-y"
                  data-testid="note-content-input"
                />
                {newNoteError && (
                  <p
                    className="text-xs text-rose-400 mt-1 flex items-center gap-1"
                    data-testid="note-content-error"
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    {newNoteError}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddNoteModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-medium rounded-lg text-slate-300 bg-slate-800 hover:bg-slate-750 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={addNoteMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-500 shadow-sm transition-colors disabled:opacity-50"
                  data-testid="submit-note-button"
                >
                  {addNoteMutation.isPending && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  <span>Guardar Nota</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirmar Eliminación del Libro */}
      {isDeleteBookModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fade-in"
          role="dialog"
          aria-modal="true"
          data-testid="delete-book-modal"
        >
          <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-950/40 text-rose-400 border border-rose-800/40 shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">
                  ¿Eliminar este libro?
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  ¿Estás seguro de que deseas eliminar este libro? Se eliminarán también todas sus notas.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800 mt-2">
              <button
                type="button"
                onClick={() => setIsDeleteBookModalOpen(false)}
                disabled={deleteBookMutation.isPending}
                className="px-3.5 py-1.5 text-xs font-medium rounded-lg text-slate-300 bg-slate-800 hover:bg-slate-750 transition-colors"
                data-testid="cancel-delete-book-button"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => deleteBookMutation.mutate()}
                disabled={deleteBookMutation.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg text-white bg-rose-600 hover:bg-rose-500 shadow-sm transition-colors disabled:opacity-50"
                data-testid="confirm-delete-book-button"
              >
                {deleteBookMutation.isPending && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                <span>Eliminar libro</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

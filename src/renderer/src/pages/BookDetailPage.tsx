import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  BookOpen,
  Star,
  Trash2,
  Plus,
  AlertCircle,
  Check,
  Loader2,
  Sparkles,
  Calendar,
  TrendingUp
} from 'lucide-react'
import { BookStatus } from '../../../shared/domain/entities/BookStatus.js'
import type { BookPrimitives, NotePrimitives } from '../../../shared/infrastructure/ipc/contracts.js'
import { bookService } from '../services/bookService.js'
import { noteService } from '../services/noteService.js'
import { useCoverSource } from '../hooks/useCoverSource.js'
import { AddNoteModal, UpdateProgressModal } from '../components/index.js'
import { STATUS_CONFIG, STATUS_ORDER } from '../components/statusConfig.js'
import { FinishedDateField } from '../components/FinishedDateField.js'
import {
  defaultFinishedDateInput,
  formatFinishedDate,
  validateFinishedDateInput
} from '../components/finishedDate.js'


export interface BookDetailPageProps {
  bookId: number
  onBack: () => void
}

export function BookDetailPage({ bookId, onBack }: BookDetailPageProps): JSX.Element {
  const queryClient = useQueryClient()

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
  const [isUpdateProgressModalOpen, setIsUpdateProgressModalOpen] = useState(false)
  const [isDeleteBookModalOpen, setIsDeleteBookModalOpen] = useState(false)

  // Fecha de terminado: confirmación al pasar a FINISHED y edición de la fecha existente
  const [isConfirmingFinish, setIsConfirmingFinish] = useState(false)
  const [isEditingFinishedDate, setIsEditingFinishedDate] = useState(false)
  const [finishedDateInput, setFinishedDateInput] = useState(() => defaultFinishedDateInput())
  const [finishedDateError, setFinishedDateError] = useState<string | null>(null)

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
    }
  }, [book])

  // Mutation: Update Status
  const statusMutation = useMutation({
    mutationFn: async ({ status, finishedAt }: { status: BookStatus; finishedAt?: string }) => {
      const res = await bookService.updateStatus({
        id: bookId,
        status,
        ...(finishedAt !== undefined ? { finishedAt } : {})
      })
      if (!res.success) {
        throw new Error(res.error || 'Error al actualizar el estado')
      }
      return res.data
    },
    onSuccess: () => {
      setIsConfirmingFinish(false)
      setFinishedDateError(null)
      queryClient.invalidateQueries({ queryKey: ['book', bookId] })
      queryClient.invalidateQueries({ queryKey: ['books'] })
    },
    onError: (err: Error) => {
      setFinishedDateError(err.message)
    }
  })

  // Mutation: Edit finished date
  const finishedDateMutation = useMutation({
    mutationFn: async (finishedAt: string) => {
      const res = await bookService.setFinishedDate({ id: bookId, finishedAt })
      if (!res.success) {
        throw new Error(res.error || 'Error al actualizar la fecha de terminado')
      }
      return res.data
    },
    onSuccess: () => {
      setIsEditingFinishedDate(false)
      setFinishedDateError(null)
      queryClient.invalidateQueries({ queryKey: ['book', bookId] })
      queryClient.invalidateQueries({ queryKey: ['books'] })
    },
    onError: (err: Error) => {
      setFinishedDateError(err.message)
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

  const handleStatusChange = (newStatus: BookStatus): void => {
    setFinishedDateError(null)
    setIsEditingFinishedDate(false)
    if (newStatus === BookStatus.FINISHED && book?.status !== BookStatus.FINISHED) {
      // Pasar a terminado pide la fecha (hoy precargado) antes de guardar.
      setFinishedDateInput(defaultFinishedDateInput())
      setIsConfirmingFinish(true)
      return
    }
    setIsConfirmingFinish(false)
    statusMutation.mutate({ status: newStatus })
  }

  const handleConfirmFinish = (): void => {
    const dateError = validateFinishedDateInput(finishedDateInput)
    if (dateError) {
      setFinishedDateError(dateError)
      return
    }
    statusMutation.mutate({ status: BookStatus.FINISHED, finishedAt: finishedDateInput })
  }

  const handleStartEditFinishedDate = (): void => {
    setFinishedDateInput(defaultFinishedDateInput(book?.finishedAt))
    setFinishedDateError(null)
    setIsEditingFinishedDate(true)
  }

  const handleSaveFinishedDate = (): void => {
    const dateError = validateFinishedDateInput(finishedDateInput)
    if (dateError) {
      setFinishedDateError(dateError)
      return
    }
    finishedDateMutation.mutate(finishedDateInput)
  }

  const handleSaveProgress = (): void => {
    if (currentPageInput !== '') {
      progressMutation.mutate({ page: Number(currentPageInput) })
    } else if (percentageInput !== '') {
      progressMutation.mutate({ percentage: Number(percentageInput) })
    }
  }


  // Cover image resolution
  const cover = useCoverSource(book?.coverPath, book?.coverUrl)

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
        className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col items-center justify-center min-h-[50vh] text-ink-muted gap-3"
        data-testid="detail-loading"
      >
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
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
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-md border border-danger/30 bg-danger/10 p-8">
          <div className="w-12 h-12 rounded-full bg-danger/10 text-danger flex items-center justify-center mb-3 border border-danger/30">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-ink">No se pudo cargar el libro</h2>
          <p className="text-sm text-ink-muted max-w-md mt-1 mb-6">
            {bookError?.message || 'El libro solicitado no existe o fue eliminado.'}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => refetchBook()}
              className="px-4 py-2 text-xs font-semibold rounded-md text-accent-ink bg-accent hover:bg-accent-strong transition-colors shadow-sm"
            >
              Reintentar
            </button>
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2 text-xs font-medium rounded-md text-ink bg-shelf hover:bg-rule/80 border border-rule/60 transition-colors"
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
      <nav className="flex items-center justify-between gap-4 pb-6 mb-8 rule-double">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-ink hover:text-ink bg-shelf/80 hover:bg-shelf border border-rule/60 rounded-md transition-colors shadow-xs"
          data-testid="back-button"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver a la Biblioteca</span>
        </button>

        <button
          type="button"
          onClick={() => setIsDeleteBookModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-danger hover:text-danger bg-danger/10 hover:bg-danger/15 border border-danger/30 rounded-md transition-colors shadow-xs"
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
          <div className="w-full max-w-[260px] aspect-[2/3] rounded-md overflow-hidden bg-shelf border border-rule-strong shadow-md flex items-center justify-center relative">
            {cover.src ? (
              <img
                src={cover.src}
                alt={book.title}
                onError={cover.onError}
                className="w-full h-full object-cover"
                data-testid="detail-cover-image"
              />
            ) : (
              <div
                className="w-full h-full flex flex-col items-center justify-center text-ink-faint bg-card texture-paper p-6 text-center"
                data-testid="detail-cover-placeholder"
              >
                <BookOpen className="w-16 h-16 stroke-[1.25] mb-2" />
                <span className="text-xs text-ink-muted">Sin portada disponible</span>
              </div>
            )}
          </div>
        </div>

        {/* Info & Controls Column */}
        <div className="lg:col-span-8 xl:col-span-9 flex flex-col gap-6">
          <div>
            <h1
              className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight leading-tight"
              data-testid="detail-title"
            >
              {book.title}
            </h1>
            <p
              className="text-lg sm:text-xl text-ink-muted italic font-medium mt-2"
              data-testid="detail-authors"
            >
              {book.authors}
            </p>

            {/* Badges / Metadata */}
            <div className="flex flex-wrap items-center gap-3 mt-4 text-xs text-ink-muted">
              {book.pageCount !== null && book.pageCount !== undefined && (
                <div
                  className="px-3 py-1 rounded-full bg-shelf/90 border border-rule/60 font-mono text-ink"
                  data-testid="detail-page-count"
                >
                  {book.pageCount} páginas
                </div>
              )}
              {book.isbn && (
                <div
                  className="px-3 py-1 rounded-full bg-shelf/90 border border-rule/60 font-mono text-ink"
                  data-testid="detail-isbn"
                >
                  ISBN: {book.isbn}
                </div>
              )}
            </div>
          </div>

          {/* Status & Rating Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 rounded-md ficha">
            {/* Status Selector */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="book-status-select"
                className="text-xs font-semibold uppercase tracking-wider text-ink-muted"
              >
                Estado de lectura
              </label>
              <div className="flex items-center gap-2">
                <select
                  id="book-status-select"
                  value={isConfirmingFinish ? BookStatus.FINISHED : book.status}
                  onChange={(e) => handleStatusChange(e.target.value as BookStatus)}
                  disabled={statusMutation.isPending}
                  className="w-full bg-well border border-rule rounded-md px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/50 transition-colors cursor-pointer"
                  data-testid="detail-status-select"
                >
                  {STATUS_ORDER.map((value) => (
                    <option key={value} value={value}>
                      {STATUS_CONFIG[value].label}
                    </option>
                  ))}
                </select>
                {statusMutation.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin text-accent shrink-0" />
                )}
              </div>

              {isConfirmingFinish && (
                <div
                  className="mt-2 p-3 rounded-md bg-well/60 border border-rule flex flex-col gap-2.5"
                  data-testid="detail-confirm-finish"
                >
                  <FinishedDateField
                    id="detail-confirm-finished-date"
                    value={finishedDateInput}
                    onChange={(value) => {
                      setFinishedDateInput(value)
                      setFinishedDateError(null)
                    }}
                    error={finishedDateError}
                    label="¿Cuándo lo terminaste?"
                    testId="detail-confirm-finished-date-input"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsConfirmingFinish(false)
                        setFinishedDateError(null)
                      }}
                      className="px-3 py-1 text-xs font-medium rounded-md text-ink bg-shelf hover:bg-rule/60 transition-colors"
                      data-testid="detail-cancel-finish-button"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmFinish}
                      disabled={statusMutation.isPending}
                      className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md text-accent-ink bg-accent hover:bg-accent-strong transition-colors disabled:opacity-50"
                      data-testid="detail-confirm-finish-button"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Marcar como terminado</span>
                    </button>
                  </div>
                </div>
              )}

              {!isConfirmingFinish && book.status === BookStatus.FINISHED && (
                <div className="mt-2 flex flex-col gap-2" data-testid="detail-finished-date">
                  {isEditingFinishedDate ? (
                    <div className="p-3 rounded-md bg-well/60 border border-rule flex flex-col gap-2.5">
                      <FinishedDateField
                        id="detail-edit-finished-date"
                        value={finishedDateInput}
                        onChange={(value) => {
                          setFinishedDateInput(value)
                          setFinishedDateError(null)
                        }}
                        error={finishedDateError}
                        testId="detail-edit-finished-date-input"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingFinishedDate(false)
                            setFinishedDateError(null)
                          }}
                          className="px-3 py-1 text-xs font-medium rounded-md text-ink bg-shelf hover:bg-rule/60 transition-colors"
                          data-testid="detail-cancel-finished-date-button"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveFinishedDate}
                          disabled={finishedDateMutation.isPending}
                          className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md text-accent-ink bg-accent hover:bg-accent-strong transition-colors disabled:opacity-50"
                          data-testid="detail-save-finished-date-button"
                        >
                          {finishedDateMutation.isPending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          <span>Guardar fecha</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-ink-muted">
                      <Calendar className="w-3.5 h-3.5 text-status-finished shrink-0" />
                      <span>
                        Terminado el{' '}
                        <span
                          className="font-mono font-semibold text-ink"
                          data-testid="detail-finished-date-value"
                        >
                          {book.finishedAt ? formatFinishedDate(book.finishedAt) : 'sin fecha'}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={handleStartEditFinishedDate}
                        className="ml-auto text-xs font-medium text-accent hover:text-accent-strong transition-colors"
                        data-testid="detail-edit-finished-date-button"
                      >
                        Editar fecha
                      </button>
                    </div>
                  )}
                </div>
              )}

              {!isConfirmingFinish && !isEditingFinishedDate && finishedDateError && (
                <p className="text-xs text-danger mt-1" data-testid="detail-status-error">
                  {finishedDateError}
                </p>
              )}
            </div>

            {/* Interactive Rating */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Calificación
                </label>
                {currentRating > 0 && (
                  <button
                    type="button"
                    onClick={() => rateMutation.mutate(null)}
                    disabled={rateMutation.isPending}
                    className="text-[11px] text-ink-muted hover:text-danger transition-colors"
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
                      className="p-1 rounded hover:bg-rule/50 transition-colors text-ink-faint focus:outline-none focus:ring-2 focus:ring-accent/40"
                      aria-label={`Calificar con ${starValue} estrella${starValue > 1 ? 's' : ''}`}
                      data-testid={`star-button-${starValue}`}
                    >
                      <Star
                        className={`w-6 h-6 transition-transform hover:scale-110 ${
                          isFilled
                            ? 'text-star fill-star'
                            : 'text-ink-faint fill-transparent'
                        }`}
                        data-testid={`star-${starValue}${isFilled ? '-filled' : ''}`}
                      />
                    </button>
                  )
                })}
                {rateMutation.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin text-star shrink-0 ml-2" />
                )}
              </div>
            </div>
          </div>

          {/* Reading Progress Section (Direct Inline Editing) */}
          <div className="p-5 rounded-md ficha flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Avance de Lectura
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsUpdateProgressModalOpen(true)}
                  className="inline-flex items-center gap-1.5 text-xs text-accent hover:text-accent-strong font-medium transition-colors cursor-pointer"
                  data-testid="open-update-progress-modal-button"
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Actualizar progreso...</span>
                </button>
                <span className="text-xs font-mono font-medium text-accent">
                  {progressPercentValue}% completado
                </span>
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div
              className="w-full bg-well rounded-full h-3 overflow-hidden border border-rule/50"
              data-testid="detail-progress-bar-container"
            >
              <div
                className="bg-accent h-full rounded-full transition-all duration-300"
                style={{ width: `${progressPercentValue}%` }}
                data-testid="detail-progress-bar"
              />
            </div>

            {/* Inline Direct Numeric Inputs */}
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <div className="flex items-center gap-2">
                <label
                  htmlFor="progress-page-input"
                  className="text-xs text-ink-muted font-medium"
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
                    className="w-20 bg-well border border-rule rounded-md px-2.5 py-1 text-sm text-ink font-mono text-center focus:outline-none focus:ring-2 focus:ring-accent/50"
                    data-testid="detail-progress-page-input"
                  />
                  {book.pageCount !== null && book.pageCount !== undefined && (
                    <span className="text-xs text-ink-muted font-mono">
                      / {book.pageCount}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label
                  htmlFor="progress-percentage-input"
                  className="text-xs text-ink-muted font-medium"
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
                    className="w-18 bg-well border border-rule rounded-md px-2.5 py-1 text-sm text-ink font-mono text-center focus:outline-none focus:ring-2 focus:ring-accent/50"
                    data-testid="detail-progress-percentage-input"
                  />
                  <span className="text-xs text-ink-muted font-mono">%</span>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={handleSaveProgress}
                  disabled={progressMutation.isPending || !isProgressDirty}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1 text-xs font-semibold rounded-md transition-all shadow-xs ${
                    isProgressDirty
                      ? 'text-accent-ink bg-accent hover:bg-accent-strong cursor-pointer ring-1 ring-accent/40'
                      : 'text-ink-muted bg-shelf/80 border border-rule/60 cursor-not-allowed opacity-60'
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
                    className="text-xs font-medium text-success flex items-center gap-1 animate-fade-in"
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
                className="text-xs text-danger flex items-center gap-1"
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
      <section className="mt-8 pt-8 border-t-[3px] border-double border-rule-strong">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold text-ink flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-accent" />
              <span>Notas e Ideas</span>
            </h2>
            {notes && !isNotesLoading && (
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full bg-shelf text-ink-muted border border-rule/60"
                data-testid="notes-count-badge"
              >
                {notes.length}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsAddNoteModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md text-accent-ink bg-accent hover:bg-accent-strong shadow-sm transition-colors"
            data-testid="add-note-button"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Nueva Idea</span>
          </button>
        </div>

        {/* Notes Content */}
        {isNotesLoading && (
          <div className="flex items-center justify-center py-12 text-ink-muted gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-accent" />
            <span className="text-xs">Cargando notas...</span>
          </div>
        )}

        {isNotesError && (
          <div className="p-4 rounded-md border border-danger/30 bg-danger/10 text-danger text-xs">
            {notesError?.message || 'Error al cargar las notas'}
          </div>
        )}

        {!isNotesLoading && !isNotesError && (
          <>
            {sortedNotes.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-14 px-4 text-center rounded-md border border-2 border-dashed border-rule-strong/70 bg-card/50 texture-paper text-ink-muted"
                data-testid="no-notes-message"
              >
                <div className="w-10 h-10 rounded-full bg-shelf flex items-center justify-center mb-3 text-ink-faint">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold text-ink">
                  Aún no tienes notas para este libro
                </h3>
                <p className="text-xs text-ink-faint mt-1 max-w-sm">
                  Captura citas memorables, reflexiones, aprendizajes o ideas clave mientras lees.
                </p>
                <button
                  type="button"
                  onClick={() => setIsAddNoteModalOpen(true)}
                  className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md text-accent bg-accent/10 hover:bg-accent/15 border border-accent/40 transition-colors"
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
                      className="group flex flex-col justify-between p-4 rounded-md ficha hover:border-rule-strong transition-all"
                      data-testid="note-item"
                    >
                      <p
                        className="text-sm text-ink whitespace-pre-wrap leading-relaxed break-words"
                        data-testid="note-content"
                      >
                        {note.content}
                      </p>

                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-dashed border-rule text-xs text-ink-muted">
                        <span
                          className="flex items-center gap-1 text-[11px] text-ink-muted"
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
                            className="p-1 text-ink-muted hover:text-danger rounded hover:bg-danger/10 transition-colors opacity-80 group-hover:opacity-100"
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

      {/* Modal Reutilizable: Agregar Nueva Nota / Idea */}
      <AddNoteModal
        bookId={bookId}
        bookTitle={book.title}
        isOpen={isAddNoteModalOpen}
        onClose={() => setIsAddNoteModalOpen(false)}
      />

      {/* Modal Reutilizable: Actualizar Progreso de Lectura */}
      <UpdateProgressModal
        book={book}
        isOpen={isUpdateProgressModalOpen}
        onClose={() => setIsUpdateProgressModalOpen(false)}
      />

      {/* Modal: Confirmar Eliminación del Libro */}
      {isDeleteBookModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-backdrop/70 backdrop-blur-xs animate-fade-in"
          role="dialog"
          aria-modal="true"
          data-testid="delete-book-modal"
        >
          <div className="w-full max-w-md ficha ficha-float rounded-md p-6 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-md bg-danger/10 text-danger border border-danger/30 shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-ink">
                  ¿Eliminar este libro?
                </h3>
                <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                  ¿Estás seguro de que deseas eliminar este libro? Se eliminarán también todas sus notas.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-rule mt-2">
              <button
                type="button"
                onClick={() => setIsDeleteBookModalOpen(false)}
                disabled={deleteBookMutation.isPending}
                className="px-3.5 py-1.5 text-xs font-medium rounded-md text-ink bg-shelf hover:bg-rule/60 transition-colors"
                data-testid="cancel-delete-book-button"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => deleteBookMutation.mutate()}
                disabled={deleteBookMutation.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-md text-accent-ink bg-danger hover:bg-danger/90 shadow-sm transition-colors disabled:opacity-50"
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

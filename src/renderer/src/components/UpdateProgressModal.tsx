import React, { useState, useEffect, useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  TrendingUp,
  X,
  AlertCircle,
  Loader2,
  BookOpen,
  Percent,
  CheckCircle2
} from 'lucide-react'
import { BookStatus } from '../../../shared/domain/entities/BookStatus.js'
import type { BookPrimitives } from '../../../shared/infrastructure/ipc/contracts.js'
import { bookService } from '../services/bookService.js'

export type ProgressMode = 'page' | 'percentage'

export interface UpdateProgressModalProps {
  book: BookPrimitives
  isOpen: boolean
  onClose: () => void
}

export function UpdateProgressModal({
  book,
  isOpen,
  onClose
}: UpdateProgressModalProps): JSX.Element | null {
  const queryClient = useQueryClient()

  const hasPageCount = typeof book.pageCount === 'number' && book.pageCount > 0
  const initialMode: ProgressMode = hasPageCount ? 'page' : 'percentage'

  const [mode, setMode] = useState<ProgressMode>(initialMode)
  const [pageInput, setPageInput] = useState<number | ''>(book.currentPage ?? 0)
  const [percentageInput, setPercentageInput] = useState<number | ''>(book.progressPercentage ?? 0)
  const [markAsFinished, setMarkAsFinished] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Reset local state when modal opens
  useEffect(() => {
    if (isOpen) {
      setMode(hasPageCount ? 'page' : 'percentage')
      setPageInput(book.currentPage ?? 0)
      setPercentageInput(book.progressPercentage ?? 0)
      setMarkAsFinished(true)
      setErrorMessage(null)
    }
  }, [isOpen, book, hasPageCount])

  // Escape key listener for accessibility
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

  // Computed equivalent values
  const computedPercentageFromPage = useMemo(() => {
    if (!hasPageCount || pageInput === '') return null
    const num = Math.max(0, Math.min(book.pageCount!, Number(pageInput)))
    return Math.round((num / book.pageCount!) * 100)
  }, [hasPageCount, book.pageCount, pageInput])

  const computedPageFromPercentage = useMemo(() => {
    if (!hasPageCount || percentageInput === '') return null
    const pct = Math.max(0, Math.min(100, Number(percentageInput)))
    return Math.round((pct / 100) * book.pageCount!)
  }, [hasPageCount, book.pageCount, percentageInput])

  // Check if current input hits 100% or last page
  const isCompletionReached = useMemo(() => {
    if (mode === 'page') {
      if (pageInput === '') return false
      const p = Number(pageInput)
      if (hasPageCount) {
        return p >= book.pageCount!
      }
      return false
    } else {
      if (percentageInput === '') return false
      return Number(percentageInput) >= 100
    }
  }, [mode, pageInput, percentageInput, hasPageCount, book.pageCount])

  // Handlers for switching mode and synchronizing input
  const handleSelectMode = (newMode: ProgressMode): void => {
    setMode(newMode)
    setErrorMessage(null)
    if (newMode === 'percentage' && computedPercentageFromPage !== null) {
      setPercentageInput(computedPercentageFromPage)
    } else if (newMode === 'page' && computedPageFromPercentage !== null) {
      setPageInput(computedPageFromPercentage)
    }
  }

  const handlePageChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setErrorMessage(null)
    const val = e.target.value
    if (val === '') {
      setPageInput('')
      return
    }
    const parsed = parseInt(val, 10)
    if (isNaN(parsed)) return

    let clamped = Math.max(0, parsed)
    if (hasPageCount && clamped > book.pageCount!) {
      clamped = book.pageCount!
    }
    setPageInput(clamped)

    if (hasPageCount) {
      const pct = Math.round((clamped / book.pageCount!) * 100)
      setPercentageInput(pct)
    }
  }

  const handlePercentageChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setErrorMessage(null)
    const val = e.target.value
    if (val === '') {
      setPercentageInput('')
      return
    }
    const parsed = parseInt(val, 10)
    if (isNaN(parsed)) return

    const clamped = Math.min(100, Math.max(0, parsed))
    setPercentageInput(clamped)

    if (hasPageCount) {
      const computedPage = Math.round((clamped / 100) * book.pageCount!)
      setPageInput(computedPage)
    }
  }

  // Mutation to save progress
  const updateProgressMutation = useMutation({
    mutationFn: async () => {
      if (typeof book.id !== 'number') {
        throw new Error('Identificador de libro inválido')
      }
      const bookId = book.id

      if (mode === 'page') {
        if (pageInput === '' || isNaN(Number(pageInput))) {
          throw new Error('Debes ingresar un número de página válido.')
        }
        const pageNum = Number(pageInput)
        if (pageNum < 0) {
          throw new Error('La página no puede ser menor a 0.')
        }
        if (hasPageCount && pageNum > book.pageCount!) {
          throw new Error(`La página no puede superar el total (${book.pageCount}).`)
        }

        const res = await bookService.updateProgress({ id: bookId, page: pageNum })
        if (!res.success) {
          throw new Error(res.error || 'Error al actualizar el progreso de lectura')
        }

        if (isCompletionReached && markAsFinished) {
          const statusRes = await bookService.updateStatus(bookId, BookStatus.FINISHED)
          if (!statusRes.success) {
            throw new Error(statusRes.error || 'Error al marcar el libro como terminado')
          }
        } else if (isCompletionReached && !markAsFinished && book.status !== BookStatus.FINISHED) {
          // If backend auto-completed to FINISHED, revert to previous status
          await bookService.updateStatus(bookId, book.status)
        }
        return res.data
      } else {
        if (percentageInput === '' || isNaN(Number(percentageInput))) {
          throw new Error('Debes ingresar un porcentaje válido.')
        }
        const pctNum = Number(percentageInput)
        if (pctNum < 0 || pctNum > 100) {
          throw new Error('El porcentaje debe estar entre 0 y 100.')
        }

        const res = await bookService.updateProgress({ id: bookId, percentage: pctNum })
        if (!res.success) {
          throw new Error(res.error || 'Error al actualizar el progreso de lectura')
        }

        if (isCompletionReached && markAsFinished) {
          const statusRes = await bookService.updateStatus(bookId, BookStatus.FINISHED)
          if (!statusRes.success) {
            throw new Error(statusRes.error || 'Error al marcar el libro como terminado')
          }
        } else if (isCompletionReached && !markAsFinished && book.status !== BookStatus.FINISHED) {
          await bookService.updateStatus(bookId, book.status)
        }
        return res.data
      }
    },
    onSuccess: () => {
      if (typeof book.id === 'number') {
        queryClient.invalidateQueries({ queryKey: ['book', book.id] })
      }
      queryClient.invalidateQueries({ queryKey: ['books'] })
      onClose()
    },
    onError: (err: Error) => {
      setErrorMessage(err.message)
    }
  })

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    updateProgressMutation.mutate()
  }

  if (!isOpen) return null

  // Visual preview bar percentage
  const previewPercentage =
    mode === 'page'
      ? computedPercentageFromPage ?? 0
      : typeof percentageInput === 'number'
        ? percentageInput
        : 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-progress-modal-title"
      data-testid="update-progress-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 flex flex-col gap-5">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 id="update-progress-modal-title" className="text-base font-semibold text-slate-100">
                Actualizar Progreso
              </h3>
              <p className="text-xs text-slate-400 truncate max-w-xs mt-0.5" title={book.title}>
                {book.title}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            data-testid="cancel-progress-modal-x-button"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div
          className="flex rounded-lg bg-slate-950/80 p-1 border border-slate-800"
          role="tablist"
          aria-label="Modo de actualización de progreso"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'page'}
            onClick={() => handleSelectMode('page')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-medium transition-all ${
              mode === 'page'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            data-testid="progress-mode-page-btn"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Por página</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={mode === 'percentage'}
            onClick={() => handleSelectMode('percentage')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-medium transition-all ${
              mode === 'percentage'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            data-testid="progress-mode-percentage-btn"
          >
            <Percent className="w-3.5 h-3.5" />
            <span>Por porcentaje</span>
          </button>
        </div>

        {/* Visual Progress Bar Indicator */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">Avance estimado</span>
            <span className="font-mono text-indigo-400 font-semibold">{previewPercentage}%</span>
          </div>
          <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
            <div
              className="bg-indigo-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, previewPercentage))}%` }}
              data-testid="modal-progress-bar-fill"
            />
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === 'page' ? (
            <div className="flex flex-col gap-2">
              <label
                htmlFor="modal-progress-page-input"
                className="block text-xs font-semibold text-slate-300"
              >
                Página actual {hasPageCount && <span className="text-slate-500">(de {book.pageCount})</span>}
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="modal-progress-page-input"
                  type="number"
                  min="0"
                  max={book.pageCount ?? undefined}
                  value={pageInput}
                  onChange={handlePageChange}
                  autoFocus
                  placeholder="0"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  data-testid="modal-progress-page-input"
                />
                {hasPageCount && computedPercentageFromPage !== null && (
                  <span
                    className="px-3 py-2 text-xs font-mono rounded-xl bg-slate-800 text-slate-300 border border-slate-700 shrink-0"
                    data-testid="equivalent-percentage-badge"
                  >
                    ≈ {computedPercentageFromPage}%
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <label
                htmlFor="modal-progress-percentage-input"
                className="block text-xs font-semibold text-slate-300"
              >
                Porcentaje completado (0 - 100%)
              </label>
              <div className="flex items-center gap-3">
                <div className="relative w-full">
                  <input
                    id="modal-progress-percentage-input"
                    type="number"
                    min="0"
                    max="100"
                    value={percentageInput}
                    onChange={handlePercentageChange}
                    autoFocus
                    placeholder="0"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 font-mono pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    data-testid="modal-progress-percentage-input"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">
                    %
                  </span>
                </div>
                {hasPageCount && computedPageFromPercentage !== null && (
                  <span
                    className="px-3 py-2 text-xs font-mono rounded-xl bg-slate-800 text-slate-300 border border-slate-700 shrink-0"
                    data-testid="equivalent-page-badge"
                  >
                    ≈ pág. {computedPageFromPercentage} / {book.pageCount}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Interactive Completion Suggestion Banner */}
          {isCompletionReached && (
            <div
              className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-800/50 flex items-start gap-3 animate-fade-in"
              data-testid="finish-suggestion-banner"
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1.5 flex-1">
                <p className="text-xs font-semibold text-emerald-200">
                  ¡Felicitaciones! Has alcanzado el final del libro.
                </p>
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-emerald-300">
                  <input
                    type="checkbox"
                    checked={markAsFinished}
                    onChange={(e) => setMarkAsFinished(e.target.checked)}
                    className="rounded border-emerald-700 text-emerald-600 focus:ring-emerald-500/40 bg-slate-900"
                    data-testid="finish-suggestion-checkbox"
                  />
                  <span>¿Marcar libro como terminado (FINISHED)?</span>
                </label>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <p
              className="text-xs text-rose-400 flex items-center gap-1 mt-1"
              data-testid="progress-modal-error"
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMessage}</span>
            </p>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800 mt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium rounded-lg text-slate-300 bg-slate-800 hover:bg-slate-750 transition-colors"
              data-testid="cancel-progress-modal-button"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={updateProgressMutation.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-500 shadow-sm transition-colors disabled:opacity-50"
              data-testid="save-progress-modal-button"
            >
              {updateProgressMutation.isPending && (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              )}
              <span>Guardar Progreso</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

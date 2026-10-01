import React, { useState, useEffect, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Sparkles, X, AlertCircle, Loader2 } from 'lucide-react'
import { noteService } from '../services/noteService.js'

export interface AddNoteModalProps {
  bookId: number
  isOpen: boolean
  onClose: () => void
  bookTitle?: string
}

export function AddNoteModal({
  bookId,
  isOpen,
  onClose,
  bookTitle
}: AddNoteModalProps): JSX.Element | null {
  const queryClient = useQueryClient()
  const [content, setContent] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Reset form when modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setContent('')
      setErrorMessage(null)
    }
  }, [isOpen])

  // Accessibility: Escape key handling
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

  const createNoteMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await noteService.create(bookId, text)
      if (!res.success) {
        throw new Error(res.error || 'Error al guardar la nota')
      }
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', bookId] })
      setContent('')
      setErrorMessage(null)
      onClose()
    },
    onError: (err: Error) => {
      setErrorMessage(err.message)
    }
  })

  const handleSubmit = useCallback(
    (e?: React.FormEvent): void => {
      if (e) {
        e.preventDefault()
      }
      const trimmed = content.trim()
      if (!trimmed) {
        setErrorMessage('El contenido de la nota no puede estar vacío.')
        return
      }
      setErrorMessage(null)
      createNoteMutation.mutate(trimmed)
    },
    [content, createNoteMutation]
  )

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-note-modal-title"
      data-testid="add-note-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 flex flex-col gap-4">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 id="add-note-modal-title" className="text-base font-semibold text-slate-100">
                Nueva Idea / Reflexión
              </h3>
              {bookTitle && (
                <p className="text-xs text-slate-400 truncate max-w-sm mt-0.5" data-testid="add-note-book-title">
                  {bookTitle}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            data-testid="cancel-note-button"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Note Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="new-note-textarea"
                className="block text-xs font-semibold text-slate-300"
              >
                Contenido de la nota <span className="text-rose-400">*</span>
              </label>
              <span className="text-[11px] text-slate-500 font-mono">
                Ctrl + Enter para guardar
              </span>
            </div>
            <textarea
              id="new-note-textarea"
              rows={5}
              value={content}
              onChange={(e) => {
                setContent(e.target.value)
                if (errorMessage) setErrorMessage(null)
              }}
              onKeyDown={handleTextareaKeyDown}
              autoFocus
              placeholder="Escribe tu reflexión, frase destacada o aprendizaje sobre esta lectura..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-y"
              data-testid="note-content-input"
            />
            {errorMessage && (
              <p
                className="text-xs text-rose-400 mt-1.5 flex items-center gap-1"
                data-testid="note-content-error"
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMessage}</span>
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium rounded-lg text-slate-300 bg-slate-800 hover:bg-slate-750 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createNoteMutation.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-500 shadow-sm transition-colors disabled:opacity-50"
              data-testid="submit-note-button"
            >
              {createNoteMutation.isPending && (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              )}
              <span>Guardar Nota</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

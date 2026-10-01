import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Library, AlertCircle, RefreshCw, Plus } from 'lucide-react'
import { bookService } from '../services/bookService.js'
import {
  StatusFilterTabs,
  type FilterStatus
} from '../components/StatusFilterTabs.js'
import { BookGrid } from '../components/BookGrid.js'
import { EmptyLibraryState } from '../components/EmptyLibraryState.js'
import { AddBookModal } from '../components/AddBookModal.js'
import type { BookPrimitives } from '../../../shared/infrastructure/ipc/contracts.js'

export interface LibraryPageProps {
  onSelectBook?: (bookId: number) => void
}

export function LibraryPage({ onSelectBook }: LibraryPageProps = {}): JSX.Element {
  const [selectedStatus, setSelectedStatus] = useState<FilterStatus>('ALL')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  const {
    data: books,
    isLoading,
    isError,
    error,
    refetch,
    isFetching
  } = useQuery<BookPrimitives[], Error>({
    queryKey: ['books', selectedStatus],
    queryFn: async () => {
      const dto = selectedStatus === 'ALL' ? undefined : { status: selectedStatus }
      const res = await bookService.list(dto)
      if (!res.success) {
        throw new Error(res.error || 'No se pudo cargar la biblioteca')
      }
      return res.data
    }
  })

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="library-page">
      {/* Header */}
      <header className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 shadow-xs">
              <Library className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-100" data-testid="library-title">
                  Mi Biblioteca
                </h1>
                {books && !isLoading && !isError && (
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60"
                    data-testid="library-book-count"
                  >
                    {books.length} {books.length === 1 ? 'libro' : 'libros'}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-400 mt-0.5">
                Organiza y haz seguimiento a todas tus lecturas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-500 shadow-sm transition-colors"
              data-testid="add-book-button"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Agregar Libro</span>
            </button>

            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-300 bg-slate-800 hover:bg-slate-700/80 border border-slate-700/60 transition-colors disabled:opacity-50"
              title="Actualizar biblioteca"
              data-testid="refresh-button"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              <span>Actualizar</span>
            </button>
          </div>
        </div>

        {/* Status Filters */}
        <div className="pt-4">
          <StatusFilterTabs
            selectedStatus={selectedStatus}
            onSelectStatus={setSelectedStatus}
          />
        </div>
      </header>

      {/* Main Content Area */}
      <main>
        {isLoading && (
          <div
            className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3"
            data-testid="loading-state"
          >
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium">Cargando biblioteca...</p>
          </div>
        )}

        {isError && (
          <div
            className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-rose-900/30 bg-rose-950/10 p-8 my-6"
            data-testid="error-state"
          >
            <div className="w-12 h-12 rounded-full bg-rose-950/50 text-rose-400 flex items-center justify-center mb-3 border border-rose-800/40">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-200">Error al cargar la biblioteca</h3>
            <p className="text-sm text-slate-400 max-w-md mt-1 mb-4" data-testid="error-message">
              {error?.message || 'Error desconocido'}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shadow-sm"
              data-testid="retry-button"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reintentar
            </button>
          </div>
        )}

        {!isLoading && !isError && books && (
          <>
            {books.length === 0 ? (
              <EmptyLibraryState
                filter={selectedStatus}
                onResetFilter={() => setSelectedStatus('ALL')}
              />
            ) : (
              <BookGrid
                books={books}
                onBookClick={(book) => {
                  if (book.id !== undefined && onSelectBook) {
                    onSelectBook(book.id)
                  }
                }}
              />
            )}
          </>
        )}
      </main>

      <AddBookModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </div>
  )
}


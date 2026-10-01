import { BookOpen } from 'lucide-react'
import type { FilterStatus } from './StatusFilterTabs.js'

export interface EmptyLibraryStateProps {
  filter?: FilterStatus
  onResetFilter?: () => void
}

export function EmptyLibraryState({
  filter = 'ALL',
  onResetFilter
}: EmptyLibraryStateProps): JSX.Element {
  const isFiltered = filter !== 'ALL'

  return (
    <div
      className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-slate-700/80 bg-slate-800/30 my-8"
      data-testid="empty-library-state"
    >
      <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 mb-4 border border-slate-700/50 shadow-inner">
        <BookOpen className="w-8 h-8 stroke-[1.5]" />
      </div>
      <h3 className="text-lg font-semibold text-slate-200" data-testid="empty-state-title">
        {isFiltered ? 'No hay libros con este estado' : 'Tu biblioteca está vacía'}
      </h3>
      <p className="text-sm text-slate-400 max-w-sm mt-1 mb-4" data-testid="empty-state-description">
        {isFiltered
          ? 'No se encontraron libros que coincidan con el filtro seleccionado.'
          : 'Aún no has registrado ningún libro. ¡Comienza agregando tu primera lectura!'}
      </p>
      {isFiltered && onResetFilter && (
        <button
          type="button"
          onClick={onResetFilter}
          className="text-xs font-medium px-4 py-2 rounded-lg bg-indigo-600/90 text-white hover:bg-indigo-600 transition-colors shadow-sm"
          data-testid="reset-filter-button"
        >
          Ver todos los libros
        </button>
      )}
    </div>
  )
}

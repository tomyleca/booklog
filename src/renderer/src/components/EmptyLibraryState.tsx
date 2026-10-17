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
      className="flex flex-col items-center justify-center p-12 text-center rounded-md border-2 border-dashed border-rule-strong/70 bg-card/50 texture-paper my-8"
      data-testid="empty-library-state"
    >
      <div className="w-16 h-16 rounded-full bg-shelf flex items-center justify-center text-ink-muted mb-4 border-[3px] border-double border-rule-strong shadow-inner">
        <BookOpen className="w-8 h-8 stroke-[1.5]" />
      </div>
      <h3 className="text-lg font-semibold text-ink" data-testid="empty-state-title">
        {isFiltered ? 'No hay libros con este estado' : 'Tu biblioteca está vacía'}
      </h3>
      <p className="text-sm text-ink-muted max-w-sm mt-1 mb-4" data-testid="empty-state-description">
        {isFiltered
          ? 'No se encontraron libros que coincidan con el filtro seleccionado.'
          : 'Aún no has registrado ningún libro. ¡Comienza agregando tu primera lectura!'}
      </p>
      {isFiltered && onResetFilter && (
        <button
          type="button"
          onClick={onResetFilter}
          className="text-xs font-medium px-4 py-2 rounded-md bg-accent text-accent-ink hover:bg-accent-strong transition-colors shadow-sm"
          data-testid="reset-filter-button"
        >
          Ver todos los libros
        </button>
      )}
    </div>
  )
}

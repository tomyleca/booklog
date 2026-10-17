import type { BookStatus } from '../../../shared/domain/entities/BookStatus.js'

export type FilterStatus = 'ALL' | BookStatus

export interface StatusFilterOption {
  key: FilterStatus
  label: string
}

export const STATUS_FILTER_OPTIONS: readonly StatusFilterOption[] = [
  { key: 'ALL', label: 'Todos' },
  { key: 'TO_READ', label: 'Por leer' },
  { key: 'READING', label: 'Leyendo' },
  { key: 'PAUSED', label: 'Pausados' },
  { key: 'FINISHED', label: 'Terminados' },
  { key: 'ABANDONED', label: 'Abandonados' }
]

export interface StatusFilterTabsProps {
  selectedStatus: FilterStatus
  onSelectStatus: (status: FilterStatus) => void
  counts?: Partial<Record<FilterStatus, number>>
}

export function StatusFilterTabs({
  selectedStatus,
  onSelectStatus,
  counts
}: StatusFilterTabsProps): JSX.Element {
  return (
    <nav
      className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none"
      role="tablist"
      aria-label="Filtro de estado de libros"
      data-testid="status-filter-tabs"
    >
      {STATUS_FILTER_OPTIONS.map((option) => {
        const isSelected = selectedStatus === option.key
        const count = counts?.[option.key]

        return (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onSelectStatus(option.key)}
            className={`inline-flex items-center px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-accent/50 ${
              isSelected
                ? 'bg-accent text-accent-ink border border-accent-strong shadow-sm'
                : 'text-ink-muted hover:text-ink hover:bg-shelf/80 bg-card/60 border border-rule'
            }`}
            data-testid={`tab-${option.key.toLowerCase()}`}
          >
            <span>{option.label}</span>
            {count !== undefined && (
              <span
                className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] ${
                  isSelected
                    ? 'bg-accent-ink/20 text-accent-ink'
                    : 'bg-shelf text-ink-muted'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}

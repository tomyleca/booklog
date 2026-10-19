import type {
  KindleBookMatch,
  KindleImportAssignment,
  KindleImportGroupPreview,
  NotebookImportState
} from '../../../shared/infrastructure/ipc/contracts.js'

/** Libro elegido para cada grupo del Kindle (`null` = no importar). */
export type KindleSelection = Record<string, number | null>

export const SELECT_SKIP = ''
export const SELECT_CREATE = '__create__'

/**
 * Selección inicial: el libro propuesto por el matching o "No importar". Las exportaciones
 * del Cuaderno ya importadas (#26, misma ruta y fecha) arrancan en "No importar".
 */
export function initialKindleSelection(groups: KindleImportGroupPreview[]): KindleSelection {
  const selection: KindleSelection = {}
  for (const group of groups) {
    selection[group.key] = group.importState === 'IMPORTED' ? null : (group.match?.bookId ?? null)
  }
  return selection
}

/** Asignaciones para el commit: solo los grupos con un libro elegido. */
export function buildKindleAssignments(selection: KindleSelection): KindleImportAssignment[] {
  return Object.entries(selection)
    .filter((entry): entry is [string, number] => typeof entry[1] === 'number')
    .map(([groupKey, bookId]) => ({ groupKey, bookId }))
}

export function countSelectedAnnotations(
  groups: KindleImportGroupPreview[],
  selection: KindleSelection
): { groups: number; highlights: number; notes: number } {
  const chosen = groups.filter((group) => typeof selection[group.key] === 'number')
  return {
    groups: chosen.length,
    highlights: chosen.reduce((sum, group) => sum + group.highlightCount, 0),
    notes: chosen.reduce((sum, group) => sum + group.noteCount, 0)
  }
}

export interface MatchBadge {
  label: string
  className: string
}

const METHOD_LABELS: Record<KindleBookMatch['method'], string> = {
  ISBN: 'Por ISBN',
  TITLE_AUTHOR: 'Título y autor',
  TITLE: 'Mismo título',
  SIMILARITY: 'Título parecido'
}

const CONFIDENCE_CLASSES: Record<KindleBookMatch['confidence'], string> = {
  HIGH: 'bg-success/10 text-success border-success/30',
  MEDIUM: 'bg-accent/10 text-accent border-accent/30',
  LOW: 'bg-star/10 text-star border-star/30'
}

/** Etiqueta del origen de la propuesta, con color según la confianza. */
export function matchBadge(match: KindleBookMatch | null): MatchBadge {
  if (!match) {
    return { label: 'Sin coincidencia', className: 'bg-shelf text-ink-muted border-rule' }
  }
  return { label: METHOD_LABELS[match.method], className: CONFIDENCE_CLASSES[match.confidence] }
}

const NOTEBOOK_STATE_BADGES: Record<NotebookImportState, MatchBadge | null> = {
  NEW: null,
  IMPORTED: { label: 'Ya importado', className: 'bg-shelf text-ink-muted border-rule' },
  CHANGED: {
    label: 'Cambió desde la última importación',
    className: 'bg-accent/10 text-accent border-accent/30'
  }
}

/** Etiqueta del estado de una exportación del Cuaderno (#26); `null` si es nueva. */
export function notebookStateBadge(state: NotebookImportState | undefined): MatchBadge | null {
  return state ? NOTEBOOK_STATE_BADGES[state] : null
}

export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

/** Criterios de orden de la vista previa (feature #25). */
export const KindleGroupSort = {
  HIGHLIGHTS: 'HIGHLIGHTS',
  NOTES: 'NOTES',
  LAST_DATE: 'LAST_DATE',
  TITLE: 'TITLE'
} as const

export type KindleGroupSort = (typeof KindleGroupSort)[keyof typeof KindleGroupSort]

export const DEFAULT_KINDLE_GROUP_SORT: KindleGroupSort = KindleGroupSort.HIGHLIGHTS

export const KINDLE_GROUP_SORT_OPTIONS: { value: KindleGroupSort; label: string }[] = [
  { value: KindleGroupSort.HIGHLIGHTS, label: 'Más subrayados' },
  { value: KindleGroupSort.NOTES, label: 'Más notas' },
  { value: KindleGroupSort.LAST_DATE, label: 'Más recientes' },
  { value: KindleGroupSort.TITLE, label: 'Título (A-Z)' }
]

function lastCapturedTime(group: KindleImportGroupPreview): number {
  if (!group.lastCapturedAt) return Number.NEGATIVE_INFINITY
  const time = new Date(group.lastCapturedAt).getTime()
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time
}

function compareTitles(a: KindleImportGroupPreview, b: KindleImportGroupPreview): number {
  return a.title.localeCompare(b.title, 'es', { sensitivity: 'base' }) || a.key.localeCompare(b.key)
}

/**
 * Copia ordenada de los grupos. No toca la selección: está indexada por `group.key`, así que
 * reordenar nunca cambia qué libro quedó asignado a cada grupo. Empates: por título A-Z.
 * Los grupos sin fecha van al final al ordenar por fecha.
 */
export function sortKindleGroups(
  groups: KindleImportGroupPreview[],
  sort: KindleGroupSort
): KindleImportGroupPreview[] {
  const byNumber =
    (value: (group: KindleImportGroupPreview) => number) =>
    (a: KindleImportGroupPreview, b: KindleImportGroupPreview): number => {
      const diff = value(b) - value(a)
      return diff !== 0 && !Number.isNaN(diff) ? Math.sign(diff) : compareTitles(a, b)
    }
  const comparators: Record<
    KindleGroupSort,
    (a: KindleImportGroupPreview, b: KindleImportGroupPreview) => number
  > = {
    HIGHLIGHTS: byNumber((g) => g.highlightCount),
    NOTES: byNumber((g) => g.noteCount),
    LAST_DATE: byNumber(lastCapturedTime),
    TITLE: compareTitles
  }
  return [...groups].sort(comparators[sort])
}

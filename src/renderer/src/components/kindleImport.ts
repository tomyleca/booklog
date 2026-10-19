import type {
  KindleBookMatch,
  KindleImportAssignment,
  KindleImportGroupPreview
} from '../../../shared/infrastructure/ipc/contracts.js'

/** Libro elegido para cada grupo del Kindle (`null` = no importar). */
export type KindleSelection = Record<string, number | null>

export const SELECT_SKIP = ''
export const SELECT_CREATE = '__create__'

/** Selección inicial: el libro propuesto por el matching o "No importar". */
export function initialKindleSelection(groups: KindleImportGroupPreview[]): KindleSelection {
  const selection: KindleSelection = {}
  for (const group of groups) {
    selection[group.key] = group.match?.bookId ?? null
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

export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

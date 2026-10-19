import type {
  AnnotationLocation,
  LocationRange
} from '../../../shared/domain/entities/AnnotationLocation.js'
import type {
  HighlightColor,
  NotePrimitives
} from '../../../shared/infrastructure/ipc/contracts.js'

function formatRange(range: LocationRange): string {
  return range.end !== null ? `${range.start}–${range.end}` : `${range.start}`
}

/**
 * `pág. 12`, `pág. 12–14`, `pos. 1200–1205`. Si el Kindle dio página y posición se muestra
 * solo la página, que es la que entiende el lector (ADR 023).
 */
export function formatAnnotationLocation(location: AnnotationLocation | null | undefined): string {
  if (location?.page) return `pág. ${formatRange(location.page)}`
  if (location?.position) return `pos. ${formatRange(location.position)}`
  return ''
}

/** Fecha con hora en es-ES, p. ej. `05 ene 2026, 14:30`. Vacío si no hay fecha válida. */
export function formatAnnotationDate(value: Date | string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/** Una nota del Kindle se fecha cuando se escribió en el dispositivo, no cuando se importó. */
export function noteDisplayDate(note: NotePrimitives): Date | null {
  return note.capturedAt ?? note.createdAt ?? null
}

/** Agrupa las notas por el subrayado al que están vinculadas. */
export function groupNotesByHighlight(notes: NotePrimitives[]): Map<number, NotePrimitives[]> {
  const groups = new Map<number, NotePrimitives[]>()
  for (const note of notes) {
    if (note.highlightId === null || note.highlightId === undefined) continue
    const group = groups.get(note.highlightId) ?? []
    group.push(note)
    groups.set(note.highlightId, group)
  }
  return groups
}

export interface HighlightColorMark {
  label: string
  className: string
}

/** Clases con los tokens `highlight-*` de main.css (#26): nada de colores crudos. */
const HIGHLIGHT_COLOR_MARKS: Record<HighlightColor, HighlightColorMark> = {
  YELLOW: { label: 'Amarillo', className: 'bg-highlight-yellow' },
  BLUE: { label: 'Azul', className: 'bg-highlight-blue' },
  PINK: { label: 'Rosa', className: 'bg-highlight-pink' },
  ORANGE: { label: 'Naranja', className: 'bg-highlight-orange' }
}

/** Marca de color de un subrayado, o `null` si no tiene (los de My Clippings). */
export function highlightColorMark(
  color: HighlightColor | null | undefined
): HighlightColorMark | null {
  return color ? (HIGHLIGHT_COLOR_MARKS[color] ?? null) : null
}

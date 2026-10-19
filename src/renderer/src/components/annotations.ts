import { LocationKind } from '../../../shared/domain/entities/AnnotationLocation.js'
import type { AnnotationLocation } from '../../../shared/domain/entities/AnnotationLocation.js'
import type { NotePrimitives } from '../../../shared/infrastructure/ipc/contracts.js'

/** `pág. 12`, `pág. 12–14`, `pos. 1200–1205`. */
export function formatAnnotationLocation(location: AnnotationLocation | null | undefined): string {
  if (!location) return ''
  const prefix = location.kind === LocationKind.PAGE ? 'pág.' : 'pos.'
  const range = location.end !== null ? `${location.start}–${location.end}` : `${location.start}`
  return `${prefix} ${range}`
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

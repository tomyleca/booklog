import { KindleClippingKind } from './KindleClipping.js'
import type { KindleNotebookEntry } from './KindleNotebook.js'
import { kindleNotebookFingerprint } from './kindleFingerprint.js'
import { toAnnotationLocation } from './resolveKindleAnnotations.js'
import type { ResolvedKindleAnnotations } from './resolveKindleAnnotations.js'

/** Distancia mínima (en posiciones) entre el inicio del subrayado y su nota. */
export const NOTEBOOK_LINK_BASE_DISTANCE = 2
/**
 * Caracteres por posición del Kindle usados para estimar dónde termina un subrayado. Una
 * posición equivale a unos 128 bytes; se usa 100 para quedar del lado generoso.
 */
export const NOTEBOOK_CHARS_PER_POSITION = 100
/** Con página (sin posición) la nota puede caer en la misma página o en la siguiente. */
export const NOTEBOOK_LINK_PAGE_DISTANCE = 1

/**
 * Distancia máxima entre el inicio del subrayado y la nota para considerarla su comentario.
 * La exportación no trae la posición final, pero la nota queda al final del subrayado (en
 * la muestra real, inicio + 0..2 con subrayados de hasta ~300 caracteres), así que se
 * estima el largo del subrayado en posiciones y se suma un margen.
 */
export function maxNoteDistance(highlight: KindleNotebookEntry): number {
  return (
    NOTEBOOK_LINK_BASE_DISTANCE + Math.ceil(highlight.content.length / NOTEBOOK_CHARS_PER_POSITION)
  )
}

/**
 * ¿La nota comenta a este subrayado? Su ubicación tiene que ser igual o posterior al inicio
 * del subrayado y cercana: por posición si ambas la tienen, si no por página.
 */
export function noteBelongsToHighlight(
  note: KindleNotebookEntry,
  highlight: KindleNotebookEntry
): boolean {
  if (note.position && highlight.position) {
    const distance = note.position.start - highlight.position.start
    return distance >= 0 && distance <= maxNoteDistance(highlight)
  }
  if (note.page && highlight.page) {
    const distance = note.page.start - highlight.page.start
    return distance >= 0 && distance <= NOTEBOOK_LINK_PAGE_DISTANCE
  }
  return false
}

/**
 * Resuelve las entradas de **una** exportación del Cuaderno (feature #26). La exportación
 * refleja el estado actual de las anotaciones (no hay versiones viejas que descartar), así
 * que se conservan todas; un subrayado partido entre páginas llega como dos entradas con la
 * misma posición y textos distintos, y quedan las dos. Cada nota se vincula al subrayado
 * **inmediatamente anterior** del archivo si su ubicación es igual o posterior al inicio de
 * ese subrayado y cercana; si no, queda suelta. Sin fechas (`capturedAt = null`).
 */
export function resolveKindleNotebook(entries: KindleNotebookEntry[]): ResolvedKindleAnnotations {
  const ordered = [...entries].sort((a, b) => a.index - b.index)
  const result: ResolvedKindleAnnotations = {
    highlights: [],
    notes: [],
    supersededHighlights: 0,
    supersededNotes: 0
  }

  let previousHighlight: { entry: KindleNotebookEntry; fingerprint: string } | null = null
  for (const entry of ordered) {
    const fingerprint = kindleNotebookFingerprint(entry)
    if (entry.kind === KindleClippingKind.HIGHLIGHT) {
      result.highlights.push({
        fingerprint,
        content: entry.content,
        location: toAnnotationLocation(entry),
        capturedAt: null,
        color: entry.color
      })
      previousHighlight = { entry, fingerprint }
      continue
    }
    const linked =
      previousHighlight && noteBelongsToHighlight(entry, previousHighlight.entry)
        ? previousHighlight.fingerprint
        : null
    result.notes.push({
      fingerprint,
      content: entry.content,
      location: toAnnotationLocation(entry),
      capturedAt: null,
      highlightFingerprint: linked
    })
  }

  return result
}

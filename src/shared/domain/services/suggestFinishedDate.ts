import { isAfterToday, isValidDate, toIsoDate } from '../entities/CalendarDate.js'
import { NoteOrigin } from '../entities/NoteOrigin.js'

export const FinishedDateSuggestionSource = {
  KINDLE_HIGHLIGHT: 'KINDLE_HIGHLIGHT',
  KINDLE_NOTE: 'KINDLE_NOTE',
  TODAY: 'TODAY'
} as const

export type FinishedDateSuggestionSource =
  (typeof FinishedDateSuggestionSource)[keyof typeof FinishedDateSuggestionSource]

export interface FinishedDateSuggestion {
  /** Día sugerido en `YYYY-MM-DD` (calendario local), listo para el `<input type="date">`. */
  date: string
  source: FinishedDateSuggestionSource
}

/** Lo mínimo que se necesita de un subrayado; acepta `HighlightPrimitives`. */
export interface DatedHighlight {
  capturedAt?: Date | string | null
}

/** Lo mínimo que se necesita de una nota; acepta `NotePrimitives`. */
export interface DatedNote {
  origin: NoteOrigin
  capturedAt?: Date | string | null
}

function toValidDate(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined) return null
  const date = new Date(value)
  return isValidDate(date) ? date : null
}

/**
 * Fecha de terminado sugerida (ADR 024): el día del último subrayado o nota del Kindle del
 * libro. Si no hay ninguno con fecha, o si el más reciente es posterior a hoy (reloj del
 * Kindle mal configurado), se sugiere hoy. Las notas manuales no cuentan: su fecha es la de
 * cuando se escribieron en BookLog, no la de la lectura.
 */
export function suggestFinishedDate(
  highlights: readonly DatedHighlight[],
  notes: readonly DatedNote[],
  now: Date = new Date()
): FinishedDateSuggestion {
  let latest: Date | null = null
  let source: FinishedDateSuggestionSource = FinishedDateSuggestionSource.TODAY

  for (const highlight of highlights) {
    const date = toValidDate(highlight.capturedAt)
    if (date && (latest === null || date.getTime() > latest.getTime())) {
      latest = date
      source = FinishedDateSuggestionSource.KINDLE_HIGHLIGHT
    }
  }

  for (const note of notes) {
    if (note.origin !== NoteOrigin.KINDLE) continue
    const date = toValidDate(note.capturedAt)
    // Ante un empate gana el subrayado: la nota suele ser el comentario de ese subrayado.
    if (date && (latest === null || date.getTime() > latest.getTime())) {
      latest = date
      source = FinishedDateSuggestionSource.KINDLE_NOTE
    }
  }

  if (latest === null || isAfterToday(latest, now)) {
    return { date: toIsoDate(now), source: FinishedDateSuggestionSource.TODAY }
  }
  return { date: toIsoDate(latest), source }
}

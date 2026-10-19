import {
  isAfterToday,
  parseIsoDate,
  todayIsoDate,
  toIsoDate
} from '../../../shared/domain/entities/CalendarDate.js'
import { FinishedDateSuggestionSource } from '../../../shared/domain/services/suggestFinishedDate.js'
import type { FinishedDateSuggestion } from '../../../shared/domain/services/suggestFinishedDate.js'

/** Valor inicial del input de fecha: hoy según el reloj LOCAL (no `toISOString`, que es UTC). */
export function defaultFinishedDateInput(existing?: Date | string | null): string {
  if (existing) {
    const date = new Date(existing)
    if (!Number.isNaN(date.getTime())) return toIsoDate(date)
  }
  return todayIsoDate()
}

/** Devuelve el mensaje de error para el input de fecha de terminado, o `null` si es válido. */
export function validateFinishedDateInput(value: string): string | null {
  const parsed = parseIsoDate(value)
  if (!parsed) return 'Ingresá una fecha de terminado válida.'
  if (isAfterToday(parsed)) return 'La fecha de terminado no puede ser posterior a hoy.'
  return null
}

/** Formatea una fecha de terminado en es-AR, p. ej. `17/10/2026`. */
export function formatFinishedDate(value: Date | string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const SUGGESTION_SOURCE_LABELS: Record<FinishedDateSuggestionSource, string | null> = {
  [FinishedDateSuggestionSource.KINDLE_HIGHLIGHT]: 'último subrayado del Kindle',
  [FinishedDateSuggestionSource.KINDLE_NOTE]: 'última nota del Kindle',
  [FinishedDateSuggestionSource.TODAY]: null
}

/**
 * Texto que acompaña al campo de fecha cuando la sugerencia sale del Kindle, p. ej.
 * `Sugerida: último subrayado del Kindle (17/10/2026)`. Si la sugerencia es hoy, `null`.
 */
export function describeFinishedDateSuggestion(
  suggestion: FinishedDateSuggestion | null | undefined
): string | null {
  if (!suggestion) return null
  const label = SUGGESTION_SOURCE_LABELS[suggestion.source]
  const date = parseIsoDate(suggestion.date)
  if (!label || !date) return null
  return `Sugerida: ${label} (${formatFinishedDate(date)})`
}

export interface FinishedDatePreload {
  value: string
  hint: string | null
}

/**
 * Valor inicial del campo de fecha al marcar un libro como terminado (ADR 024):
 * - fecha existente si se pasa una (libro que ya está FINISHED, comportamiento de #20);
 * - si no, la sugerencia del Kindle;
 * - si no hay sugerencia, hoy.
 */
export function preloadFinishedDate(
  suggestion: FinishedDateSuggestion | null | undefined,
  existing?: Date | string | null
): FinishedDatePreload {
  if (existing) {
    const date = new Date(existing)
    if (!Number.isNaN(date.getTime())) return { value: toIsoDate(date), hint: null }
  }
  // "Hoy" se recalcula aquí: la sugerencia pudo memorizarse antes de pasar la medianoche.
  if (
    suggestion &&
    suggestion.source !== FinishedDateSuggestionSource.TODAY &&
    parseIsoDate(suggestion.date)
  ) {
    return { value: suggestion.date, hint: describeFinishedDateSuggestion(suggestion) }
  }
  return { value: todayIsoDate(), hint: null }
}

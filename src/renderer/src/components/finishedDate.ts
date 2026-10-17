import {
  isAfterToday,
  parseIsoDate,
  todayIsoDate,
  toIsoDate
} from '../../../shared/domain/entities/CalendarDate.js'

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

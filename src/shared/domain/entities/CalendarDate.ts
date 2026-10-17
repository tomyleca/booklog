/**
 * Utilidades para fechas "de calendario" (un día, sin hora), como la fecha en que se
 * terminó un libro.
 *
 * Convención (ADR 020): un día calendario se representa como un `Date` a las 12:00 hora
 * LOCAL de ese día. El mediodía deja 12 horas de margen a cada lado, así que el día no se
 * corre al serializar a UTC ni ante cambios de horario de verano. En los bordes (IPC,
 * `<input type="date">`) el día viaja como texto ISO `YYYY-MM-DD`.
 */

const ISO_DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

const CALENDAR_NOON_HOUR = 12

export function toCalendarNoon(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), CALENDAR_NOON_HOUR)
}

export function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime())
}

/**
 * Convierte `YYYY-MM-DD` en el mediodía local de ese día. Devuelve `null` si el texto no
 * tiene ese formato o si el día no existe (p. ej. `2026-02-30`).
 */
export function parseIsoDate(value: string): Date | null {
  if (typeof value !== 'string') return null
  const match = ISO_DATE_ONLY.exec(value.trim())
  if (!match) return null

  const year = Number(match[1])
  const monthIndex = Number(match[2]) - 1
  const day = Number(match[3])
  const date = new Date(year, monthIndex, day, CALENDAR_NOON_HOUR)

  // `new Date` desborda días inválidos al mes siguiente (30/02 -> 02/03): lo detectamos así.
  if (date.getFullYear() !== year || date.getMonth() !== monthIndex || date.getDate() !== day) {
    return null
  }
  return date
}

/** Formatea un `Date` como `YYYY-MM-DD` según el día LOCAL (no `toISOString`, que usa UTC). */
export function toIsoDate(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayIsoDate(now: Date = new Date()): string {
  return toIsoDate(now)
}

/** `true` si el día calendario (local) de `date` es posterior al de `now`. */
export function isAfterToday(date: Date, now: Date = new Date()): boolean {
  return toIsoDate(date) > toIsoDate(now)
}

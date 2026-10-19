const MONTHS: Record<string, number> = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  setiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11
}

// `14 de julio de 2025 22:15:03` (también `p. m.` en algunos firmwares).
const SPANISH_DATE =
  /(\d{1,2})\s+de\s+(\p{L}+)\s+de\s+(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([ap])\.?\s*m\.?)?/iu
// `July 14, 2025 10:15:03 PM`
const ENGLISH_US_DATE =
  /(\p{L}+)\s+(\d{1,2}),\s*(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([ap])\.?m\.?)?/iu
// `14 July 2025 22:15:03`
const ENGLISH_UK_DATE =
  /(\d{1,2})\s+(\p{L}+)\s+(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([ap])\.?m\.?)?/iu

interface DateParts {
  day: string | undefined
  month: string | undefined
  year: string | undefined
  hour: string | undefined
  minute: string | undefined
  second: string | undefined
  meridiem: string | undefined
}

function buildDate(parts: DateParts): Date | null {
  const monthIndex = parts.month ? MONTHS[parts.month.toLowerCase()] : undefined
  if (monthIndex === undefined) return null

  const year = Number(parts.year)
  const day = Number(parts.day)
  let hour = Number(parts.hour)
  const minute = Number(parts.minute)
  const second = parts.second ? Number(parts.second) : 0

  const meridiem = parts.meridiem?.toLowerCase()
  if (meridiem) {
    if (hour < 1 || hour > 12) return null
    if (meridiem === 'p' && hour !== 12) hour += 12
    if (meridiem === 'a' && hour === 12) hour = 0
  }
  if (hour > 23 || minute > 59 || second > 59) return null

  const date = new Date(year, monthIndex, day, hour, minute, second)
  if (date.getFullYear() !== year || date.getMonth() !== monthIndex || date.getDate() !== day) {
    return null
  }
  return date
}

/**
 * Interpreta la fecha de la línea de metadatos del Kindle, en castellano o en inglés, como
 * hora local. El idioma de la fecha es independiente del idioma del encabezado (el archivo
 * real trae `Your Highlight ... | Added on martes, 8 de julio de 2025 ...`), por eso se
 * prueba cada formato sobre el texto completo. Devuelve `null` si no reconoce la fecha.
 */
export function parseKindleDate(text: string): Date | null {
  const spanish = SPANISH_DATE.exec(text)
  if (spanish) {
    const [, day, month, year, hour, minute, second, meridiem] = spanish
    return buildDate({ day, month, year, hour, minute, second, meridiem })
  }

  const us = ENGLISH_US_DATE.exec(text)
  if (us) {
    const [, month, day, year, hour, minute, second, meridiem] = us
    const parsed = buildDate({ day, month, year, hour, minute, second, meridiem })
    if (parsed) return parsed
  }

  const uk = ENGLISH_UK_DATE.exec(text)
  if (uk) {
    const [, day, month, year, hour, minute, second, meridiem] = uk
    return buildDate({ day, month, year, hour, minute, second, meridiem })
  }

  return null
}

import type { KindleClipping, KindleRange } from './KindleClipping.js'

export const KINDLE_FINGERPRINT_VERSION = 'kindle-v1'

/** cyrb53: hash no criptográfico de 53 bits, puro y determinista (sin APIs de Node). */
function cyrb53(value: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    h1 = Math.imul(h1 ^ code, 2654435761)
    h2 = Math.imul(h2 ^ code, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0')
}

function rangeKey(range: KindleRange | null): string {
  if (!range) return '-'
  return range.end === null ? `${range.start}` : `${range.start}-${range.end}`
}

/**
 * Huella de una entrada del Kindle: tipo + posición (o página si no hay posición) + texto
 * con espacios colapsados. No incluye el título ni la fecha, así la misma entrada da la
 * misma huella aunque cambie cómo se interpreta el encabezado o la fecha. La unicidad es
 * por libro (`@@unique([bookId, fingerprint])`, ADR 022).
 */
export function kindleFingerprint(clipping: KindleClipping): string {
  const content = clipping.content.normalize('NFC').replace(/\s+/gu, ' ').trim()
  const where = clipping.position
    ? `pos:${rangeKey(clipping.position)}`
    : `page:${rangeKey(clipping.page)}`
  const key = [clipping.kind, where, content].join('|')
  return `${KINDLE_FINGERPRINT_VERSION}:${cyrb53(key)}${cyrb53(key, 1)}`
}

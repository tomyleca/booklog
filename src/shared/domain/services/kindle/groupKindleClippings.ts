import type { KindleClipping } from './KindleClipping.js'
import { normalizeKindleTitle } from './normalizeKindleTitle.js'
import type { NormalizedKindleTitle } from './normalizeKindleTitle.js'

export interface KindleTitleGroup {
  /** Identificador estable del grupo: el encabezado del archivo, con espacios colapsados. */
  key: string
  normalized: NormalizedKindleTitle
  clippings: KindleClipping[]
}

/**
 * Agrupa las entradas por el encabezado exacto del Kindle. Dos encabezados distintos del
 * mismo libro (otra edición u otro archivo) quedan en grupos separados: sus posiciones no
 * son comparables entre sí, y el usuario puede asignar ambos al mismo libro.
 */
export function groupKindleClippings(clippings: KindleClipping[]): KindleTitleGroup[] {
  const groups = new Map<string, KindleTitleGroup>()
  for (const clipping of clippings) {
    const normalized = normalizeKindleTitle(clipping.rawTitle)
    const key = normalized.rawTitle
    const group = groups.get(key)
    if (group) {
      group.clippings.push(clipping)
    } else {
      groups.set(key, { key, normalized, clippings: [clipping] })
    }
  }
  return [...groups.values()]
}

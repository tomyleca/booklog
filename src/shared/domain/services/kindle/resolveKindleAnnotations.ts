import { locationLastPoint, rangeContains } from '../../entities/AnnotationLocation.js'
import type { AnnotationLocationInput } from '../../entities/AnnotationLocation.js'
import type { HighlightColor } from '../../entities/HighlightColor.js'
import { KindleClippingKind } from './KindleClipping.js'
import type { KindleClipping, KindleRange } from './KindleClipping.js'
import { kindleFingerprint } from './kindleFingerprint.js'

export interface ResolvedKindleHighlight {
  fingerprint: string
  content: string
  location: AnnotationLocationInput
  capturedAt: Date | null
  /** Solo la exportación del Cuaderno (#26) trae color; My Clippings no. */
  color?: HighlightColor | null
}

export interface ResolvedKindleNote {
  fingerprint: string
  content: string
  location: AnnotationLocationInput
  capturedAt: Date | null
  /** Huella del subrayado al que comenta, o `null` si es una nota suelta. */
  highlightFingerprint: string | null
}

export interface ResolvedKindleAnnotations {
  highlights: ResolvedKindleHighlight[]
  notes: ResolvedKindleNote[]
  /** Subrayados descartados por estar superpuestos con una versión más nueva. */
  supersededHighlights: number
  /** Notas descartadas por haber una más reciente en la misma ubicación (ADR 025). */
  supersededNotes: number
}

/** Largo mínimo de texto en común para considerar que dos subrayados son el mismo editado. */
export const SHARED_TEXT_WINDOW = 25

/** Se guardan página y posición tal como las dio el Kindle (ADR 023). */
export function toAnnotationLocation(clipping: KindleClipping): AnnotationLocationInput {
  return { page: clipping.page, position: clipping.position }
}

/** Rangos para comparar dos entradas: posición si ambas la tienen (más fina), si no página. */
function comparableRanges(a: KindleClipping, b: KindleClipping): [KindleRange, KindleRange] | null {
  if (a.position && b.position) return [a.position, b.position]
  if (a.page && b.page) return [a.page, b.page]
  return null
}

function normalizeText(value: string): string {
  return value.normalize('NFC').replace(/\s+/gu, ' ').trim().toLowerCase()
}

function shareTextWindow(a: string, b: string): boolean {
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a]
  if (shorter.length < SHARED_TEXT_WINDOW) return false
  for (let i = 0; i + SHARED_TEXT_WINDOW <= shorter.length; i++) {
    if (longer.includes(shorter.slice(i, i + SHARED_TEXT_WINDOW))) return true
  }
  return false
}

/**
 * Dos subrayados son versiones del mismo (el usuario lo editó en el Kindle, que agrega una
 * entrada nueva sin borrar la vieja) si sus rangos se tocan **y** comparten texto: uno
 * contiene al otro o tienen un tramo común de al menos `SHARED_TEXT_WINDOW` caracteres.
 * Dos subrayados contiguos que solo comparten la posición de borde no comparten texto y
 * siguen siendo distintos.
 */
export function highlightsOverlap(a: KindleClipping, b: KindleClipping): boolean {
  const ranges = comparableRanges(a, b)
  if (!ranges) return false
  const [rangeA, rangeB] = ranges
  const overlapStart = Math.max(rangeA.start, rangeB.start)
  const overlapEnd = Math.min(locationLastPoint(rangeA), locationLastPoint(rangeB))
  if (overlapStart > overlapEnd) return false

  const textA = normalizeText(a.content)
  const textB = normalizeText(b.content)
  return textA.includes(textB) || textB.includes(textA) || shareTextWindow(textA, textB)
}

function timeOf(clipping: KindleClipping): number {
  return clipping.capturedAt?.getTime() ?? Number.NEGATIVE_INFINITY
}

function isNewer(a: KindleClipping, b: KindleClipping): boolean {
  if (timeOf(a) !== timeOf(b)) return timeOf(a) > timeOf(b)
  return a.index > b.index
}

function rangeKey(range: KindleRange): string {
  return range.end === null ? `${range.start}` : `${range.start}-${range.end}`
}

/**
 * Ubicación de una nota para el dedupe: la posición si la tiene (más fina), si no la página.
 * Es el mismo criterio que usa la huella, así dos notas con la misma clave también comparten
 * la parte de ubicación de la huella. Sin página ni posición, la nota es única.
 */
export function noteLocationKey(note: KindleClipping): string {
  if (note.position) return `pos:${rangeKey(note.position)}`
  if (note.page) return `page:${rangeKey(note.page)}`
  return `entry:${note.index}`
}

/**
 * Al escribir o corregir una nota el Kindle autoguarda una entrada nueva en la misma
 * ubicación sin borrar las anteriores, y las correcciones pueden estar en el medio del texto
 * (`influenxiq` → `influenx` → `influencia?`), así que comparar textos no alcanza. Decisión
 * del usuario (ADR 025): una sola nota por ubicación, la más reciente (fecha y, a igual
 * fecha, orden en el archivo).
 */
export function keepLatestNotePerLocation(notes: KindleClipping[]): KindleClipping[] {
  const latest = new Map<string, KindleClipping>()
  for (const note of notes) {
    const key = noteLocationKey(note)
    const current = latest.get(key)
    if (!current || isNewer(note, current)) latest.set(key, note)
  }
  const kept = new Set(latest.values())
  return notes.filter((note) => kept.has(note))
}

interface LinkCandidate {
  highlight: KindleClipping
  byPosition: boolean
  distance: number
}

/**
 * Subrayado que comenta la nota: aquel cuyo rango `[inicio, fin]` contiene la ubicación de
 * la nota, comparando por posición (o por página si a alguna de las dos le falta). Con
 * varios candidatos gana el de fin más cercano a la nota (los comparados por posición
 * antes que los comparados por página); si empatan, el más reciente anterior a la fecha de
 * la nota (o, si ninguno es anterior, el más reciente).
 */
export function findCommentedHighlight(
  note: KindleClipping,
  highlights: KindleClipping[]
): KindleClipping | undefined {
  const candidates: LinkCandidate[] = []
  for (const highlight of highlights) {
    const ranges = comparableRanges(highlight, note)
    if (!ranges) continue
    const [range, notePoint] = [ranges[0], ranges[1].start]
    if (!rangeContains(range, notePoint)) continue
    candidates.push({
      highlight,
      byPosition: Boolean(highlight.position && note.position),
      distance: locationLastPoint(range) - notePoint
    })
  }
  if (candidates.length === 0) return undefined

  const noteTime = timeOf(note)
  const rank = (c: LinkCandidate): number => (timeOf(c.highlight) <= noteTime ? 1 : 0)
  candidates.sort(
    (a, b) =>
      Number(b.byPosition) - Number(a.byPosition) ||
      a.distance - b.distance ||
      rank(b) - rank(a) ||
      (isNewer(a.highlight, b.highlight) ? -1 : 1)
  )
  return candidates[0]?.highlight
}

/**
 * Resuelve las entradas de **un** título del Kindle (una edición: las posiciones solo son
 * comparables dentro de la misma): descarta subrayados superpuestos quedándose con el más
 * reciente, deja una sola nota por ubicación (la más reciente), vincula cada nota al subrayado que la
 * contiene y calcula las huellas. Lógica pura, sin I/O.
 */
export function resolveKindleAnnotations(clippings: KindleClipping[]): ResolvedKindleAnnotations {
  const highlights = clippings.filter((c) => c.kind === KindleClippingKind.HIGHLIGHT)
  const notes = clippings.filter((c) => c.kind === KindleClippingKind.NOTE)

  const newestFirst = [...highlights].sort((a, b) => (isNewer(a, b) ? -1 : 1))
  const kept: KindleClipping[] = []
  for (const candidate of newestFirst) {
    if (!kept.some((existing) => highlightsOverlap(existing, candidate))) {
      kept.push(candidate)
    }
  }
  kept.sort((a, b) => a.index - b.index)

  const fingerprintOf = new Map<KindleClipping, string>()
  for (const highlight of kept) fingerprintOf.set(highlight, kindleFingerprint(highlight))

  const finalNotes = keepLatestNotePerLocation(notes)

  return {
    highlights: kept.map((highlight) => ({
      fingerprint: fingerprintOf.get(highlight) as string,
      content: highlight.content,
      location: toAnnotationLocation(highlight),
      capturedAt: highlight.capturedAt
    })),
    notes: finalNotes.map((note) => {
      const linked = findCommentedHighlight(note, kept)
      return {
        fingerprint: kindleFingerprint(note),
        content: note.content,
        location: toAnnotationLocation(note),
        capturedAt: note.capturedAt,
        highlightFingerprint: linked ? (fingerprintOf.get(linked) ?? null) : null
      }
    }),
    supersededHighlights: highlights.length - kept.length,
    supersededNotes: notes.length - finalNotes.length
  }
}

import { describe, it, expect } from 'vitest'
import {
  annotationDedupeKey,
  decodeHtmlEntities,
  FinishedDateSuggestionSource,
  Highlight,
  HighlightColor,
  KINDLE_NOTEBOOK_FINGERPRINT_VERSION,
  KindleClippingKind,
  kindleFingerprint,
  kindleNotebookFingerprint,
  normalizeKindleTitle,
  parseKindleClippings,
  parseKindleNotebook,
  resolveKindleNotebook,
  suggestFinishedDate
} from '../../src/shared/domain/index.js'
import type { KindleNotebookEntry } from '../../src/shared/domain/index.js'
import {
  NOTEBOOK_CHAPTERS_HTML,
  NOTEBOOK_EN_HTML,
  NOTEBOOK_ES_HTML,
  NOTEBOOK_ES_TEXTS,
  NOTEBOOK_ES_TITLE
} from '../fixtures/kindleNotebooks.js'

const ES = NOTEBOOK_ES_TEXTS

function entry(overrides: Partial<KindleNotebookEntry>): KindleNotebookEntry {
  return {
    index: 0,
    rawTitle: 'Libro',
    kind: KindleClippingKind.HIGHLIGHT,
    page: null,
    position: { start: 100, end: null },
    capturedAt: null,
    content: 'Texto',
    color: null,
    section: null,
    chapter: null,
    ...overrides
  }
}

describe('Feature #26 — parseKindleNotebook (Spanish export)', () => {
  const parsed = parseKindleNotebook(NOTEBOOK_ES_HTML)

  it('should read the raw title and the author of the app', () => {
    expect(parsed.rawTitle).toBe(NOTEBOOK_ES_TITLE)
    expect(parsed.author).toBe('Friedrich Nietzsche')
    expect(normalizeKindleTitle(parsed.rawTitle).title).toBe('El crepúsculo de los ídolos')
  })

  it('should parse every entry of the malformed HTML in order', () => {
    expect(parsed.totalEntries).toBe(15)
    expect(parsed.unrecognizedEntries).toBe(0)
    expect(parsed.ignoredEmpty).toBe(0)
    expect(parsed.entries.map((e) => [e.kind, e.position?.start])).toEqual([
      ['HIGHLIGHT', 52],
      ['HIGHLIGHT', 58],
      ['HIGHLIGHT', 58],
      ['HIGHLIGHT', 640],
      ['NOTE', 641],
      ['HIGHLIGHT', 872],
      ['NOTE', 873],
      ['HIGHLIGHT', 1265],
      ['NOTE', 1267],
      ['HIGHLIGHT', 1427],
      ['NOTE', 1427],
      ['HIGHLIGHT', 1450],
      ['HIGHLIGHT', 1500],
      ['NOTE', 1530],
      ['HIGHLIGHT', 1654]
    ])
    expect(parsed.entries.every((e) => e.capturedAt === null && e.page === null)).toBe(true)
    expect(parsed.entries.every((e) => e.position?.end === null)).toBe(true)
  })

  it('should keep split highlights with the same position as different entries', () => {
    expect(parsed.entries[1]?.content).toBe(ES.splitA)
    expect(parsed.entries[2]?.content).toBe(ES.splitB)
  })

  it('should read colors, sections, multiline notes and HTML entities', () => {
    expect(parsed.entries.map((e) => e.color)).toEqual([
      'YELLOW',
      'YELLOW',
      'YELLOW',
      'YELLOW',
      null,
      'YELLOW',
      null,
      'BLUE',
      null,
      'PINK',
      null,
      'ORANGE',
      'YELLOW',
      null,
      'YELLOW'
    ])
    expect(parsed.entries[0]?.section).toBe('Prólogo')
    expect(parsed.entries[7]?.section).toBe('9')
    expect(parsed.entries[14]?.section).toBe('10')
    expect(parsed.entries[6]?.content).toBe(ES.multilineNote)
    expect(parsed.entries[6]?.content).toContain('\n')
    expect(parsed.entries[8]?.content).toBe(ES.noteTwoAfter.trim())
    expect(parsed.entries[11]?.content).toBe(ES.quoted)
  })
})

describe('Feature #26 — parseKindleNotebook (chapters and English)', () => {
  it('should read the chapter of the heading and the position after it', () => {
    const parsed = parseKindleNotebook(NOTEBOOK_CHAPTERS_HTML)
    expect(parsed.author).toBe('Mary Shelley')
    expect(parsed.entries.map((e) => [e.chapter, e.position?.start])).toEqual([
      [null, 136],
      ['Carta II', 1069],
      ['Capítulo IV', 1614],
      ['Capítulo XXIV', 4033]
    ])
    expect(parsed.entries[1]?.section).toBe('Frankenstein, o el moderno Prometeo')
  })

  it('should understand Highlight/Note/Page/Location and ignore bookmarks, empty and unknown', () => {
    const parsed = parseKindleNotebook(NOTEBOOK_EN_HTML)
    expect(parsed.author).toBe('Herman Melville')
    expect(parsed.totalEntries).toBe(8)
    expect(parsed.ignoredBookmarks).toBe(1)
    expect(parsed.ignoredEmpty).toBe(1)
    expect(parsed.unrecognizedEntries).toBe(1)
    expect(
      parsed.entries.map((e) => [e.kind, e.page?.start ?? null, e.position?.start ?? null, e.color])
    ).toEqual([
      ['HIGHLIGHT', 12, 150, 'YELLOW'],
      ['NOTE', 12, 151, null],
      ['HIGHLIGHT', 40, 610, 'BLUE'],
      ['HIGHLIGHT', 55, null, 'PINK'],
      ['NOTE', 56, null, null]
    ])
    expect(parsed.entries[2]?.chapter).toBe('Chapter 3')
    expect(parsed.entries[2]?.content).toBe('Invented blue highlight with an entity: café & tea.')
  })

  it('should tolerate double-quoted classes, <br> and a BOM', () => {
    const html =
      '﻿<div class="bookTitle">Libro</div><h3 class="noteHeading">Nota - Página 3</h3>' +
      '<div class="noteText">uno<br/>dos</div>'
    const parsed = parseKindleNotebook(html)
    expect(parsed.rawTitle).toBe('Libro')
    expect(parsed.author).toBeNull()
    expect(parsed.entries).toHaveLength(1)
    expect(parsed.entries[0]?.content).toBe('uno\ndos')
    expect(parsed.entries[0]?.page).toEqual({ start: 3, end: null })
  })

  it('should return an empty result for unrelated HTML', () => {
    const parsed = parseKindleNotebook('<html><body><p>Hola</p></body></html>')
    expect(parsed).toMatchObject({ rawTitle: '', author: null, entries: [], totalEntries: 0 })
  })

  it('should decode named and numeric entities once', () => {
    expect(decodeHtmlEntities('a &gt; b &amp;lt; &#233; &#xE9; &raquo; &desconocida;')).toBe(
      'a > b &lt; é é » &desconocida;'
    )
  })
})

describe('Feature #26 — resolveKindleNotebook', () => {
  const resolved = resolveKindleNotebook(parseKindleNotebook(NOTEBOOK_ES_HTML).entries)

  it('should keep every highlight with its color and without date', () => {
    expect(resolved.highlights).toHaveLength(10)
    expect(resolved.supersededHighlights).toBe(0)
    expect(resolved.highlights.every((h) => h.capturedAt === null)).toBe(true)
    expect(resolved.highlights.map((h) => h.color)).toContain(HighlightColor.BLUE)
  })

  it('should link each note to the immediately previous nearby highlight', () => {
    const fingerprintOf = (content: string): string | undefined =>
      resolved.highlights.find((h) => h.content === content)?.fingerprint
    const linkOf = (content: string): string | null | undefined =>
      resolved.notes.find((n) => n.content === content)?.highlightFingerprint

    expect(resolved.notes).toHaveLength(5)
    expect(linkOf(ES.noteNext)).toBe(fingerprintOf(ES.withNoteNext))
    expect(linkOf(ES.multilineNote)).toBe(fingerprintOf(ES.long))
    expect(linkOf(ES.noteTwoAfter.trim())).toBe(fingerprintOf(ES.blue))
    expect(linkOf(ES.noteSame)).toBe(fingerprintOf(ES.samePosition))
    expect(linkOf(ES.farNote)).toBeNull()
  })

  it('should not link a note placed before the previous highlight or too far away', () => {
    const highlight = entry({ index: 0, position: { start: 100, end: null } })
    const before = entry({ index: 1, kind: 'NOTE', position: { start: 99, end: null } })
    const far = entry({ index: 2, kind: 'NOTE', position: { start: 104, end: null } })
    const near = entry({ index: 3, kind: 'NOTE', position: { start: 103, end: null } })
    const result = resolveKindleNotebook([highlight, before, far, near])
    expect(result.notes.map((n) => n.highlightFingerprint !== null)).toEqual([false, false, true])
  })

  it('should allow a longer distance for long highlights', () => {
    const long = entry({ index: 0, content: 'x'.repeat(450) })
    const note = entry({ index: 1, kind: 'NOTE', position: { start: 107, end: null } })
    expect(resolveKindleNotebook([long, note]).notes[0]?.highlightFingerprint).not.toBeNull()
  })

  it('should link by page when there is no position, to the same or the next page', () => {
    const resolvedEn = resolveKindleNotebook(parseKindleNotebook(NOTEBOOK_EN_HTML).entries)
    expect(resolvedEn.notes.map((n) => n.highlightFingerprint)).toEqual([
      resolvedEn.highlights[0]?.fingerprint,
      resolvedEn.highlights[2]?.fingerprint
    ])
  })

  it('should give stable and distinct notebook fingerprints', () => {
    const again = resolveKindleNotebook(parseKindleNotebook(NOTEBOOK_ES_HTML).entries)
    const all = [...resolved.highlights, ...resolved.notes].map((a) => a.fingerprint)
    expect([...again.highlights, ...again.notes].map((a) => a.fingerprint)).toEqual(all)
    expect(new Set(all).size).toBe(all.length)
    expect(all.every((f) => f.startsWith(`${KINDLE_NOTEBOOK_FINGERPRINT_VERSION}:`))).toBe(true)
  })

  it('should ignore spacing and the section when computing the fingerprint', () => {
    const a = entry({ content: 'Un  texto\n con espacios', section: 'Uno' })
    const b = entry({ content: 'Un texto con espacios ', section: 'Dos', index: 7 })
    expect(kindleNotebookFingerprint(a)).toBe(kindleNotebookFingerprint(b))
    expect(kindleNotebookFingerprint(a)).not.toBe(kindleNotebookFingerprint({ ...a, kind: 'NOTE' }))
    expect(kindleNotebookFingerprint(a)).not.toBe(kindleFingerprint(a))
  })
})

describe('Feature #26 — annotationDedupeKey (cross-source dedupe)', () => {
  it('should compare only the start of the location and the normalized text', () => {
    const clippings = annotationDedupeKey(
      { page: { start: 40, end: 41 }, position: { start: 1265, end: 1268 } },
      '  Mismo   texto\n'
    )
    const notebook = annotationDedupeKey({ position: { start: 1265, end: null } }, 'Mismo texto')
    expect(clippings).toBe(notebook)
    expect(annotationDedupeKey({ position: { start: 1266 } }, 'Mismo texto')).not.toBe(notebook)
    expect(annotationDedupeKey({ position: { start: 1265 } }, 'Otro texto')).not.toBe(notebook)
  })

  it('should use the page only when there is no position', () => {
    expect(annotationDedupeKey({ page: { start: 12 } }, 'a')).toBe('page:12|a')
    expect(annotationDedupeKey({ page: { start: 12 }, position: { start: 150 } }, 'a')).toBe(
      'pos:150|a'
    )
    expect(annotationDedupeKey(null, 'a')).toBeNull()
    expect(annotationDedupeKey({}, 'a')).toBeNull()
  })

  it('should match a My Clippings highlight with the same notebook highlight', () => {
    const text = [
      'Libro (Autor)',
      '- Tu resaltado en la posición 1265-1268 | Añadido el lunes, 14 de julio de 2025 22:15:03',
      '',
      'Subrayado   compartido entre fuentes.',
      '=========='
    ].join('\r\n')
    const clipping = parseKindleClippings(text).clippings[0]
    const notebook = entry({
      position: { start: 1265, end: null },
      content: 'Subrayado compartido entre fuentes.'
    })
    expect(clipping).toBeDefined()
    expect(
      annotationDedupeKey({ page: clipping!.page, position: clipping!.position }, clipping!.content)
    ).toBe(annotationDedupeKey({ position: notebook.position }, notebook.content))
  })
})

describe('Feature #26 — highlight color and finished date', () => {
  it('should accept the known colors and reject others', () => {
    const base = {
      bookId: 1,
      content: 'Texto',
      location: { position: { start: 10 } },
      fingerprint: 'f'
    }
    expect(Highlight.create({ ...base, color: HighlightColor.PINK }).color).toBe('PINK')
    expect(Highlight.create(base).color).toBeNull()
    expect(() => Highlight.create({ ...base, color: 'GREEN' as HighlightColor })).toThrow()
  })

  it('should ignore undated notebook highlights when suggesting the finished date', () => {
    const now = new Date(2026, 9, 19, 12)
    const dated = new Date(2026, 6, 14, 22, 15)
    expect(
      suggestFinishedDate(
        [{ capturedAt: null }, { capturedAt: dated }, { capturedAt: null }],
        [],
        now
      )
    ).toEqual({ date: '2026-07-14', source: FinishedDateSuggestionSource.KINDLE_HIGHLIGHT })
    expect(
      suggestFinishedDate([{ capturedAt: null }], [{ origin: 'KINDLE', capturedAt: null }], now)
    ).toEqual({ date: '2026-10-19', source: FinishedDateSuggestionSource.TODAY })
  })
})

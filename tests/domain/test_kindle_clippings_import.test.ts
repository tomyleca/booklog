import { describe, it, expect } from 'vitest'
import {
  canonicalIsbn,
  findCommentedHighlight,
  groupKindleClippings,
  highlightsOverlap,
  isNoteDraft,
  kindleFingerprint,
  KindleClippingKind,
  matchKindleBook,
  normalizeKindleTitle,
  parseKindleClippings,
  parseKindleDate,
  resolveKindleAnnotations,
  titleSimilarity
} from '../../src/shared/domain/index.js'
import type { KindleClipping, KindleMatchCandidate } from '../../src/shared/domain/index.js'
import {
  buildClippingsFile,
  KINDLE_FIXTURE_TEXT,
  KINDLE_TITLES
} from '../fixtures/kindleClippings.js'

function clipping(overrides: Partial<KindleClipping>): KindleClipping {
  return {
    index: 0,
    rawTitle: 'Libro',
    kind: KindleClippingKind.HIGHLIGHT,
    page: null,
    position: { start: 100, end: 105 },
    capturedAt: new Date(2025, 0, 1, 10, 0, 0),
    content: 'Texto inventado',
    ...overrides
  }
}

describe('Feature #23 — parseKindleDate', () => {
  it('should parse a Spanish date with weekday as local time', () => {
    expect(parseKindleDate('lunes, 14 de julio de 2025 22:15:03')).toEqual(
      new Date(2025, 6, 14, 22, 15, 3)
    )
  })

  it('should parse an English US date with AM/PM', () => {
    expect(parseKindleDate('Monday, July 14, 2025 10:15:03 PM')).toEqual(
      new Date(2025, 6, 14, 22, 15, 3)
    )
    expect(parseKindleDate('Monday, July 14, 2025 12:05:00 AM')).toEqual(
      new Date(2025, 6, 14, 0, 5, 0)
    )
  })

  it('should parse an English UK date', () => {
    expect(parseKindleDate('Monday, 14 July 2025 22:15:03')).toEqual(
      new Date(2025, 6, 14, 22, 15, 3)
    )
  })

  it('should return null for unknown or impossible dates', () => {
    expect(parseKindleDate('ayer a la tarde')).toBeNull()
    expect(parseKindleDate('lunes, 31 de febrero de 2025 10:00:00')).toBeNull()
  })
})

describe('Feature #23 — parseKindleClippings', () => {
  const parsed = parseKindleClippings(KINDLE_FIXTURE_TEXT)

  it('should count entries and drop bookmarks and empty highlights', () => {
    expect(parsed.totalEntries).toBe(28)
    expect(parsed.ignoredBookmarks).toBe(2)
    expect(parsed.ignoredEmpty).toBe(1)
    expect(parsed.unrecognizedEntries).toBe(0)
    expect(parsed.clippings).toHaveLength(25)
  })

  it('should strip the BOM and CRLF from titles and bodies', () => {
    const first = parsed.clippings[0]
    expect(first?.rawTitle.startsWith('AI Engineering')).toBe(true)
    expect(first?.content).toBe('Texto inventado del primer subrayado sobre modelos.')
    const bom = String.fromCharCode(0xfeff)
    const dirty = parsed.clippings.filter((c) => {
      const text = c.rawTitle + c.content
      return text.includes(bom) || text.includes(String.fromCharCode(13))
    })
    expect(dirty).toHaveLength(0)
    expect(KINDLE_FIXTURE_TEXT.charCodeAt(0)).toBe(0xfeff)
    expect(KINDLE_FIXTURE_TEXT).toContain(String.fromCharCode(13, 10))
  })

  it('should read page and position together, as single numbers or ranges', () => {
    expect(parsed.clippings[0]).toMatchObject({
      kind: 'HIGHLIGHT',
      page: { start: 12, end: null },
      position: { start: 180, end: 183 },
      capturedAt: new Date(2025, 6, 14, 22, 15, 3)
    })
    const pageRange = parsed.clippings.find((c) => c.content.startsWith('Cita inventada que cruza'))
    expect(pageRange).toMatchObject({ page: { start: 33, end: 34 }, position: null })
    const single = parsed.clippings.find((c) => c.content.startsWith('Cita inventada de una sola'))
    expect(single).toMatchObject({ page: null, position: { start: 1500, end: null } })
  })

  it('should recognize English headers with a Spanish date and fully English entries', () => {
    const mixed = parsed.clippings.find((c) => c.content === 'Invented highlight about software.')
    expect(mixed).toMatchObject({
      kind: 'HIGHLIGHT',
      position: { start: 512, end: 515 },
      capturedAt: new Date(2025, 6, 8, 21, 40, 12)
    })
    const english = parsed.clippings.find((c) => c.content === 'Invented note in English.')
    expect(english).toMatchObject({
      kind: 'NOTE',
      page: { start: 7, end: null },
      position: { start: 101, end: null },
      capturedAt: new Date(2025, 6, 14, 22, 16, 0)
    })
  })

  it('should expand abbreviated range ends and tolerate a missing final separator', () => {
    const text =
      'Libro (Autor)\n- Your Highlight on Loc. 1200-05 | Added on Monday, July 14, 2025 9:00:00 AM\n\nTexto'
    const result = parseKindleClippings(text)
    expect(result.clippings[0]?.position).toEqual({ start: 1200, end: 1205 })
  })

  it('should count unknown headers as unrecognized instead of failing', () => {
    const text = buildClippingsFile([
      { title: 'Libro (Autor)', meta: '- Votre surlignement emplacement 10', body: 'Texte' }
    ])
    const result = parseKindleClippings(text)
    expect(result.unrecognizedEntries).toBe(1)
    expect(result.clippings).toHaveLength(0)
  })
})

describe('Feature #23 — normalizeKindleTitle', () => {
  it.each([
    [
      KINDLE_TITLES.annasArchive,
      'AI Engineering: Building Applications with Foundation Models',
      'Chip Huyen',
      '9781098166304'
    ],
    [
      KINDLE_TITLES.annasArchiveIsbn13,
      'Legado de cenizas: La historia de la CIA',
      'Tim Weiner',
      '9788466351737'
    ],
    [KINDLE_TITLES.dashAuthor, 'Legado de cenizas', 'Tim Weiner', null],
    [
      KINDLE_TITLES.zLibrary,
      'This Is How They Tell Me the World Ends The Cyberweapons Arms Race',
      'Nicole Perlroth',
      null
    ],
    [KINDLE_TITLES.oceanOfPdf, 'Eisenhorn The Omnibus', 'Dan Abnett', null],
    [KINDLE_TITLES.epubLibre, 'Ficciones', 'Jorge Luis Borges', null],
    [
      KINDLE_TITLES.hyphenated,
      'De animales a dioses Breve historia de la humanidad',
      'Yuval Noah Harari',
      null
    ],
    [KINDLE_TITLES.noAuthor, 'Moby Dick', null, null],
    [KINDLE_TITLES.underscoredNoAuthor, 'Jorge Luis Borges ficciones', null, null],
    [KINDLE_TITLES.lastNameFirst, 'The Mist', 'Stephen King', '9780451223296'],
    [KINDLE_TITLES.translator, 'Siddhartha', 'Hermann Hesse', null],
    [
      KINDLE_TITLES.truncatedHash,
      'Para hechizar a un cazador: Premio Clarín de Novela 2023',
      'Luciano Lamberti',
      '9789870758167'
    ]
  ])('should clean %s', (raw, title, author, isbn) => {
    const normalized = normalizeKindleTitle(raw)
    expect(normalized.title).toBe(title)
    expect(normalized.author).toBe(author)
    expect(normalized.isbn).toBe(isbn)
  })

  it('should convert ISBN-10 to the canonical ISBN-13', () => {
    expect(canonicalIsbn('0-306-40615-2')).toBe('9780306406157')
    expect(canonicalIsbn('978-0-306-40615-7')).toBe('9780306406157')
    expect(canonicalIsbn('abc')).toBeNull()
  })
})

describe('Feature #23 — matchKindleBook', () => {
  const books: KindleMatchCandidate[] = [
    { id: 1, title: 'Legado de cenizas', authors: 'Tim Weiner', isbn: null },
    { id: 2, title: 'AI Engineering', authors: 'Chip Huyen', isbn: '978-1-0981-6630-4' },
    { id: 3, title: 'Ficciones', authors: 'Jorge Luis Borges', isbn: null },
    { id: 4, title: 'De animales a dioses', authors: 'Yuval Noah Harari', isbn: null },
    { id: 5, title: 'Cuentos', authors: 'Julio Cortázar', isbn: null }
  ]

  it('should prefer the ISBN', () => {
    expect(matchKindleBook(normalizeKindleTitle(KINDLE_TITLES.annasArchive), books)).toEqual({
      bookId: 2,
      method: 'ISBN',
      confidence: 'HIGH',
      score: 1
    })
  })

  it('should match by normalized title and author (also the main title before ":")', () => {
    expect(matchKindleBook(normalizeKindleTitle(KINDLE_TITLES.epubLibre), books)).toMatchObject({
      bookId: 3,
      method: 'TITLE_AUTHOR',
      confidence: 'HIGH'
    })
    expect(
      matchKindleBook(normalizeKindleTitle(KINDLE_TITLES.annasArchiveIsbn13), books)
    ).toMatchObject({ bookId: 1, method: 'TITLE_AUTHOR', confidence: 'HIGH' })
  })

  it('should lower the confidence when the title matches but the author does not', () => {
    const kindle = normalizeKindleTitle('Cuentos - Fiodor Dostoevskii (Fiodor Dostoevskii)')
    expect(matchKindleBook(kindle, books)).toMatchObject({
      bookId: 5,
      method: 'TITLE',
      confidence: 'LOW'
    })
  })

  it('should fall back to similarity for close titles', () => {
    const match = matchKindleBook(normalizeKindleTitle(KINDLE_TITLES.hyphenated), books)
    expect(match).toMatchObject({ bookId: 4, method: 'SIMILARITY' })
    expect(match?.score).toBeGreaterThanOrEqual(0.6)
  })

  it('should return null when nothing is close enough', () => {
    expect(matchKindleBook(normalizeKindleTitle(KINDLE_TITLES.oceanOfPdf), books)).toBeNull()
  })

  it('should compute a bigram similarity between 0 and 1', () => {
    expect(titleSimilarity('ficciones', 'ficciones')).toBe(1)
    expect(titleSimilarity('ficciones', 'ficcion')).toBeGreaterThan(0.8)
    expect(titleSimilarity('ficciones', 'superinteligencia')).toBeLessThan(0.3)
  })
})

describe('Feature #23 — dedupe, note drafts and links', () => {
  it('should treat overlapping highlights that share text as edits', () => {
    const old = clipping({ position: { start: 300, end: 302 }, content: 'Frase corta' })
    const extended = clipping({ position: { start: 300, end: 305 }, content: 'Frase corta y más' })
    expect(highlightsOverlap(old, extended)).toBe(true)
  })

  it('should keep adjacent highlights that only share the border position', () => {
    const a = clipping({ position: { start: 100, end: 102 }, content: 'Primera frase inventada' })
    const b = clipping({ position: { start: 102, end: 104 }, content: 'Segunda frase distinta' })
    expect(highlightsOverlap(a, b)).toBe(false)
  })

  it('should detect note drafts and exact duplicates but keep distinct notes', () => {
    const note = (index: number, minute: number, content: string): KindleClipping =>
      clipping({
        index,
        kind: KindleClippingKind.NOTE,
        position: { start: 50, end: null },
        capturedAt: new Date(2025, 0, 1, 10, minute),
        content
      })
    const notes = [
      note(0, 0, 'Ho'),
      note(1, 1, 'Hola mundo'),
      note(2, 2, 'Hola mundo'),
      note(3, 3, 'Otra')
    ]
    expect(notes.map((n) => isNoteDraft(n, notes))).toEqual([true, true, false, false])
  })

  it('should link a note inside the range to the highlight whose end is closest', () => {
    const note = clipping({
      kind: KindleClippingKind.NOTE,
      position: { start: 110, end: null },
      capturedAt: new Date(2025, 0, 1, 12, 0)
    })
    const wide = clipping({ index: 1, position: { start: 90, end: 130 } })
    const close = clipping({ index: 2, position: { start: 105, end: 111 } })
    const outside = clipping({ index: 3, position: { start: 111, end: 115 } })
    expect(findCommentedHighlight(note, [wide, close, outside])).toBe(close)
  })

  it('should break ties with the newest highlight made before the note', () => {
    const note = clipping({
      kind: KindleClippingKind.NOTE,
      position: { start: 105, end: null },
      capturedAt: new Date(2025, 0, 1, 12, 0)
    })
    const before = clipping({ index: 1, capturedAt: new Date(2025, 0, 1, 11, 0) })
    const after = clipping({ index: 2, capturedAt: new Date(2025, 0, 1, 13, 0) })
    expect(findCommentedHighlight(note, [after, before])).toBe(before)
  })

  it('should compare by page when one entry has no position', () => {
    const note = clipping({
      kind: KindleClippingKind.NOTE,
      page: { start: 34, end: null },
      position: null
    })
    const highlight = clipping({ page: { start: 33, end: 34 }, position: { start: 500, end: 510 } })
    expect(findCommentedHighlight(note, [highlight])).toBe(highlight)
  })

  it('should resolve the fixture groups: newest edit, final notes and links', () => {
    const groups = groupKindleClippings(parseKindleClippings(KINDLE_FIXTURE_TEXT).clippings)
    expect(groups).toHaveLength(12)

    const ai = groups.find((g) => g.normalized.title.startsWith('AI Engineering'))
    const resolved = resolveKindleAnnotations(ai?.clippings ?? [])
    expect(resolved.highlights.map((h) => h.content)).toEqual([
      'Texto inventado del primer subrayado sobre modelos.',
      'Frase inventada que el usuario subrayó primero y después extendió un poco más.'
    ])
    expect(resolved.supersededHighlights).toBe(1)
    expect(resolved.notes.map((n) => n.content)).toEqual([
      'Nota inventada sobre el primer subrayado.',
      'Borrador de nota terminado.',
      'Otra idea distinta en el mismo lugar.'
    ])
    expect(resolved.supersededNotes).toBe(3)
    const [first, second] = resolved.highlights
    expect(resolved.notes.map((n) => n.highlightFingerprint)).toEqual([
      first?.fingerprint,
      second?.fingerprint,
      second?.fingerprint
    ])
    expect(first?.location).toEqual({
      page: { start: 12, end: null },
      position: { start: 180, end: 183 }
    })

    const cia = groups.find((g) => g.normalized.isbn === '9788466351737')
    const ciaResolved = resolveKindleAnnotations(cia?.clippings ?? [])
    expect(ciaResolved.notes[0]?.highlightFingerprint).toBeNull()
  })

  it('should produce stable fingerprints based on kind, position and text', () => {
    const a = clipping({ rawTitle: 'Uno', capturedAt: new Date(2020, 0, 1) })
    const b = clipping({ rawTitle: 'Otro título', capturedAt: new Date(2024, 5, 5) })
    expect(kindleFingerprint(a)).toBe(kindleFingerprint(b))
    expect(kindleFingerprint(a)).toMatch(/^kindle-v1:[0-9a-f]{28}$/u)
    expect(kindleFingerprint(clipping({ content: 'Otro texto' }))).not.toBe(kindleFingerprint(a))
    expect(kindleFingerprint(clipping({ kind: KindleClippingKind.NOTE }))).not.toBe(
      kindleFingerprint(a)
    )
  })
})

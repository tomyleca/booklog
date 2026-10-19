import { describe, it, expect } from 'vitest'
import {
  createAnnotationLocation,
  Highlight,
  InvalidAnnotationLocationError,
  InvalidHighlightError,
  InvalidNoteError,
  isNoteOrigin,
  locationLastPoint,
  LocationKind,
  Note,
  NoteOrigin
} from '../../src/shared/domain/index.js'

describe('Feature #22 — AnnotationLocation value object', () => {
  it('should accept a single page reference', () => {
    const location = createAnnotationLocation({ kind: LocationKind.PAGE, start: 12 })
    expect(location).toEqual({ kind: 'PAGE', start: 12, end: null })
  })

  it('should accept a Kindle position range', () => {
    const location = createAnnotationLocation({
      kind: LocationKind.LOCATION,
      start: 1200,
      end: 1205
    })
    expect(location).toEqual({ kind: 'LOCATION', start: 1200, end: 1205 })
    expect(locationLastPoint(location)).toBe(1205)
  })

  it('should normalize a range with equal ends to a single point', () => {
    const location = createAnnotationLocation({ kind: LocationKind.PAGE, start: 7, end: 7 })
    expect(location.end).toBeNull()
    expect(locationLastPoint(location)).toBe(7)
  })

  it('should be immutable', () => {
    const location = createAnnotationLocation({ kind: LocationKind.PAGE, start: 3 })
    expect(Object.isFrozen(location)).toBe(true)
  })

  it('should reject an unknown kind', () => {
    expect(() =>
      createAnnotationLocation({ kind: 'CHAPTER' as LocationKind, start: 1 })
    ).toThrow(InvalidAnnotationLocationError)
  })

  it('should reject non positive or non integer numbers', () => {
    expect(() => createAnnotationLocation({ kind: LocationKind.PAGE, start: 0 })).toThrow(
      InvalidAnnotationLocationError
    )
    expect(() => createAnnotationLocation({ kind: LocationKind.PAGE, start: 1.5 })).toThrow(
      InvalidAnnotationLocationError
    )
    expect(() =>
      createAnnotationLocation({ kind: LocationKind.PAGE, start: 2, end: -1 })
    ).toThrow(InvalidAnnotationLocationError)
  })

  it('should reject a range whose end is before its start', () => {
    expect(() =>
      createAnnotationLocation({ kind: LocationKind.LOCATION, start: 50, end: 40 })
    ).toThrow(InvalidAnnotationLocationError)
  })
})

describe('Feature #22 — Highlight entity', () => {
  const capturedAt = new Date(2026, 6, 14, 22, 15, 3)

  it('should create a highlight with location, Kindle date and fingerprint', () => {
    const highlight = Highlight.create({
      bookId: 5,
      content: '  Un fragmento resaltado.  ',
      location: { kind: LocationKind.LOCATION, start: 100, end: 104 },
      capturedAt,
      fingerprint: ' abc123 '
    })

    expect(highlight.bookId).toBe(5)
    expect(highlight.content).toBe('Un fragmento resaltado.')
    expect(highlight.location).toEqual({ kind: 'LOCATION', start: 100, end: 104 })
    expect(highlight.capturedAt).toEqual(capturedAt)
    expect(highlight.fingerprint).toBe('abc123')
    expect(highlight.createdAt).toBeInstanceOf(Date)
  })

  it('should allow an unknown Kindle date', () => {
    const highlight = Highlight.create({
      bookId: 5,
      content: 'Texto',
      location: { kind: LocationKind.PAGE, start: 1 },
      fingerprint: 'f1'
    })
    expect(highlight.capturedAt).toBeNull()
  })

  it('should reject empty content, empty fingerprint, invalid bookId and invalid date', () => {
    const base = {
      bookId: 5,
      content: 'Texto',
      location: { kind: LocationKind.PAGE, start: 1 },
      fingerprint: 'f1'
    }
    expect(() => Highlight.create({ ...base, content: '   ' })).toThrow(InvalidHighlightError)
    expect(() => Highlight.create({ ...base, fingerprint: '' })).toThrow(InvalidHighlightError)
    expect(() => Highlight.create({ ...base, bookId: 0 })).toThrow(InvalidHighlightError)
    expect(() => Highlight.create({ ...base, capturedAt: new Date('nope') })).toThrow(
      InvalidHighlightError
    )
    expect(() =>
      Highlight.create({ ...base, location: { kind: LocationKind.PAGE, start: -3 } })
    ).toThrow(InvalidAnnotationLocationError)
  })

  it('should round-trip through primitives', () => {
    const original = new Highlight({
      id: 9,
      bookId: 5,
      content: 'Texto',
      location: { kind: LocationKind.PAGE, start: 10, end: 11 },
      capturedAt,
      fingerprint: 'f1',
      createdAt: new Date('2026-10-01T10:00:00Z')
    })

    const primitives = original.toPrimitives()
    expect(primitives).toEqual({
      id: 9,
      bookId: 5,
      content: 'Texto',
      location: { kind: 'PAGE', start: 10, end: 11 },
      capturedAt,
      fingerprint: 'f1',
      createdAt: new Date('2026-10-01T10:00:00Z')
    })
    expect(Highlight.fromPrimitives(primitives).toPrimitives()).toEqual(primitives)
  })
})

describe('Feature #22 — Note origin', () => {
  it('should create manual notes by default with no import metadata', () => {
    const note = Note.create({ bookId: 3, content: 'Mi idea' })
    expect(note.origin).toBe(NoteOrigin.MANUAL)
    expect(note.highlightId).toBeNull()
    expect(note.location).toBeNull()
    expect(note.capturedAt).toBeNull()
    expect(note.fingerprint).toBeNull()
  })

  it('should treat notes without origin (pre-#22 data) as MANUAL', () => {
    const note = new Note({ id: 1, bookId: 3, content: 'Nota vieja' })
    expect(note.origin).toBe(NoteOrigin.MANUAL)
  })

  it('should create an imported Kindle note linked to a highlight', () => {
    const capturedAt = new Date(2026, 6, 14, 22, 16, 0)
    const note = Note.createImported({
      bookId: 3,
      content: 'Comentario escrito en el Kindle',
      location: { kind: LocationKind.LOCATION, start: 104 },
      capturedAt,
      fingerprint: 'n1',
      highlightId: 9
    })

    expect(note.origin).toBe(NoteOrigin.KINDLE)
    expect(note.highlightId).toBe(9)
    expect(note.location).toEqual({ kind: 'LOCATION', start: 104, end: null })
    expect(note.capturedAt).toEqual(capturedAt)
    expect(note.fingerprint).toBe('n1')
  })

  it('should allow a Kindle note without a linked highlight', () => {
    const note = Note.createImported({
      bookId: 3,
      content: 'Nota suelta',
      location: { kind: LocationKind.PAGE, start: 40 },
      fingerprint: 'n2'
    })
    expect(note.highlightId).toBeNull()
  })

  it('should require a fingerprint for Kindle notes', () => {
    expect(
      () => new Note({ bookId: 3, content: 'Sin huella', origin: NoteOrigin.KINDLE })
    ).toThrow(InvalidNoteError)
  })

  it('should forbid import metadata on manual notes', () => {
    expect(
      () =>
        new Note({
          bookId: 3,
          content: 'Manual',
          origin: NoteOrigin.MANUAL,
          fingerprint: 'x'
        })
    ).toThrow(InvalidNoteError)
    expect(
      () =>
        new Note({
          bookId: 3,
          content: 'Manual',
          location: { kind: LocationKind.PAGE, start: 1 }
        })
    ).toThrow(InvalidNoteError)
  })

  it('should reject an invalid origin or highlightId', () => {
    expect(
      () => new Note({ bookId: 3, content: 'x', origin: 'EMAIL' as NoteOrigin })
    ).toThrow(InvalidNoteError)
    expect(() => new Note({ bookId: 3, content: 'x', highlightId: 0 })).toThrow(
      InvalidNoteError
    )
  })

  it('should keep origin and metadata when editing content', () => {
    const note = Note.createImported({
      bookId: 3,
      content: 'Original',
      location: { kind: LocationKind.PAGE, start: 40 },
      fingerprint: 'n3',
      highlightId: 2
    })
    note.updateContent('Editada')
    expect(note.content).toBe('Editada')
    expect(note.origin).toBe(NoteOrigin.KINDLE)
    expect(note.highlightId).toBe(2)
    expect(note.fingerprint).toBe('n3')
  })

  it('should round-trip Kindle notes through primitives', () => {
    const note = Note.createImported({
      bookId: 3,
      content: 'Ida y vuelta',
      location: { kind: LocationKind.LOCATION, start: 10, end: 12 },
      capturedAt: new Date(2026, 0, 2, 9, 0, 0),
      fingerprint: 'n4',
      highlightId: 7
    })
    const primitives = note.toPrimitives()
    expect(Note.fromPrimitives(primitives).toPrimitives()).toEqual(primitives)
  })

  it('should expose an origin type guard', () => {
    expect(isNoteOrigin('MANUAL')).toBe(true)
    expect(isNoteOrigin('KINDLE')).toBe(true)
    expect(isNoteOrigin('OTHER')).toBe(false)
  })
})

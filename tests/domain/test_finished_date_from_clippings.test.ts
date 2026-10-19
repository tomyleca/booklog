import { describe, it, expect } from 'vitest'
import {
  FinishedDateSuggestionSource,
  NoteOrigin,
  suggestFinishedDate
} from '../../src/shared/domain/index.js'

const NOW = new Date(2026, 9, 19, 15, 0)

function at(year: number, month: number, day: number, hour = 10, minute = 0): Date {
  return new Date(year, month - 1, day, hour, minute)
}

describe('Feature #24 — suggestFinishedDate', () => {
  it('should suggest today when the book has no annotations', () => {
    expect(suggestFinishedDate([], [], NOW)).toEqual({
      date: '2026-10-19',
      source: FinishedDateSuggestionSource.TODAY
    })
  })

  it('should suggest the day of the latest Kindle highlight', () => {
    const suggestion = suggestFinishedDate(
      [{ capturedAt: at(2026, 9, 2) }, { capturedAt: at(2026, 10, 17) }, { capturedAt: null }],
      [],
      NOW
    )
    expect(suggestion).toEqual({
      date: '2026-10-17',
      source: FinishedDateSuggestionSource.KINDLE_HIGHLIGHT
    })
  })

  it('should suggest a Kindle note when it is newer than every highlight', () => {
    const suggestion = suggestFinishedDate(
      [{ capturedAt: at(2026, 10, 10) }],
      [{ origin: NoteOrigin.KINDLE, capturedAt: at(2026, 10, 12) }],
      NOW
    )
    expect(suggestion).toEqual({
      date: '2026-10-12',
      source: FinishedDateSuggestionSource.KINDLE_NOTE
    })
  })

  it('should prefer the highlight on a tie with a Kindle note', () => {
    const sameMoment = at(2026, 10, 12, 21, 30)
    const suggestion = suggestFinishedDate(
      [{ capturedAt: sameMoment }],
      [{ origin: NoteOrigin.KINDLE, capturedAt: new Date(sameMoment) }],
      NOW
    )
    expect(suggestion.source).toBe(FinishedDateSuggestionSource.KINDLE_HIGHLIGHT)
  })

  it('should ignore manual notes even when they are the newest', () => {
    const suggestion = suggestFinishedDate(
      [{ capturedAt: at(2026, 10, 1) }],
      [{ origin: NoteOrigin.MANUAL, capturedAt: at(2026, 10, 18) }],
      NOW
    )
    expect(suggestion).toEqual({
      date: '2026-10-01',
      source: FinishedDateSuggestionSource.KINDLE_HIGHLIGHT
    })
  })

  it('should suggest today when only manual notes exist', () => {
    const suggestion = suggestFinishedDate(
      [],
      [{ origin: NoteOrigin.MANUAL, capturedAt: at(2026, 10, 1) }],
      NOW
    )
    expect(suggestion.source).toBe(FinishedDateSuggestionSource.TODAY)
  })

  it('should fall back to today when the latest Kindle annotation is in the future', () => {
    const suggestion = suggestFinishedDate(
      [{ capturedAt: at(2026, 10, 1) }, { capturedAt: at(2026, 10, 20, 8) }],
      [],
      NOW
    )
    expect(suggestion).toEqual({
      date: '2026-10-19',
      source: FinishedDateSuggestionSource.TODAY
    })
  })

  it('should accept an annotation from later today (compares calendar days)', () => {
    const suggestion = suggestFinishedDate([{ capturedAt: at(2026, 10, 19, 23, 50) }], [], NOW)
    expect(suggestion).toEqual({
      date: '2026-10-19',
      source: FinishedDateSuggestionSource.KINDLE_HIGHLIGHT
    })
  })

  it('should use the local calendar day, not the UTC one', () => {
    // 23:30 local del 15/10: en husos negativos (UTC-3) ya es 16/10 en UTC.
    const suggestion = suggestFinishedDate([{ capturedAt: at(2026, 10, 15, 23, 30) }], [], NOW)
    expect(suggestion.date).toBe('2026-10-15')
  })

  it('should accept ISO strings and skip invalid dates', () => {
    const suggestion = suggestFinishedDate(
      [{ capturedAt: 'not-a-date' }, { capturedAt: at(2026, 10, 5).toISOString() }],
      [{ origin: NoteOrigin.KINDLE, capturedAt: undefined }],
      NOW
    )
    expect(suggestion).toEqual({
      date: '2026-10-05',
      source: FinishedDateSuggestionSource.KINDLE_HIGHLIGHT
    })
  })
})

import { describe, it, expect } from 'vitest'
import type { BookSearchResult } from '../../src/shared/domain/ports/BookSearchService.js'
import { mergeSearchResults } from '../../src/shared/domain/services/mergeSearchResults.js'
import {
  RELEVANCE_WEIGHTS,
  normalizeForSearch,
  rankSearchResults,
  scoreSearchResult
} from '../../src/shared/domain/services/rankSearchResults.js'

function result(overrides: Partial<BookSearchResult> & { title: string }): BookSearchResult {
  return {
    googleBooksId: null,
    authors: [],
    coverUrl: null,
    isbn: null,
    pageCount: null,
    ...overrides
  }
}

describe('normalizeForSearch', () => {
  it('should lowercase, strip accents and collapse punctuation into single spaces', () => {
    expect(normalizeForSearch('  Cien Años: de  Soledad! ')).toBe('cien anos de soledad')
    expect(normalizeForSearch('García-Márquez')).toBe('garcia marquez')
  })
})

describe('mergeSearchResults', () => {
  it('should concatenate lists dropping duplicates by googleBooksId (first one wins)', () => {
    const a = result({ googleBooksId: 'a', title: 'A (fielded)' })
    const b = result({ googleBooksId: 'b', title: 'B' })
    const aAgain = result({ googleBooksId: 'a', title: 'A (free)' })

    const merged = mergeSearchResults([a, b], [aAgain])

    expect(merged.map((r) => r.title)).toEqual(['A (fielded)', 'B'])
  })

  it('should keep every result without googleBooksId because they cannot be compared', () => {
    const noId1 = result({ title: 'Sin id' })
    const noId2 = result({ title: 'Sin id' })

    expect(mergeSearchResults([noId1], [noId2])).toHaveLength(2)
  })
})

describe('scoreSearchResult', () => {
  it('should rank exact title above prefix, prefix above phrase and phrase above word overlap', () => {
    const criteria = { query: 'pet sematary' }
    const exact = scoreSearchResult(result({ title: 'Pet Sematary' }), criteria)
    const prefix = scoreSearchResult(result({ title: 'Pet Sematary (Study Guide)' }), criteria)
    const phrase = scoreSearchResult(
      result({ title: 'Study Guide: Pet Sematary by Stephen King' }),
      criteria
    )
    const partial = scoreSearchResult(result({ title: 'Sematary Tales' }), criteria)
    const none = scoreSearchResult(result({ title: 'Fangoria' }), criteria)

    expect(exact).toBe(RELEVANCE_WEIGHTS.TITLE_EXACT)
    expect(prefix).toBe(RELEVANCE_WEIGHTS.TITLE_STARTS_WITH)
    expect(phrase).toBe(RELEVANCE_WEIGHTS.TITLE_CONTAINS_PHRASE)
    expect(partial).toBe(RELEVANCE_WEIGHTS.TITLE_WORD_COVERAGE / 2)
    expect(none).toBe(0)
  })

  it('should ignore case and accents when comparing titles', () => {
    expect(scoreSearchResult(result({ title: 'Cien años de soledad' }), { query: 'CIEN AÑOS DE SOLEDAD' })).toBe(
      RELEVANCE_WEIGHTS.TITLE_EXACT
    )
  })

  it('should reward the author field match proportionally to the matched words', () => {
    const king = result({ title: 'X', authors: ['Stephen King'] })
    const criteriaFull = { query: '', author: 'stephen king' }
    const criteriaPartial = { query: '', author: 'king' }

    expect(scoreSearchResult(king, criteriaFull)).toBe(RELEVANCE_WEIGHTS.AUTHOR_FIELD_MATCH)
    expect(scoreSearchResult(king, criteriaPartial)).toBe(RELEVANCE_WEIGHTS.AUTHOR_FIELD_MATCH / 2)
    expect(scoreSearchResult(result({ title: 'X', authors: ['SuperSummary'] }), criteriaFull)).toBe(0)
  })

  it('should detect author words inside the free text and still match the title exactly', () => {
    const itBook = result({ title: 'It', authors: ['Stephen King'] })

    const score = scoreSearchResult(itBook, { query: 'it stephen king' })

    expect(score).toBe(RELEVANCE_WEIGHTS.TITLE_EXACT + RELEVANCE_WEIGHTS.AUTHOR_FROM_QUERY)
  })

  it('should add bonuses for cover, ISBN and page count', () => {
    const complete = result({
      title: 'Fangoria',
      coverUrl: 'https://x/cover.jpg',
      isbn: '9781982115982',
      pageCount: 416
    })

    expect(scoreSearchResult(complete, { query: 'pet sematary' })).toBe(
      RELEVANCE_WEIGHTS.HAS_COVER + RELEVANCE_WEIGHTS.HAS_ISBN + RELEVANCE_WEIGHTS.HAS_PAGE_COUNT
    )
  })
})

describe('rankSearchResults', () => {
  const studyGuide = result({
    googleBooksId: 'guide',
    title: 'Study Guide: Pet Sematary by Stephen King',
    authors: ['SuperSummary'],
    coverUrl: 'https://x/guide.jpg',
    isbn: '1',
    pageCount: 52
  })
  const translation = result({
    googleBooksId: 'es',
    title: 'Cementerio de animales',
    authors: ['Stephen King'],
    coverUrl: 'https://x/es.jpg',
    isbn: '2',
    pageCount: 520
  })
  const kingEdition = result({
    googleBooksId: 'king',
    title: 'Pet Sematary',
    authors: ['Stephen King'],
    coverUrl: 'https://x/king.jpg',
    isbn: '3',
    pageCount: 416
  })

  it('should put the exact-title Stephen King edition first for "pet sematary"', () => {
    const ranked = rankSearchResults([studyGuide, translation, kingEdition], {
      query: 'pet sematary'
    })

    expect(ranked.map((r) => r.googleBooksId)).toEqual(['king', 'guide', 'es'])
  })

  it('should keep every result (all editions) and not mutate the input array', () => {
    const input = [studyGuide, translation, kingEdition]

    const ranked = rankSearchResults(input, { query: 'pet sematary' })

    expect(ranked).toHaveLength(3)
    expect(input.map((r) => r.googleBooksId)).toEqual(['guide', 'es', 'king'])
  })

  it('should keep the original order between results with the same score', () => {
    const first = result({ googleBooksId: '1', title: 'Otro libro' })
    const second = result({ googleBooksId: '2', title: 'Otro libro' })

    const ranked = rankSearchResults([first, second], { query: 'nada que ver' })

    expect(ranked.map((r) => r.googleBooksId)).toEqual(['1', '2'])
  })

  it('should rank the books by the requested author first when searching by author only', () => {
    const ranked = rankSearchResults([studyGuide, translation], { query: '', author: 'Stephen King' })

    expect(ranked[0]?.googleBooksId).toBe('es')
  })
})

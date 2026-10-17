import { describe, it, expect } from 'vitest'
import {
  Book,
  BookStatus,
  FutureFinishedDateError,
  InvalidFinishedDateError,
  isAfterToday,
  parseIsoDate,
  toCalendarNoon,
  toIsoDate,
  todayIsoDate
} from '../../src/shared/domain/index.js'

function daysFromToday(days: number): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, 9, 30)
}

function readingBook(): Book {
  return new Book({
    id: 1,
    title: 'Rayuela',
    authors: 'Julio Cortázar',
    pageCount: 600,
    currentPage: 120,
    status: BookStatus.READING
  })
}

describe('Feature #20 — CalendarDate helpers', () => {
  it('should parse YYYY-MM-DD into local noon of that day', () => {
    const parsed = parseIsoDate('2026-10-17')
    expect(parsed).not.toBeNull()
    expect(parsed?.getFullYear()).toBe(2026)
    expect(parsed?.getMonth()).toBe(9)
    expect(parsed?.getDate()).toBe(17)
    expect(parsed?.getHours()).toBe(12)
  })

  it('should reject malformed or non-existent dates', () => {
    expect(parseIsoDate('17/10/2026')).toBeNull()
    expect(parseIsoDate('2026-02-30')).toBeNull()
    expect(parseIsoDate('2026-13-01')).toBeNull()
    expect(parseIsoDate('')).toBeNull()
  })

  it('should format using the local calendar day, not UTC', () => {
    const lateNight = new Date(2026, 9, 17, 23, 30)
    expect(toIsoDate(lateNight)).toBe('2026-10-17')
    const earlyMorning = new Date(2026, 9, 17, 0, 15)
    expect(toIsoDate(earlyMorning)).toBe('2026-10-17')
  })

  it('should normalize any time of day to local noon of the same day', () => {
    const normalized = toCalendarNoon(new Date(2026, 9, 17, 23, 59))
    expect(toIsoDate(normalized)).toBe('2026-10-17')
    expect(normalized.getHours()).toBe(12)
  })

  it('should compare against today by calendar day', () => {
    expect(isAfterToday(daysFromToday(1))).toBe(true)
    expect(isAfterToday(daysFromToday(0))).toBe(false)
    expect(isAfterToday(new Date(new Date().setHours(23, 59, 0, 0)))).toBe(false)
    expect(isAfterToday(daysFromToday(-1))).toBe(false)
  })
})

describe('Feature #20 — Book.finishedAt', () => {
  it('should default finishedAt to today when a book is created as FINISHED', () => {
    const book = Book.create({ title: 'Ficciones', authors: 'Borges', status: BookStatus.FINISHED })
    expect(book.finishedAt).not.toBeNull()
    expect(toIsoDate(book.finishedAt as Date)).toBe(todayIsoDate())
    expect(book.finishedAt?.getHours()).toBe(12)
  })

  it('should use the given date when a book is created as FINISHED', () => {
    const book = Book.create({
      title: 'Ficciones',
      authors: 'Borges',
      status: BookStatus.FINISHED,
      finishedAt: new Date(2025, 4, 3, 22, 0)
    })
    expect(toIsoDate(book.finishedAt as Date)).toBe('2025-05-03')
  })

  it('should not assign finishedAt when a book is created with another status', () => {
    const book = Book.create({
      title: 'Ficciones',
      authors: 'Borges',
      status: BookStatus.READING,
      finishedAt: new Date(2025, 4, 3)
    })
    expect(book.finishedAt).toBeNull()
  })

  it('should reject a future finished date on creation with a typed error', () => {
    expect(() =>
      Book.create({
        title: 'Ficciones',
        authors: 'Borges',
        status: BookStatus.FINISHED,
        finishedAt: daysFromToday(1)
      })
    ).toThrow(FutureFinishedDateError)
  })

  it('should reject a future finishedAt in the constructor', () => {
    expect(
      () =>
        new Book({
          title: 'Ficciones',
          authors: 'Borges',
          status: BookStatus.FINISHED,
          finishedAt: daysFromToday(2)
        })
    ).toThrow(FutureFinishedDateError)
  })

  it('should assign today when transitioning to FINISHED without a date', () => {
    const book = readingBook()
    book.updateStatus(BookStatus.FINISHED)
    expect(toIsoDate(book.finishedAt as Date)).toBe(todayIsoDate())
    expect(book.progressPercentage).toBe(100)
  })

  it('should assign the given date when transitioning to FINISHED', () => {
    const book = readingBook()
    book.updateStatus(BookStatus.FINISHED, new Date(2026, 0, 15))
    expect(toIsoDate(book.finishedAt as Date)).toBe('2026-01-15')
  })

  it('should reject a future date when transitioning to FINISHED', () => {
    const book = readingBook()
    expect(() => book.updateStatus(BookStatus.FINISHED, daysFromToday(1))).toThrow(
      FutureFinishedDateError
    )
    expect(book.status).toBe(BookStatus.READING)
    expect(book.finishedAt).toBeNull()
  })

  it('should reject a finished date when the target status is not FINISHED', () => {
    const book = readingBook()
    expect(() => book.updateStatus(BookStatus.PAUSED, new Date(2026, 0, 1))).toThrow(
      InvalidFinishedDateError
    )
  })

  it('should preserve finishedAt when the book leaves FINISHED', () => {
    const book = readingBook()
    book.updateStatus(BookStatus.FINISHED, new Date(2026, 0, 15))
    book.updateStatus(BookStatus.READING)
    expect(book.status).toBe(BookStatus.READING)
    expect(toIsoDate(book.finishedAt as Date)).toBe('2026-01-15')
  })

  it('should overwrite finishedAt when the book is finished again', () => {
    const book = readingBook()
    book.updateStatus(BookStatus.FINISHED, new Date(2026, 0, 15))
    book.updateStatus(BookStatus.READING)
    book.updateStatus(BookStatus.FINISHED, new Date(2026, 2, 1))
    expect(toIsoDate(book.finishedAt as Date)).toBe('2026-03-01')

    book.updateStatus(BookStatus.READING)
    book.updateStatus(BookStatus.FINISHED)
    expect(toIsoDate(book.finishedAt as Date)).toBe(todayIsoDate())
  })

  it('should keep the existing date when re-applying FINISHED without a date', () => {
    const book = readingBook()
    book.updateStatus(BookStatus.FINISHED, new Date(2026, 0, 15))
    book.updateStatus(BookStatus.FINISHED)
    expect(toIsoDate(book.finishedAt as Date)).toBe('2026-01-15')
  })

  it('should edit the finished date of a finished book', () => {
    const book = readingBook()
    book.updateStatus(BookStatus.FINISHED)
    book.setFinishedDate(new Date(2025, 11, 31, 8))
    expect(toIsoDate(book.finishedAt as Date)).toBe('2025-12-31')
    expect(book.finishedAt?.getHours()).toBe(12)
  })

  it('should reject editing the finished date to a future day', () => {
    const book = readingBook()
    book.updateStatus(BookStatus.FINISHED, new Date(2026, 0, 15))
    expect(() => book.setFinishedDate(daysFromToday(1))).toThrow(FutureFinishedDateError)
    expect(toIsoDate(book.finishedAt as Date)).toBe('2026-01-15')
  })

  it('should reject editing the finished date of a book that is not finished', () => {
    const book = readingBook()
    expect(() => book.setFinishedDate(new Date(2026, 0, 15))).toThrow(InvalidFinishedDateError)
  })

  it('should parse the IPC date text or throw a typed error', () => {
    expect(toIsoDate(Book.parseFinishedDate('2026-04-09'))).toBe('2026-04-09')
    expect(() => Book.parseFinishedDate('09/04/2026')).toThrow(InvalidFinishedDateError)
  })

  it('should round-trip finishedAt through primitives', () => {
    const book = readingBook()
    book.updateStatus(BookStatus.FINISHED, new Date(2026, 0, 15))
    const restored = Book.fromPrimitives(book.toPrimitives())
    expect(restored.finishedAt?.getTime()).toBe(book.finishedAt?.getTime())
    expect(book.toPrimitives().finishedAt).toEqual(book.finishedAt)
  })
})

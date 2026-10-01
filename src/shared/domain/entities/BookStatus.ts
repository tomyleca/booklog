export const BookStatus = {
  TO_READ: 'TO_READ',
  READING: 'READING',
  PAUSED: 'PAUSED',
  FINISHED: 'FINISHED',
  ABANDONED: 'ABANDONED'
} as const

export type BookStatus = (typeof BookStatus)[keyof typeof BookStatus]

export const ALL_BOOK_STATUSES: readonly BookStatus[] = Object.values(BookStatus)

export function isBookStatus(value: unknown): value is BookStatus {
  return typeof value === 'string' && ALL_BOOK_STATUSES.includes(value as BookStatus)
}

export const NoteOrigin = {
  MANUAL: 'MANUAL',
  KINDLE: 'KINDLE'
} as const

export type NoteOrigin = (typeof NoteOrigin)[keyof typeof NoteOrigin]

export const ALL_NOTE_ORIGINS: readonly NoteOrigin[] = Object.values(NoteOrigin)

export function isNoteOrigin(value: unknown): value is NoteOrigin {
  return typeof value === 'string' && ALL_NOTE_ORIGINS.includes(value as NoteOrigin)
}

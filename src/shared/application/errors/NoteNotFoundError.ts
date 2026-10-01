export class NoteNotFoundError extends Error {
  public readonly noteId: number

  constructor(noteId: number) {
    super(`Nota con ID ${noteId} no encontrada.`)
    this.name = 'NoteNotFoundError'
    this.noteId = noteId

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NoteNotFoundError)
    }
  }
}

export class HighlightNotFoundError extends Error {
  public readonly highlightId: number

  constructor(highlightId: number) {
    super(`Subrayado con ID ${highlightId} no encontrado.`)
    this.name = 'HighlightNotFoundError'
    this.highlightId = highlightId

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, HighlightNotFoundError)
    }
  }
}

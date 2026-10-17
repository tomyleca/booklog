export class DomainError extends Error {
  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
  }
}

export class InvalidBookError extends DomainError {
  constructor(message: string) {
    super(message)
  }
}

export class InvalidNoteError extends DomainError {
  constructor(message: string) {
    super(message)
  }
}

export class InvalidProgressError extends DomainError {
  constructor(message: string) {
    super(message)
  }
}

export class InvalidFinishedDateError extends DomainError {
  constructor(message: string) {
    super(message)
  }
}

export class FutureFinishedDateError extends DomainError {
  constructor() {
    super('La fecha de terminado no puede ser posterior a hoy.')
  }
}

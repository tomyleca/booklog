import { InvalidNoteError } from '../errors/DomainErrors.js'
import { createAnnotationLocation } from './AnnotationLocation.js'
import type { AnnotationLocation, AnnotationLocationInput } from './AnnotationLocation.js'
import { isValidDate } from './CalendarDate.js'
import { NoteOrigin, isNoteOrigin } from './NoteOrigin.js'

/**
 * Una nota es siempre algo escrito por el usuario (feature #22): a mano en BookLog
 * (`MANUAL`) o en el Kindle (`KINDLE`). Los metadatos de importación (ubicación, fecha
 * del dispositivo y huella) solo existen en las notas del Kindle.
 */
export interface NoteProps {
  id?: number
  bookId: number
  content: string
  origin?: NoteOrigin
  highlightId?: number | null
  location?: AnnotationLocationInput | null
  capturedAt?: Date | null
  fingerprint?: string | null
  createdAt?: Date
  updatedAt?: Date
}

export interface NotePrimitives {
  id?: number
  bookId: number
  content: string
  origin: NoteOrigin
  highlightId: number | null
  location: AnnotationLocation | null
  capturedAt: Date | null
  fingerprint: string | null
  createdAt?: Date
  updatedAt?: Date
}

export interface ImportedNoteProps {
  bookId: number
  content: string
  location: AnnotationLocationInput
  capturedAt?: Date | null
  fingerprint: string
  highlightId?: number | null
}

export class Note {
  private _id?: number
  private _bookId: number
  private _content: string
  private _origin: NoteOrigin
  private _highlightId: number | null
  private _location: AnnotationLocation | null
  private _capturedAt: Date | null
  private _fingerprint: string | null
  private _createdAt: Date
  private _updatedAt: Date

  constructor(props: NoteProps) {
    this.validateBookId(props.bookId)
    this.validateContent(props.content)

    const origin = props.origin ?? NoteOrigin.MANUAL
    if (!isNoteOrigin(origin)) {
      throw new InvalidNoteError(`Origen de nota inválido: ${String(origin)}.`)
    }

    const highlightId = props.highlightId ?? null
    if (highlightId !== null && (!Number.isInteger(highlightId) || highlightId <= 0)) {
      throw new InvalidNoteError('El highlightId debe ser un número entero positivo.')
    }

    const location = props.location ? createAnnotationLocation(props.location) : null

    const capturedAt = props.capturedAt ?? null
    if (capturedAt !== null && !isValidDate(capturedAt)) {
      throw new InvalidNoteError('La fecha de la nota en el dispositivo no es válida.')
    }

    const fingerprint = this.normalizeFingerprint(props.fingerprint)

    if (origin === NoteOrigin.MANUAL && (location || capturedAt || fingerprint)) {
      throw new InvalidNoteError(
        'Una nota manual no puede tener ubicación, fecha del dispositivo ni huella.'
      )
    }
    if (origin === NoteOrigin.KINDLE && fingerprint === null) {
      throw new InvalidNoteError('Una nota importada del Kindle necesita una huella.')
    }

    this._id = props.id
    this._bookId = props.bookId
    this._content = props.content.trim()
    this._origin = origin
    this._highlightId = highlightId
    this._location = location
    this._capturedAt = capturedAt
    this._fingerprint = fingerprint
    this._createdAt = props.createdAt ?? new Date()
    this._updatedAt = props.updatedAt ?? new Date()
  }

  public static create(props: { bookId: number; content: string }): Note {
    return new Note({
      bookId: props.bookId,
      content: props.content,
      origin: NoteOrigin.MANUAL,
      createdAt: new Date(),
      updatedAt: new Date()
    })
  }

  /** Nota escrita en el Kindle; la usa la importación (feature #23). */
  public static createImported(props: ImportedNoteProps): Note {
    return new Note({
      ...props,
      origin: NoteOrigin.KINDLE,
      createdAt: new Date(),
      updatedAt: new Date()
    })
  }

  public static fromPrimitives(primitives: NotePrimitives): Note {
    return new Note({
      id: primitives.id,
      bookId: primitives.bookId,
      content: primitives.content,
      origin: primitives.origin,
      highlightId: primitives.highlightId,
      location: primitives.location,
      capturedAt: primitives.capturedAt ? new Date(primitives.capturedAt) : null,
      fingerprint: primitives.fingerprint,
      createdAt: primitives.createdAt ? new Date(primitives.createdAt) : undefined,
      updatedAt: primitives.updatedAt ? new Date(primitives.updatedAt) : undefined
    })
  }

  public toPrimitives(): NotePrimitives {
    return {
      id: this._id,
      bookId: this._bookId,
      content: this._content,
      origin: this._origin,
      highlightId: this._highlightId,
      location: this._location,
      capturedAt: this._capturedAt,
      fingerprint: this._fingerprint,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt
    }
  }

  public updateContent(content: string): void {
    this.validateContent(content)
    this._content = content.trim()
    this._updatedAt = new Date()
  }

  private validateBookId(bookId: number): void {
    if (typeof bookId !== 'number' || !Number.isInteger(bookId) || bookId <= 0) {
      throw new InvalidNoteError('El bookId debe ser un número entero positivo mayor a 0.')
    }
  }

  private validateContent(content: string): void {
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new InvalidNoteError('El contenido de la nota no puede estar vacío.')
    }
  }

  private normalizeFingerprint(fingerprint: string | null | undefined): string | null {
    if (fingerprint === undefined || fingerprint === null) return null
    if (typeof fingerprint !== 'string' || fingerprint.trim().length === 0) {
      throw new InvalidNoteError('La huella de la nota no puede estar vacía.')
    }
    return fingerprint.trim()
  }

  get id(): number | undefined {
    return this._id
  }

  get bookId(): number {
    return this._bookId
  }

  get content(): string {
    return this._content
  }

  get origin(): NoteOrigin {
    return this._origin
  }

  get highlightId(): number | null {
    return this._highlightId
  }

  get location(): AnnotationLocation | null {
    return this._location
  }

  get capturedAt(): Date | null {
    return this._capturedAt
  }

  get fingerprint(): string | null {
    return this._fingerprint
  }

  get createdAt(): Date {
    return this._createdAt
  }

  get updatedAt(): Date {
    return this._updatedAt
  }
}

import { InvalidHighlightError } from '../errors/DomainErrors.js'
import { createAnnotationLocation } from './AnnotationLocation.js'
import type { AnnotationLocation, AnnotationLocationInput } from './AnnotationLocation.js'
import { isValidDate } from './CalendarDate.js'

/**
 * Un subrayado: texto resaltado del libro (no escrito por el usuario). Hoy llegan solo
 * por importación del Kindle (feature #23), por eso la huella es obligatoria: es lo que
 * permite reimportar el mismo archivo sin duplicar.
 */
export interface HighlightProps {
  id?: number
  bookId: number
  content: string
  location: AnnotationLocationInput
  /** Momento en que se subrayó en el dispositivo; `null` si no se pudo determinar. */
  capturedAt?: Date | null
  fingerprint: string
  createdAt?: Date
}

export interface HighlightPrimitives {
  id?: number
  bookId: number
  content: string
  location: AnnotationLocation
  capturedAt: Date | null
  fingerprint: string
  createdAt?: Date
}

export class Highlight {
  private readonly _id?: number
  private readonly _bookId: number
  private readonly _content: string
  private readonly _location: AnnotationLocation
  private readonly _capturedAt: Date | null
  private readonly _fingerprint: string
  private readonly _createdAt: Date

  constructor(props: HighlightProps) {
    if (!Number.isInteger(props.bookId) || props.bookId <= 0) {
      throw new InvalidHighlightError('El bookId debe ser un número entero positivo mayor a 0.')
    }
    if (typeof props.content !== 'string' || props.content.trim().length === 0) {
      throw new InvalidHighlightError('El texto del subrayado no puede estar vacío.')
    }
    if (typeof props.fingerprint !== 'string' || props.fingerprint.trim().length === 0) {
      throw new InvalidHighlightError('La huella del subrayado no puede estar vacía.')
    }
    const capturedAt = props.capturedAt ?? null
    if (capturedAt !== null && !isValidDate(capturedAt)) {
      throw new InvalidHighlightError('La fecha del subrayado no es válida.')
    }

    this._id = props.id
    this._bookId = props.bookId
    this._content = props.content.trim()
    this._location = createAnnotationLocation(props.location)
    this._capturedAt = capturedAt
    this._fingerprint = props.fingerprint.trim()
    this._createdAt = props.createdAt ?? new Date()
  }

  public static create(props: Omit<HighlightProps, 'id' | 'createdAt'>): Highlight {
    return new Highlight({ ...props, createdAt: new Date() })
  }

  public static fromPrimitives(primitives: HighlightPrimitives): Highlight {
    return new Highlight({
      id: primitives.id,
      bookId: primitives.bookId,
      content: primitives.content,
      location: primitives.location,
      capturedAt: primitives.capturedAt ? new Date(primitives.capturedAt) : null,
      fingerprint: primitives.fingerprint,
      createdAt: primitives.createdAt ? new Date(primitives.createdAt) : undefined
    })
  }

  public toPrimitives(): HighlightPrimitives {
    return {
      id: this._id,
      bookId: this._bookId,
      content: this._content,
      location: this._location,
      capturedAt: this._capturedAt,
      fingerprint: this._fingerprint,
      createdAt: this._createdAt
    }
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

  get location(): AnnotationLocation {
    return this._location
  }

  get capturedAt(): Date | null {
    return this._capturedAt
  }

  get fingerprint(): string {
    return this._fingerprint
  }

  get createdAt(): Date {
    return this._createdAt
  }
}

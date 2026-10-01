import { InvalidNoteError } from '../errors/DomainErrors.js'

export interface NoteProps {
  id?: number
  bookId: number
  content: string
  createdAt?: Date
  updatedAt?: Date
}

export interface NotePrimitives {
  id?: number
  bookId: number
  content: string
  createdAt?: Date
  updatedAt?: Date
}

export class Note {
  private _id?: number
  private _bookId: number
  private _content: string
  private _createdAt: Date
  private _updatedAt: Date

  constructor(props: NoteProps) {
    this.validateBookId(props.bookId)
    this.validateContent(props.content)

    this._id = props.id
    this._bookId = props.bookId
    this._content = props.content.trim()
    this._createdAt = props.createdAt ?? new Date()
    this._updatedAt = props.updatedAt ?? new Date()
  }

  public static create(props: {
    bookId: number
    content: string
  }): Note {
    return new Note({
      bookId: props.bookId,
      content: props.content,
      createdAt: new Date(),
      updatedAt: new Date()
    })
  }

  public static fromPrimitives(primitives: NotePrimitives): Note {
    return new Note({
      id: primitives.id,
      bookId: primitives.bookId,
      content: primitives.content,
      createdAt: primitives.createdAt ? new Date(primitives.createdAt) : undefined,
      updatedAt: primitives.updatedAt ? new Date(primitives.updatedAt) : undefined
    })
  }

  public toPrimitives(): NotePrimitives {
    return {
      id: this._id,
      bookId: this._bookId,
      content: this._content,
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

  get id(): number | undefined {
    return this._id
  }

  get bookId(): number {
    return this._bookId
  }

  get content(): string {
    return this._content
  }

  get createdAt(): Date {
    return this._createdAt
  }

  get updatedAt(): Date {
    return this._updatedAt
  }
}


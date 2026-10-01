import { BookStatus, isBookStatus } from './BookStatus.js'
import { Note, NotePrimitives } from './Note.js'
import { InvalidBookError, InvalidProgressError } from '../errors/DomainErrors.js'

export interface BookProps {
  id?: number
  googleBooksId?: string | null
  title: string
  authors: string | string[]
  coverUrl?: string | null
  coverPath?: string | null
  pageCount?: number | null
  currentPage?: number | null
  progressPercentage?: number | null
  isbn?: string | null
  status?: BookStatus
  rating?: number | null
  createdAt?: Date
  updatedAt?: Date
  notes?: Note[]
}

export interface BookPrimitives {
  id?: number
  googleBooksId?: string | null
  title: string
  authors: string
  coverUrl?: string | null
  coverPath?: string | null
  pageCount?: number | null
  currentPage?: number | null
  progressPercentage?: number | null
  isbn?: string | null
  status: BookStatus
  rating?: number | null
  createdAt?: Date
  updatedAt?: Date
  notes?: NotePrimitives[]
}

export class Book {
  private _id?: number
  private _googleBooksId?: string | null
  private _title: string
  private _authors: string
  private _coverUrl?: string | null
  private _coverPath?: string | null
  private _pageCount?: number | null
  private _currentPage?: number | null
  private _progressPercentage?: number | null
  private _isbn?: string | null
  private _status: BookStatus
  private _rating?: number | null
  private _createdAt: Date
  private _updatedAt: Date
  private _notes: Note[]

  constructor(props: BookProps) {
    this.validateTitle(props.title)
    const authorsStr = Array.isArray(props.authors)
      ? props.authors.map((a) => a.trim()).filter(Boolean).join(', ')
      : props.authors
    this.validateAuthors(authorsStr)

    const status = props.status ?? BookStatus.TO_READ
    this.validateStatus(status)

    this.validateRating(props.rating)
    this.validatePageCount(props.pageCount)

    this._id = props.id
    this._googleBooksId = props.googleBooksId ?? null
    this._title = props.title.trim()
    this._authors = authorsStr.trim()
    this._coverUrl = props.coverUrl ?? null
    this._coverPath = props.coverPath ?? null
    this._pageCount = props.pageCount ?? null
    this._isbn = props.isbn ?? null
    this._status = status
    this._rating = props.rating ?? null
    this._createdAt = props.createdAt ?? new Date()
    this._updatedAt = props.updatedAt ?? new Date()
    this._notes = props.notes ? [...props.notes] : []

    // Progress initialization & validation
    this.initializeProgress(props.currentPage, props.progressPercentage)

    if (this._status === BookStatus.FINISHED) {
      this._progressPercentage = 100
      if (this._pageCount !== null && this._pageCount !== undefined) {
        this._currentPage = this._pageCount
      }
    }
  }

  public static create(props: {
    title: string
    authors: string | string[]
    googleBooksId?: string | null
    coverUrl?: string | null
    coverPath?: string | null
    pageCount?: number | null
    currentPage?: number | null
    progressPercentage?: number | null
    isbn?: string | null
    status?: BookStatus
    rating?: number | null
    notes?: Note[]
  }): Book {
    return new Book({
      ...props,
      createdAt: new Date(),
      updatedAt: new Date()
    })
  }

  public static fromPrimitives(primitives: BookPrimitives): Book {
    return new Book({
      id: primitives.id,
      googleBooksId: primitives.googleBooksId,
      title: primitives.title,
      authors: primitives.authors,
      coverUrl: primitives.coverUrl,
      coverPath: primitives.coverPath,
      pageCount: primitives.pageCount,
      currentPage: primitives.currentPage,
      progressPercentage: primitives.progressPercentage,
      isbn: primitives.isbn,
      status: primitives.status,
      rating: primitives.rating,
      createdAt: primitives.createdAt ? new Date(primitives.createdAt) : undefined,
      updatedAt: primitives.updatedAt ? new Date(primitives.updatedAt) : undefined,
      notes: primitives.notes?.map((n) => Note.fromPrimitives(n))
    })
  }

  public toPrimitives(): BookPrimitives {
    return {
      id: this._id,
      googleBooksId: this._googleBooksId ?? null,
      title: this._title,
      authors: this._authors,
      coverUrl: this._coverUrl ?? null,
      coverPath: this._coverPath ?? null,
      pageCount: this._pageCount ?? null,
      currentPage: this._currentPage ?? null,
      progressPercentage: this._progressPercentage ?? null,
      isbn: this._isbn ?? null,
      status: this._status,
      rating: this._rating ?? null,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
      notes: this._notes.map((n) => n.toPrimitives())
    }
  }

  public updateProgressByPage(currentPage: number): void {
    if (typeof currentPage !== 'number' || !Number.isInteger(currentPage) || currentPage < 0) {
      throw new InvalidProgressError('La página actual debe ser un número entero mayor o igual a 0.')
    }

    if (this._pageCount !== null && this._pageCount !== undefined) {
      if (currentPage > this._pageCount) {
        throw new InvalidProgressError('La página actual no puede superar el total de páginas.')
      }
      this._progressPercentage = Math.round((currentPage / this._pageCount) * 100)
    }

    this._currentPage = currentPage
    this._updatedAt = new Date()
  }

  public updateProgressByPercentage(progressPercentage: number): void {
    if (
      typeof progressPercentage !== 'number' ||
      Number.isNaN(progressPercentage) ||
      progressPercentage < 0 ||
      progressPercentage > 100
    ) {
      throw new InvalidProgressError('El porcentaje de progreso debe ser un número entre 0 y 100.')
    }

    const roundedPercentage = Math.round(progressPercentage)
    this._progressPercentage = roundedPercentage

    if (this._pageCount !== null && this._pageCount !== undefined) {
      this._currentPage = Math.round((roundedPercentage / 100) * this._pageCount)
    }

    this._updatedAt = new Date()
  }

  public updateStatus(status: BookStatus): void {
    this.validateStatus(status)
    this._status = status

    if (status === BookStatus.FINISHED) {
      this._progressPercentage = 100
      if (this._pageCount !== null && this._pageCount !== undefined) {
        this._currentPage = this._pageCount
      }
    }
    // Note: When transitioning to TO_READ or other statuses, existing progress is preserved.

    this._updatedAt = new Date()
  }

  public updateRating(rating: number | null | undefined): void {
    this.validateRating(rating)
    this._rating = rating ?? null
    this._updatedAt = new Date()
  }

  public updateNotes(notes: Note[]): void {
    this._notes = [...notes]
    this._updatedAt = new Date()
  }

  public addNote(note: Note): void {
    this._notes.push(note)
    this._updatedAt = new Date()
  }

  private validateTitle(title: string): void {
    if (typeof title !== 'string' || title.trim().length === 0) {
      throw new InvalidBookError('El título del libro no puede estar vacío.')
    }
  }

  private validateAuthors(authors: string): void {
    if (typeof authors !== 'string' || authors.trim().length === 0) {
      throw new InvalidBookError('El autor del libro no puede estar vacío.')
    }
  }

  private validateStatus(status: unknown): void {
    if (!isBookStatus(status)) {
      throw new InvalidBookError(`El estado "${String(status)}" no es un estado de libro válido.`)
    }
  }

  private validateRating(rating?: number | null): void {
    if (rating !== undefined && rating !== null) {
      if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw new InvalidBookError('La calificación debe ser un número entero entre 1 y 5.')
      }
    }
  }

  private validatePageCount(pageCount?: number | null): void {
    if (pageCount !== undefined && pageCount !== null) {
      if (typeof pageCount !== 'number' || !Number.isInteger(pageCount) || pageCount < 1) {
        throw new InvalidProgressError('La cantidad total de páginas debe ser un entero mayor o igual a 1.')
      }
    }
  }

  private initializeProgress(
    currentPage?: number | null,
    progressPercentage?: number | null
  ): void {
    if (currentPage !== undefined && currentPage !== null) {
      if (typeof currentPage !== 'number' || !Number.isInteger(currentPage) || currentPage < 0) {
        throw new InvalidProgressError('La página actual debe ser un número entero mayor o igual a 0.')
      }
      if (this._pageCount !== null && this._pageCount !== undefined && currentPage > this._pageCount) {
        throw new InvalidProgressError('La página actual no puede superar el total de páginas.')
      }
    }

    if (progressPercentage !== undefined && progressPercentage !== null) {
      if (
        typeof progressPercentage !== 'number' ||
        Number.isNaN(progressPercentage) ||
        progressPercentage < 0 ||
        progressPercentage > 100
      ) {
        throw new InvalidProgressError('El porcentaje de progreso debe ser un número entre 0 y 100.')
      }
    }

    if (this._pageCount !== null && this._pageCount !== undefined) {
      if (currentPage !== undefined && currentPage !== null) {
        this._currentPage = currentPage
        this._progressPercentage = Math.round((currentPage / this._pageCount) * 100)
      } else if (progressPercentage !== undefined && progressPercentage !== null) {
        const rounded = Math.round(progressPercentage)
        this._progressPercentage = rounded
        this._currentPage = Math.round((rounded / 100) * this._pageCount)
      } else {
        this._currentPage = null
        this._progressPercentage = null
      }
    } else {
      this._currentPage = currentPage ?? null
      this._progressPercentage =
        progressPercentage !== undefined && progressPercentage !== null
          ? Math.round(progressPercentage)
          : null
    }
  }

  get id(): number | undefined {
    return this._id
  }

  get googleBooksId(): string | null | undefined {
    return this._googleBooksId
  }

  get title(): string {
    return this._title
  }

  get authors(): string {
    return this._authors
  }

  get coverUrl(): string | null | undefined {
    return this._coverUrl
  }

  get coverPath(): string | null | undefined {
    return this._coverPath
  }

  get pageCount(): number | null | undefined {
    return this._pageCount
  }

  get currentPage(): number | null | undefined {
    return this._currentPage
  }

  get progressPercentage(): number | null | undefined {
    return this._progressPercentage
  }

  get isbn(): string | null | undefined {
    return this._isbn
  }

  get status(): BookStatus {
    return this._status
  }

  get rating(): number | null | undefined {
    return this._rating
  }

  get createdAt(): Date {
    return this._createdAt
  }

  get updatedAt(): Date {
    return this._updatedAt
  }

  get notes(): Note[] {
    return [...this._notes]
  }
}

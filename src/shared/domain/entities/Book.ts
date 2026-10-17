import { BookStatus, isBookStatus } from './BookStatus.js'
import { Note, NotePrimitives } from './Note.js'
import { isAfterToday, isValidDate, parseIsoDate, toCalendarNoon } from './CalendarDate.js'
import {
  FutureFinishedDateError,
  InvalidBookError,
  InvalidFinishedDateError,
  InvalidProgressError
} from '../errors/DomainErrors.js'

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
  finishedAt?: Date | null
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
  finishedAt?: Date | null
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
  private _finishedAt: Date | null
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
    this.validateFinishedAt(props.finishedAt)

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
    this._finishedAt = props.finishedAt ?? null
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
    finishedAt?: Date | null
    notes?: Note[]
  }): Book {
    const now = new Date()
    // Un libro sólo nace con fecha de terminado si nace terminado; si no se indica, es hoy.
    const finishedAt =
      props.status === BookStatus.FINISHED
        ? toCalendarNoon(props.finishedAt ?? now)
        : null
    return new Book({
      ...props,
      finishedAt,
      createdAt: now,
      updatedAt: now
    })
  }

  /**
   * Convierte el texto `YYYY-MM-DD` que llega por IPC en la fecha de terminado del dominio.
   */
  public static parseFinishedDate(value: string): Date {
    const parsed = parseIsoDate(value)
    if (!parsed) {
      throw new InvalidFinishedDateError(
        `La fecha de terminado "${String(value)}" no es una fecha válida (formato AAAA-MM-DD).`
      )
    }
    return parsed
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
      finishedAt: primitives.finishedAt ? new Date(primitives.finishedAt) : null,
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
      finishedAt: this._finishedAt,
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

  /**
   * Cambia el estado. Al pasar a FINISHED se asigna la fecha de terminado: la indicada o,
   * si no se indica, hoy. Si el libro ya estaba FINISHED y no se indica fecha, se conserva
   * la que tenía. Al salir de FINISHED la fecha se conserva (se sobrescribe al volver a
   * terminarlo).
   */
  public updateStatus(status: BookStatus, finishedAt?: Date): void {
    this.validateStatus(status)
    if (finishedAt !== undefined && status !== BookStatus.FINISHED) {
      throw new InvalidFinishedDateError(
        'Sólo se puede indicar la fecha de terminado al marcar el libro como terminado.'
      )
    }

    if (status === BookStatus.FINISHED) {
      if (finishedAt !== undefined) {
        this.assignFinishedAt(finishedAt)
      } else if (this._status !== BookStatus.FINISHED) {
        this._finishedAt = toCalendarNoon(new Date())
      }
      this._progressPercentage = 100
      if (this._pageCount !== null && this._pageCount !== undefined) {
        this._currentPage = this._pageCount
      }
    }
    // Note: When transitioning to TO_READ or other statuses, existing progress is preserved.

    this._status = status
    this._updatedAt = new Date()
  }

  /** Edita la fecha de terminado de un libro que ya está terminado. */
  public setFinishedDate(finishedAt: Date): void {
    if (this._status !== BookStatus.FINISHED) {
      throw new InvalidFinishedDateError(
        'Sólo se puede editar la fecha de terminado de un libro terminado.'
      )
    }
    this.assignFinishedAt(finishedAt)
    this._updatedAt = new Date()
  }

  private assignFinishedAt(finishedAt: Date): void {
    this.validateFinishedAt(finishedAt)
    this._finishedAt = toCalendarNoon(finishedAt)
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

  private validateFinishedAt(finishedAt?: Date | null): void {
    if (finishedAt === undefined || finishedAt === null) return
    if (!isValidDate(finishedAt)) {
      throw new InvalidFinishedDateError('La fecha de terminado no es una fecha válida.')
    }
    if (isAfterToday(finishedAt)) {
      throw new FutureFinishedDateError()
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

  get finishedAt(): Date | null {
    return this._finishedAt
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

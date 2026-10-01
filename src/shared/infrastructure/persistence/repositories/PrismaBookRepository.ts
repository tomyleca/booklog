import { PrismaClient, Prisma, BookStatus as PrismaBookStatus } from '@prisma/client'
import { Book } from '../../../domain/entities/Book.js'
import { BookStatus } from '../../../domain/entities/BookStatus.js'
import { BookRepository } from '../../../domain/ports/BookRepository.js'
import { BookMapper } from '../mappers/BookMapper.js'

export class PrismaBookRepository implements BookRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async findAll(): Promise<Book[]> {
    const rawBooks = await this.prisma.book.findMany({
      orderBy: {
        updatedAt: 'desc'
      }
    })

    return rawBooks.map((raw) => BookMapper.toDomain(raw))
  }

  public async findById(id: number): Promise<Book | null> {
    const rawBook = await this.prisma.book.findUnique({
      where: { id }
    })

    if (!rawBook) {
      return null
    }

    return BookMapper.toDomain(rawBook)
  }

  public async findByStatus(status: BookStatus): Promise<Book[]> {
    const rawBooks = await this.prisma.book.findMany({
      where: {
        status: status as unknown as PrismaBookStatus
      },
      orderBy: {
        updatedAt: 'desc'
      }
    })

    return rawBooks.map((raw) => BookMapper.toDomain(raw))
  }

  public async create(book: Book): Promise<Book> {
    const persistenceData = BookMapper.toPersistence(book)
    const rawCreated = await this.prisma.book.create({
      data: persistenceData
    })

    return BookMapper.toDomain(rawCreated)
  }

  public async update(book: Book): Promise<Book> {
    if (book.id === undefined) {
      throw new Error('No se puede actualizar un libro sin ID.')
    }

    const persistenceData = BookMapper.toPersistence(book)
    const updateData = { ...persistenceData }
    delete updateData.id
    delete updateData.createdAt

    const rawUpdated = await this.prisma.book.update({
      where: { id: book.id },
      data: {
        ...updateData,
        updatedAt: new Date()
      }
    })

    return BookMapper.toDomain(rawUpdated)
  }

  public async delete(id: number): Promise<void> {
    try {
      await this.prisma.book.delete({
        where: { id }
      })
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        return
      }
      throw error
    }
  }
}

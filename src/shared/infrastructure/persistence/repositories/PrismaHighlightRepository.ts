import { PrismaClient, Prisma } from '@prisma/client'
import { Highlight } from '../../../domain/entities/Highlight.js'
import { HighlightRepository } from '../../../domain/ports/HighlightRepository.js'
import { HighlightMapper } from '../mappers/HighlightMapper.js'

export class PrismaHighlightRepository implements HighlightRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /** Orden de lectura: por ubicación dentro del libro y, a igual ubicación, por alta. */
  public async findByBookId(bookId: number): Promise<Highlight[]> {
    const rawHighlights = await this.prisma.highlight.findMany({
      where: { bookId },
      orderBy: [{ locationStart: 'asc' }, { id: 'asc' }]
    })

    return rawHighlights.map((raw) => HighlightMapper.toDomain(raw))
  }

  public async findById(id: number): Promise<Highlight | null> {
    const rawHighlight = await this.prisma.highlight.findUnique({ where: { id } })
    return rawHighlight ? HighlightMapper.toDomain(rawHighlight) : null
  }

  public async create(highlight: Highlight): Promise<Highlight> {
    const rawCreated = await this.prisma.highlight.create({
      data: HighlightMapper.toPersistence(highlight)
    })

    return HighlightMapper.toDomain(rawCreated)
  }

  public async delete(id: number): Promise<void> {
    try {
      await this.prisma.highlight.delete({ where: { id } })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return
      }
      throw error
    }
  }
}

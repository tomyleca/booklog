import { PrismaClient, Prisma } from '@prisma/client'
import { Highlight } from '../../../domain/entities/Highlight.js'
import { HighlightRepository } from '../../../domain/ports/HighlightRepository.js'
import { HighlightMapper } from '../mappers/HighlightMapper.js'

function compareStarts(a: number | undefined, b: number | undefined): number {
  if (a === b) return 0
  if (a === undefined) return 1
  if (b === undefined) return -1
  return a - b
}

function compareLocations(a: Highlight, b: Highlight): number {
  return (
    compareStarts(a.location.position?.start, b.location.position?.start) ||
    compareStarts(a.location.page?.start, b.location.page?.start)
  )
}

export class PrismaHighlightRepository implements HighlightRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Orden de lectura: por posición (la unidad más fina), luego por página y, a igual
   * ubicación, por alta. Las entradas sin posición van después de las que la tienen.
   */
  public async findByBookId(bookId: number): Promise<Highlight[]> {
    const rawHighlights = await this.prisma.highlight.findMany({
      where: { bookId },
      orderBy: [{ id: 'asc' }]
    })

    return rawHighlights
      .map((raw) => HighlightMapper.toDomain(raw))
      .sort((a, b) => compareLocations(a, b) || (a.id ?? 0) - (b.id ?? 0))
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

import { PrismaClient, Prisma } from '@prisma/client'
import { Note } from '../../../domain/entities/Note.js'
import { NoteRepository } from '../../../domain/ports/NoteRepository.js'
import { NoteMapper } from '../mappers/NoteMapper.js'

export class PrismaNoteRepository implements NoteRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async findByBookId(bookId: number): Promise<Note[]> {
    const rawNotes = await this.prisma.note.findMany({
      where: { bookId },
      orderBy: {
        createdAt: 'asc'
      }
    })

    return rawNotes.map((raw) => NoteMapper.toDomain(raw))
  }

  public async findById(id: number): Promise<Note | null> {
    const rawNote = await this.prisma.note.findUnique({
      where: { id }
    })

    if (!rawNote) {
      return null
    }

    return NoteMapper.toDomain(rawNote)
  }

  public async create(note: Note): Promise<Note> {
    const persistenceData = NoteMapper.toPersistence(note)
    const rawCreated = await this.prisma.note.create({
      data: persistenceData
    })

    return NoteMapper.toDomain(rawCreated)
  }

  public async update(note: Note): Promise<Note> {
    if (note.id === undefined) {
      throw new Error('No se puede actualizar una nota sin ID.')
    }

    const persistenceData = NoteMapper.toPersistence(note)
    const updateData = { ...persistenceData }
    delete updateData.id
    delete updateData.createdAt

    const rawUpdated = await this.prisma.note.update({
      where: { id: note.id },
      data: {
        ...updateData,
        updatedAt: new Date()
      }
    })

    return NoteMapper.toDomain(rawUpdated)
  }

  public async delete(id: number): Promise<void> {
    try {
      await this.prisma.note.delete({
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

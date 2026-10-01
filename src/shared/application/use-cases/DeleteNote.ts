import type { NoteRepository } from '../../domain/ports/NoteRepository.js'
import { NoteNotFoundError } from '../errors/NoteNotFoundError.js'

export interface DeleteNoteDTO {
  id: number
}

export class DeleteNote {
  constructor(private readonly noteRepository: NoteRepository) {}

  public async execute(dto: DeleteNoteDTO): Promise<void> {
    const note = await this.noteRepository.findById(dto.id)
    if (!note) {
      throw new NoteNotFoundError(dto.id)
    }

    await this.noteRepository.delete(dto.id)
  }
}

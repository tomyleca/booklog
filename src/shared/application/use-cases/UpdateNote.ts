import type { NoteRepository } from '../../domain/ports/NoteRepository.js'
import type { Note } from '../../domain/entities/Note.js'
import { NoteNotFoundError } from '../errors/NoteNotFoundError.js'

export interface UpdateNoteDTO {
  id: number
  content: string
}

export class UpdateNote {
  constructor(private readonly noteRepository: NoteRepository) {}

  public async execute(dto: UpdateNoteDTO): Promise<Note> {
    const note = await this.noteRepository.findById(dto.id)
    if (!note) {
      throw new NoteNotFoundError(dto.id)
    }

    note.updateContent(dto.content)

    return await this.noteRepository.update(note)
  }
}

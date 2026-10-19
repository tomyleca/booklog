import type { HighlightRepository } from '../../domain/ports/HighlightRepository.js'
import { HighlightNotFoundError } from '../errors/HighlightNotFoundError.js'

export interface DeleteHighlightDTO {
  id: number
}

/**
 * Borra un subrayado. Las notas vinculadas NO se borran: son del usuario y quedan
 * sueltas (la base pone `highlightId = NULL`, ver ADR 022).
 */
export class DeleteHighlight {
  constructor(private readonly highlightRepository: HighlightRepository) {}

  public async execute(dto: DeleteHighlightDTO): Promise<void> {
    const highlight = await this.highlightRepository.findById(dto.id)
    if (!highlight) {
      throw new HighlightNotFoundError(dto.id)
    }

    await this.highlightRepository.delete(dto.id)
  }
}

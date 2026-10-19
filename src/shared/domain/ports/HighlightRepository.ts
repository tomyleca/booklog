import { Highlight } from '../entities/Highlight.js'

export interface HighlightRepository {
  findByBookId(bookId: number): Promise<Highlight[]>
  findById(id: number): Promise<Highlight | null>
  create(highlight: Highlight): Promise<Highlight>
  delete(id: number): Promise<void>
}

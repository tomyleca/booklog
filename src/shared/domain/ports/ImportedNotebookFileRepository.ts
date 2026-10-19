import { ImportedNotebookFile } from '../entities/ImportedNotebookFile.js'

export interface ImportedNotebookFileRepository {
  findByPaths(paths: string[]): Promise<ImportedNotebookFile[]>
  /** Crea o actualiza (por ruta) el registro de un archivo importado. */
  save(file: ImportedNotebookFile): Promise<ImportedNotebookFile>
}

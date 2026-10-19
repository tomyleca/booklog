import { PrismaClient } from '@prisma/client'
import { ImportedNotebookFile } from '../../../domain/entities/ImportedNotebookFile.js'
import { ImportedNotebookFileRepository } from '../../../domain/ports/ImportedNotebookFileRepository.js'

/**
 * Exportaciones del Cuaderno ya importadas (feature #26). Vive en SQLite junto con los
 * subrayados que generó: si se borra la base, también se olvida qué se importó.
 */
export class PrismaImportedNotebookFileRepository implements ImportedNotebookFileRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async findByPaths(paths: string[]): Promise<ImportedNotebookFile[]> {
    if (paths.length === 0) return []
    const rows = await this.prisma.importedNotebookFile.findMany({
      where: { path: { in: paths } }
    })
    return rows.map(
      (row) =>
        new ImportedNotebookFile({
          path: row.path,
          modifiedAt: row.modifiedAt,
          importedAt: row.importedAt
        })
    )
  }

  public async save(file: ImportedNotebookFile): Promise<ImportedNotebookFile> {
    const row = await this.prisma.importedNotebookFile.upsert({
      where: { path: file.path },
      create: { path: file.path, modifiedAt: file.modifiedAt, importedAt: file.importedAt },
      update: { modifiedAt: file.modifiedAt, importedAt: file.importedAt }
    })
    return new ImportedNotebookFile({
      path: row.path,
      modifiedAt: row.modifiedAt,
      importedAt: row.importedAt
    })
  }
}

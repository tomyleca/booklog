import { InvalidKindleImportError } from '../../domain/errors/DomainErrors.js'

/** Un grupo de la vista previa (título del Kindle o archivo exportado) y su libro destino. */
export interface KindleImportAssignment {
  groupKey: string
  bookId: number
}

/**
 * Valida las asignaciones del renderer y las agrupa por libro. Común a las dos
 * importaciones del Kindle: cada grupo a lo sumo una vez, con un libro válido y presente en
 * la fuente leída por el main process.
 */
export function groupAssignmentsByBook<G extends { key: string }>(
  assignments: KindleImportAssignment[],
  groupsByKey: Map<string, G>
): Map<number, G[]> {
  if (!Array.isArray(assignments)) {
    throw new InvalidKindleImportError('Las asignaciones de la importación no son válidas.')
  }
  const assignedKeys = new Set<string>()
  const byBook = new Map<number, G[]>()
  for (const assignment of assignments) {
    if (!Number.isInteger(assignment?.bookId) || assignment.bookId <= 0) {
      throw new InvalidKindleImportError('Cada grupo a importar necesita un libro válido.')
    }
    const group = groupsByKey.get(assignment.groupKey)
    if (!group) {
      throw new InvalidKindleImportError(
        `El título "${String(assignment.groupKey)}" no está en el archivo importado.`
      )
    }
    if (assignedKeys.has(group.key)) {
      throw new InvalidKindleImportError(`El título "${group.key}" se asignó más de una vez.`)
    }
    assignedKeys.add(group.key)
    byBook.set(assignment.bookId, [...(byBook.get(assignment.bookId) ?? []), group])
  }
  return byBook
}

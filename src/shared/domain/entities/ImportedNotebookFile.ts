import { InvalidKindleImportError } from '../errors/DomainErrors.js'
import { isValidDate } from './CalendarDate.js'

export interface ImportedNotebookFileProps {
  /** Ruta absoluta del archivo exportado, tal como la leyó el main process. */
  path: string
  /** Fecha de modificación del archivo cuando se importó. */
  modifiedAt: Date
  importedAt?: Date
}

/**
 * Registro de una exportación del Cuaderno de la app de Kindle ya importada (feature #26).
 * Ruta + fecha de modificación: si el usuario vuelve a exportar el libro, el archivo cambia
 * de fecha y la vista previa deja de marcarlo como importado.
 */
export class ImportedNotebookFile {
  public readonly path: string
  public readonly modifiedAt: Date
  public readonly importedAt: Date

  constructor(props: ImportedNotebookFileProps) {
    if (typeof props.path !== 'string' || props.path.trim().length === 0) {
      throw new InvalidKindleImportError('La ruta del archivo importado no puede estar vacía.')
    }
    if (!isValidDate(props.modifiedAt)) {
      throw new InvalidKindleImportError('La fecha de modificación del archivo no es válida.')
    }
    const importedAt = props.importedAt ?? new Date()
    if (!isValidDate(importedAt)) {
      throw new InvalidKindleImportError('La fecha de importación no es válida.')
    }
    this.path = props.path
    this.modifiedAt = props.modifiedAt
    this.importedAt = importedAt
  }

  /** ¿El archivo sigue siendo el mismo que se importó? Se compara al milisegundo. */
  public matches(modifiedAt: Date): boolean {
    return this.modifiedAt.getTime() === modifiedAt.getTime()
  }
}

import crypto from 'node:crypto'
import type { KindleNotebookFileInput } from '../../shared/application/services/kindleNotebookFiles.js'

/** Texto de `My Clippings.txt` (#23). `kind` es opcional para no romper a quien ya lo usa. */
export interface KindleClippingsSession {
  kind?: 'CLIPPINGS'
  text: string
  label: string
}

/** Exportaciones del Cuaderno leídas de la carpeta (#26). */
export interface KindleNotebookSession {
  kind: 'NOTEBOOK'
  files: KindleNotebookFileInput[]
  label: string
}

export type KindleImportSession = KindleClippingsSession | KindleNotebookSession

/**
 * Guarda en memoria del main process lo leído entre la vista previa y el commit de la
 * importación (feature #23: el texto de My Clippings; #26: las exportaciones del Cuaderno). El renderer solo recibe un `sourceId`: nunca manda rutas ni
 * el contenido del archivo de vuelta. Se conservan pocas sesiones porque solo hay una
 * importación activa a la vez.
 */
export class KindleImportSessionStore {
  private readonly sessions = new Map<string, KindleImportSession>()

  constructor(private readonly maxSessions = 3) {}

  public put(session: KindleImportSession): string {
    const id = crypto.randomUUID()
    this.sessions.set(id, session)
    while (this.sessions.size > this.maxSessions) {
      const oldest = this.sessions.keys().next().value
      if (oldest === undefined) break
      this.sessions.delete(oldest)
    }
    return id
  }

  public get(id: string): KindleImportSession | null {
    return this.sessions.get(id) ?? null
  }

  public delete(id: string): void {
    this.sessions.delete(id)
  }
}

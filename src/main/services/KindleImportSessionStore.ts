import crypto from 'node:crypto'

export interface KindleImportSession {
  text: string
  label: string
}

/**
 * Guarda en memoria del main process el texto leído entre la vista previa y el commit de
 * la importación (feature #23). El renderer solo recibe un `sourceId`: nunca manda rutas ni
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

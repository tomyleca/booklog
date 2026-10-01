import path from 'node:path'
import { PrismaClient } from '@prisma/client'

/**
 * Resolves the path to the SQLite database file in Electron's userData directory.
 * Returns null if not running within an Electron runtime where app is accessible.
 */
function getElectronUserDataPath(): string | null {
  try {
    if (typeof process !== 'undefined' && process.versions && process.versions.electron) {
      // In Electron main process, require('electron') exposes the app module.
      // In testing or standard Node environments, electron exports the executable path string.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const electron = require('electron') as { app?: { getPath?: (name: string) => string } } | string
      if (
        typeof electron === 'object' &&
        electron !== null &&
        'app' in electron &&
        electron.app &&
        typeof electron.app.getPath === 'function'
      ) {
        return electron.app.getPath('userData')
      }
    }
  } catch {
    return null
  }
  return null
}

/**
 * Resolves the database URL according to current environment.
 * Priority:
 * 1. Explicitly provided customUrl parameter (used by tests or custom configs)
 * 2. DATABASE_URL environment variable
 * 3. Electron userData directory if running in Electron
 * 4. Fallback default SQLite file in dev
 */
export function resolveDatabaseUrl(customUrl?: string): string {
  if (customUrl) {
    return customUrl
  }

  if (process.env['DATABASE_URL']) {
    return process.env['DATABASE_URL']
  }

  const userDataPath = getElectronUserDataPath()
  if (userDataPath) {
    const dbPath = path.join(userDataPath, 'booklog.db')
    return `file:${dbPath}`
  }

  return 'file:./dev.db'
}

let prismaInstance: PrismaClient | null = null

/**
 * Instantiates a new PrismaClient configured with the resolved database URL.
 */
export function createPrismaClient(customUrl?: string): PrismaClient {
  const url = resolveDatabaseUrl(customUrl)
  return new PrismaClient({
    datasources: {
      db: {
        url
      }
    }
  })
}

/**
 * Retrieves the application singleton PrismaClient instance, or creates one if not existing.
 * If a customUrl is provided, it returns a new instance isolated for that URL.
 */
export function getPrismaClient(customUrl?: string): PrismaClient {
  if (customUrl) {
    return createPrismaClient(customUrl)
  }

  if (!prismaInstance) {
    prismaInstance = createPrismaClient()
  }

  return prismaInstance
}

/**
 * Disconnects the singleton PrismaClient if open.
 */
export async function disconnectPrismaClient(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect()
    prismaInstance = null
  }
}

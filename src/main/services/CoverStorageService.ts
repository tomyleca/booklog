import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

function getElectronUserDataPath(): string | null {
  try {
    if (typeof process !== 'undefined' && process.versions && process.versions.electron) {
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

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
  'image/svg+xml': '.svg'
}

export class CoverStorageService {
  private readonly baseDir: string
  private readonly coversDir: string

  constructor(customBaseDir?: string) {
    this.baseDir = customBaseDir ?? getElectronUserDataPath() ?? process.cwd()
    this.coversDir = path.resolve(this.baseDir, 'covers')
  }

  public getCoversDir(): string {
    return this.coversDir
  }

  public async ensureDirectory(): Promise<void> {
    await fs.promises.mkdir(this.coversDir, { recursive: true })
  }

  public getCoverFullPath(relativePath: string): string {
    if (!relativePath || typeof relativePath !== 'string') {
      throw new Error('La ruta relativa de la portada es inválida.')
    }

    const clean = relativePath.replace(/^[\\/]+/, '').replace(/^covers[\\/]+/, '')
    const fullPath = path.resolve(this.coversDir, clean)

    if (!fullPath.startsWith(this.coversDir)) {
      throw new Error('Ruta de portada inválida o insegura fuera del directorio permitido.')
    }

    return fullPath
  }

  public async saveFromLocalFile(sourcePath: string): Promise<string> {
    if (!sourcePath || typeof sourcePath !== 'string') {
      throw new Error('La ruta del archivo local no es válida.')
    }

    await fs.promises.access(sourcePath, fs.constants.R_OK).catch(() => {
      throw new Error(`El archivo de origen no existe o no tiene permisos de lectura: ${sourcePath}`)
    })

    const extRaw = path.extname(sourcePath).toLowerCase()
    const ext = extRaw && extRaw.length > 1 ? extRaw : '.jpg'
    const fileName = `${crypto.randomUUID()}${ext}`
    const destinationPath = path.join(this.coversDir, fileName)

    await this.ensureDirectory()
    await fs.promises.copyFile(sourcePath, destinationPath)

    return `covers/${fileName}`
  }

  public async saveFromUrl(url: string): Promise<string> {
    if (!url || typeof url !== 'string') {
      throw new Error('La URL de la portada no es válida.')
    }

    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      throw new Error(`URL de portada con formato inválido: ${url}`)
    }

    const response = await fetch(parsedUrl.toString())
    if (!response.ok) {
      throw new Error(
        `Error al descargar la imagen desde ${url}: ${response.statusText} (${response.status})`
      )
    }

    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()
    let ext: string | undefined = contentType ? MIME_EXTENSION_MAP[contentType] : undefined

    if (!ext) {
      const urlExt = path.extname(parsedUrl.pathname).toLowerCase()
      if (urlExt && urlExt.length > 1 && urlExt.length <= 5) {
        ext = urlExt
      } else {
        ext = '.jpg'
      }
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length === 0) {
      throw new Error(`La imagen descargada desde ${url} está vacía.`)
    }

    const fileName = `${crypto.randomUUID()}${ext}`
    const destinationPath = path.join(this.coversDir, fileName)

    await this.ensureDirectory()
    await fs.promises.writeFile(destinationPath, buffer)

    return `covers/${fileName}`
  }
}

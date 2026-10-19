import fs from 'node:fs'
import path from 'node:path'
import { NOTEBOOK_FILE_SUFFIX } from '../../shared/application/services/kindleNotebookFiles.js'
import type { KindleNotebookFileInput } from '../../shared/application/services/kindleNotebookFiles.js'
import { KindleFileError } from './KindleDeviceService.js'

/** Una exportación real pesa decenas de KB; más que esto no es una exportación del Cuaderno. */
export const MAX_NOTEBOOK_BYTES = 20 * 1024 * 1024

export interface KindleNotebookScan {
  folder: string
  files: KindleNotebookFileInput[]
}

export interface KindleNotebookScannerOptions {
  /** Carpeta por defecto (`app.getPath('documents')`). */
  defaultFolder: () => string
  /** Carpeta configurada por el usuario; `''` = la por defecto. */
  configuredFolder: () => Promise<string>
}

/**
 * Busca las exportaciones del Cuaderno de la app de Kindle para PC (feature #26) en una
 * carpeta del sistema de archivos: `*-Bloc de notas.html` (app en castellano) y
 * `*-Notebook.html` (en inglés). La app las guarda por defecto en Documentos. Es un
 * directorio normal, así que alcanza con `fs` (nada de PowerShell, a diferencia del MTP).
 * No recorre subcarpetas: la app exporta siempre en la carpeta elegida.
 */
export class KindleNotebookScanner {
  constructor(private readonly options: KindleNotebookScannerOptions) {}

  /** Carpeta efectiva y si es la predeterminada. */
  public async resolveFolder(): Promise<{ folder: string; isDefault: boolean }> {
    const configured = (await this.options.configuredFolder()).trim()
    if (configured) return { folder: path.resolve(configured), isDefault: false }
    return { folder: path.resolve(this.options.defaultFolder()), isDefault: true }
  }

  public async scan(): Promise<KindleNotebookScan> {
    const { folder } = await this.resolveFolder()
    let names: string[]
    try {
      const entries = await fs.promises.readdir(folder, { withFileTypes: true })
      names = entries
        .filter((entry) => entry.isFile() && NOTEBOOK_FILE_SUFFIX.test(entry.name))
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b, 'es'))
    } catch {
      throw new KindleFileError(`No se pudo abrir la carpeta de exportaciones: ${folder}`)
    }

    const files: KindleNotebookFileInput[] = []
    for (const fileName of names) {
      const filePath = path.join(folder, fileName)
      try {
        const stats = await fs.promises.stat(filePath)
        if (!stats.isFile() || stats.size === 0 || stats.size > MAX_NOTEBOOK_BYTES) continue
        const html = await fs.promises.readFile(filePath, 'utf-8')
        files.push({ fileName, path: filePath, modifiedAt: stats.mtime, html })
      } catch {
        // Un archivo que desaparece o no se puede leer no frena al resto.
        continue
      }
    }
    return { folder, files }
  }
}

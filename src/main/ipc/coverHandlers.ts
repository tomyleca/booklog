import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/infrastructure/ipc/channels.js'
import { ipcSuccess, ipcError, IPC_ERROR_CODES } from '../../shared/infrastructure/ipc/contracts.js'
import type { CoverStorageService } from '../services/CoverStorageService.js'

export function registerCoverHandlers(coverService: CoverStorageService): void {
  ipcMain.handle(IPC_CHANNELS.COVERS.SAVE_FROM_URL, async (_, args: { url: string }) => {
    try {
      if (!args || !args.url || typeof args.url !== 'string') {
        return ipcError('URL de portada inválida', IPC_ERROR_CODES.VALIDATION_ERROR)
      }
      const relativePath = await coverService.saveFromUrl(args.url)
      return ipcSuccess(relativePath)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      return ipcError(msg, IPC_ERROR_CODES.COVER_STORAGE_ERROR)
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.COVERS.SAVE_FROM_LOCAL,
    async (_, args: { filePath?: string; sourcePath?: string }) => {
      try {
        const pathValue = args?.filePath ?? args?.sourcePath
        if (!pathValue || typeof pathValue !== 'string') {
          return ipcError('Ruta de archivo local inválida', IPC_ERROR_CODES.VALIDATION_ERROR)
        }
        const relativePath = await coverService.saveFromLocalFile(pathValue)
        return ipcSuccess(relativePath)
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        return ipcError(msg, IPC_ERROR_CODES.COVER_STORAGE_ERROR)
      }
    }
  )
}

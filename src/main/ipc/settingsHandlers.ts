import { ipcMain, app } from 'electron'
import { IPC_CHANNELS } from '../../shared/infrastructure/ipc/channels.js'
import {
  ipcSuccess,
  ipcError,
  formatIpcError,
  type AppInfoDTO,
  type SaveSettingsDTO
} from '../../shared/infrastructure/ipc/contracts.js'
import { SettingsStorageService } from '../services/SettingsStorageService.js'

export function registerSettingsHandlers(
  settingsService: SettingsStorageService = new SettingsStorageService(),
  fetchFn: typeof fetch = fetch
): void {
  ipcMain.handle(IPC_CHANNELS.SETTINGS.GET, async () => {
    try {
      const settings = await settingsService.getSettings()
      return ipcSuccess(settings)
    } catch (error) {
      return formatIpcError(error)
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS.SAVE,
    async (_, dto: SaveSettingsDTO) => {
      try {
        const updated = await settingsService.saveSettings(dto ?? {})
        return ipcSuccess(updated)
      } catch (error) {
        return formatIpcError(error)
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS.TEST_API_KEY,
    async (_, args: { apiKey?: string } | string) => {
      try {
        const apiKey = typeof args === 'string' ? args : args?.apiKey
        if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
          return ipcError('Clave de API inválida o cuota superada')
        }

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 8000)

        const testUrl = `https://www.googleapis.com/books/v1/volumes?q=test&key=${encodeURIComponent(
          apiKey.trim()
        )}`

        try {
          const res = await fetchFn(testUrl, {
            signal: controller.signal
          })

          clearTimeout(timeoutId)

          if (res.ok) {
            return ipcSuccess({ valid: true })
          }

          return ipcError('Clave de API inválida o cuota superada')
        } catch {
          clearTimeout(timeoutId)
          return ipcError('Clave de API inválida o cuota superada')
        }
      } catch (error) {
        return formatIpcError(error)
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.SETTINGS.GET_APP_INFO, async () => {
    try {
      let appVersion = '0.1.0'
      try {
        if (typeof app !== 'undefined' && typeof app.getVersion === 'function') {
          appVersion = app.getVersion()
        }
      } catch {
        appVersion = '0.1.0'
      }

      const appInfo: AppInfoDTO = {
        name: 'BookLog',
        version: appVersion,
        electronVersion: (typeof process !== 'undefined' && process.versions?.electron) || '28.2.0',
        nodeVersion: (typeof process !== 'undefined' && process.versions?.node) || '18.19.0',
        chromeVersion: (typeof process !== 'undefined' && process.versions?.chrome) || '120.0.0',
        repositoryUrl: 'https://github.com/tomas/booklog',
        license: 'MIT'
      }

      return ipcSuccess(appInfo)
    } catch (error) {
      return formatIpcError(error)
    }
  })
}

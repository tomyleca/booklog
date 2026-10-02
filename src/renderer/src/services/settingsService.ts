import type {
  AppSettingsDTO,
  SaveSettingsDTO,
  TestApiKeyResultDTO,
  AppInfoDTO,
  IpcResult
} from '../../../shared/infrastructure/ipc/contracts.js'

export const settingsService = {
  async get(): Promise<IpcResult<AppSettingsDTO>> {
    return await window.api.settings.get()
  },

  async save(dto: SaveSettingsDTO): Promise<IpcResult<AppSettingsDTO>> {
    return await window.api.settings.save(dto)
  },

  async testApiKey(apiKey: string): Promise<IpcResult<TestApiKeyResultDTO>> {
    return await window.api.settings.testApiKey(apiKey)
  },

  async getAppInfo(): Promise<IpcResult<AppInfoDTO>> {
    return await window.api.settings.getAppInfo()
  }
}

import fs from 'node:fs'
import path from 'node:path'
import { app, safeStorage } from 'electron'
import type { AppSettingsDTO as AppSettings, AppTheme } from '../../shared/infrastructure/ipc/contracts.js'

export type { AppSettings, AppTheme }

export const DEFAULT_SETTINGS: AppSettings = {
  googleBooksApiKey: '',
  theme: 'dark'
}

interface StoredSettingsData {
  googleBooksApiKey?: string
  encryptedGoogleBooksApiKey?: string
  theme?: AppTheme
}

export interface SafeStorageProvider {
  isEncryptionAvailable(): boolean
  encryptString(plainText: string): Buffer
  decryptString(encrypted: Buffer): string
}

export class SettingsStorageService {
  private readonly storageFilePath: string
  private cachedSettings: AppSettings | null = null
  private readonly safeStorageClient: SafeStorageProvider | null

  constructor(
    customStoragePath?: string,
    customSafeStorage?: SafeStorageProvider | null
  ) {
    if (customStoragePath) {
      if (customStoragePath.endsWith('.json')) {
        this.storageFilePath = path.resolve(customStoragePath)
      } else {
        this.storageFilePath = path.resolve(customStoragePath, 'settings.json')
      }
    } else {
      let userDataPath: string | null = null
      try {
        if (typeof app !== 'undefined' && typeof app.getPath === 'function') {
          userDataPath = app.getPath('userData')
        }
      } catch {
        userDataPath = null
      }
      this.storageFilePath = path.resolve(userDataPath ?? process.cwd(), 'settings.json')
    }

    if (customSafeStorage !== undefined) {
      this.safeStorageClient = customSafeStorage
    } else {
      try {
        this.safeStorageClient = typeof safeStorage !== 'undefined' ? safeStorage : null
      } catch {
        this.safeStorageClient = null
      }
    }
  }

  public getStorageFilePath(): string {
    return this.storageFilePath
  }

  public getCachedApiKey(): string {
    return this.cachedSettings?.googleBooksApiKey ?? ''
  }

  public getCachedSettings(): AppSettings {
    return this.cachedSettings ? { ...this.cachedSettings } : { ...DEFAULT_SETTINGS }
  }

  public async getSettings(): Promise<AppSettings> {
    if (this.cachedSettings) {
      return { ...this.cachedSettings }
    }

    try {
      await fs.promises.access(this.storageFilePath, fs.constants.R_OK)
      const content = await fs.promises.readFile(this.storageFilePath, 'utf-8')
      const parsed = JSON.parse(content) as StoredSettingsData

      let resolvedApiKey = ''
      if (
        parsed.encryptedGoogleBooksApiKey &&
        this.safeStorageClient &&
        typeof this.safeStorageClient.isEncryptionAvailable === 'function' &&
        this.safeStorageClient.isEncryptionAvailable()
      ) {
        try {
          const buffer = Buffer.from(parsed.encryptedGoogleBooksApiKey, 'base64')
          resolvedApiKey = this.safeStorageClient.decryptString(buffer)
        } catch {
          resolvedApiKey = typeof parsed.googleBooksApiKey === 'string' ? parsed.googleBooksApiKey : ''
        }
      } else if (typeof parsed.googleBooksApiKey === 'string') {
        resolvedApiKey = parsed.googleBooksApiKey
      }

      const validTheme: AppTheme =
        parsed.theme === 'light' || parsed.theme === 'dark' || parsed.theme === 'system'
          ? parsed.theme
          : DEFAULT_SETTINGS.theme

      this.cachedSettings = {
        googleBooksApiKey: resolvedApiKey,
        theme: validTheme
      }
    } catch {
      this.cachedSettings = { ...DEFAULT_SETTINGS }
    }

    return { ...this.cachedSettings }
  }

  public async saveSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.getSettings()

    const updatedApiKey =
      partial.googleBooksApiKey !== undefined
        ? String(partial.googleBooksApiKey).trim()
        : current.googleBooksApiKey

    const updatedTheme: AppTheme =
      partial.theme === 'light' || partial.theme === 'dark' || partial.theme === 'system'
        ? partial.theme
        : current.theme

    const dataToSave: StoredSettingsData = {
      theme: updatedTheme
    }

    const canEncrypt =
      Boolean(updatedApiKey) &&
      this.safeStorageClient &&
      typeof this.safeStorageClient.isEncryptionAvailable === 'function' &&
      this.safeStorageClient.isEncryptionAvailable()

    if (canEncrypt && this.safeStorageClient) {
      try {
        const encrypted = this.safeStorageClient.encryptString(updatedApiKey)
        dataToSave.encryptedGoogleBooksApiKey = encrypted.toString('base64')
      } catch {
        dataToSave.googleBooksApiKey = updatedApiKey
      }
    } else {
      dataToSave.googleBooksApiKey = updatedApiKey
    }

    const dir = path.dirname(this.storageFilePath)
    await fs.promises.mkdir(dir, { recursive: true })
    await fs.promises.writeFile(this.storageFilePath, JSON.stringify(dataToSave, null, 2), 'utf-8')

    this.cachedSettings = {
      googleBooksApiKey: updatedApiKey,
      theme: updatedTheme
    }

    return { ...this.cachedSettings }
  }
}

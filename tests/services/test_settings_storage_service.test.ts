import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  SettingsStorageService,
  DEFAULT_SETTINGS,
  type SafeStorageProvider
} from '../../src/main/services/SettingsStorageService.js'

describe('SettingsStorageService', () => {
  let tempDir: string
  let settingsFile: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'booklog-storage-service-test-'))
    settingsFile = path.join(tempDir, 'settings.json')
  })

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  it('returns default settings when settings.json does not exist', async () => {
    const service = new SettingsStorageService(settingsFile)
    const settings = await service.getSettings()

    expect(settings).toEqual(DEFAULT_SETTINGS)
    expect(service.getCachedApiKey()).toBe('')
    expect(service.getCachedSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('saves and reads plain text settings when encryption is unavailable', async () => {
    const mockSafeStorage: SafeStorageProvider = {
      isEncryptionAvailable: vi.fn(() => false),
      encryptString: vi.fn(),
      decryptString: vi.fn()
    }

    const service = new SettingsStorageService(settingsFile, mockSafeStorage)
    const saved = await service.saveSettings({
      googleBooksApiKey: 'my-plain-key-123',
      theme: 'light'
    })

    expect(saved).toEqual({
      googleBooksApiKey: 'my-plain-key-123',
      theme: 'light'
    })

    // Verify file content on disk has plain text
    const fileContent = JSON.parse(await fs.promises.readFile(settingsFile, 'utf-8'))
    expect(fileContent.googleBooksApiKey).toBe('my-plain-key-123')
    expect(fileContent.theme).toBe('light')
    expect(fileContent.encryptedGoogleBooksApiKey).toBeUndefined()

    // Read back through fresh instance
    const freshService = new SettingsStorageService(settingsFile, mockSafeStorage)
    const loaded = await freshService.getSettings()
    expect(loaded).toEqual({
      googleBooksApiKey: 'my-plain-key-123',
      theme: 'light'
    })
    expect(freshService.getCachedApiKey()).toBe('my-plain-key-123')
  })

  it('encrypts API key when safeStorage encryption is available', async () => {
    const mockSafeStorage: SafeStorageProvider = {
      isEncryptionAvailable: vi.fn(() => true),
      encryptString: vi.fn((val: string) => Buffer.from(`ENC:${val}`)),
      decryptString: vi.fn((buf: Buffer) => buf.toString().replace(/^ENC:/, ''))
    }

    const service = new SettingsStorageService(settingsFile, mockSafeStorage)
    await service.saveSettings({
      googleBooksApiKey: 'secret-api-key',
      theme: 'system'
    })

    const fileContent = JSON.parse(await fs.promises.readFile(settingsFile, 'utf-8'))
    expect(fileContent.theme).toBe('system')
    expect(fileContent.encryptedGoogleBooksApiKey).toBeDefined()
    expect(fileContent.googleBooksApiKey).toBeUndefined()

    // Read back through fresh instance
    const freshService = new SettingsStorageService(settingsFile, mockSafeStorage)
    const loaded = await freshService.getSettings()
    expect(loaded).toEqual({
      googleBooksApiKey: 'secret-api-key',
      theme: 'system'
    })
    expect(mockSafeStorage.decryptString).toHaveBeenCalledTimes(1)
  })

  it('falls back gracefully to plain key or default if safeStorage decryption throws', async () => {
    const mockSafeStorage: SafeStorageProvider = {
      isEncryptionAvailable: vi.fn(() => true),
      encryptString: vi.fn((val: string) => Buffer.from(val)),
      decryptString: vi.fn(() => {
        throw new Error('Decryption failed')
      })
    }

    // Write a file with encrypted key
    await fs.promises.writeFile(
      settingsFile,
      JSON.stringify({
        encryptedGoogleBooksApiKey: Buffer.from('bad_data').toString('base64'),
        googleBooksApiKey: 'fallback-plain-key',
        theme: 'dark'
      })
    )

    const service = new SettingsStorageService(settingsFile, mockSafeStorage)
    const loaded = await service.getSettings()

    expect(loaded.googleBooksApiKey).toBe('fallback-plain-key')
    expect(loaded.theme).toBe('dark')
  })

  it('handles invalid or corrupted JSON gracefully by returning defaults', async () => {
    await fs.promises.writeFile(settingsFile, 'not-valid-json{{{')

    const service = new SettingsStorageService(settingsFile)
    const loaded = await service.getSettings()

    expect(loaded).toEqual(DEFAULT_SETTINGS)
  })

  it('preserves other fields when performing partial updates', async () => {
    const service = new SettingsStorageService(settingsFile, null)
    await service.saveSettings({
      googleBooksApiKey: 'key-1',
      theme: 'dark'
    })

    const updated = await service.saveSettings({
      theme: 'light'
    })

    expect(updated).toEqual({
      googleBooksApiKey: 'key-1',
      theme: 'light'
    })

    const keyUpdated = await service.saveSettings({
      googleBooksApiKey: 'key-2'
    })

    expect(keyUpdated).toEqual({
      googleBooksApiKey: 'key-2',
      theme: 'light'
    })
  })
})

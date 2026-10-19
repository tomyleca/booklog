import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { KindleNotebookScanner } from '../../src/main/services/KindleNotebookScanner.js'
import { KindleFileError } from '../../src/main/services/KindleDeviceService.js'
import { SettingsStorageService } from '../../src/main/services/SettingsStorageService.js'
import {
  NOTEBOOK_EN_FILE_NAME,
  NOTEBOOK_EN_HTML,
  NOTEBOOK_ES_FILE_NAME,
  NOTEBOOK_ES_HTML
} from '../fixtures/kindleNotebooks.js'

describe('Feature #26 — KindleNotebookScanner', () => {
  let documents: string
  let custom: string

  beforeEach(() => {
    documents = fs.mkdtempSync(path.join(os.tmpdir(), 'booklog-notebook-docs-'))
    custom = fs.mkdtempSync(path.join(os.tmpdir(), 'booklog-notebook-custom-'))
    fs.writeFileSync(path.join(documents, NOTEBOOK_ES_FILE_NAME), NOTEBOOK_ES_HTML, 'utf-8')
    fs.writeFileSync(path.join(documents, NOTEBOOK_EN_FILE_NAME), NOTEBOOK_EN_HTML, 'utf-8')
    fs.writeFileSync(path.join(documents, 'Informe.html'), '<html></html>', 'utf-8')
    fs.writeFileSync(path.join(documents, 'Vacío-Bloc de notas.html'), '', 'utf-8')
    fs.mkdirSync(path.join(documents, 'Carpeta-Notebook.html'))
    fs.mkdirSync(path.join(documents, 'sub'))
    fs.writeFileSync(path.join(documents, 'sub', 'Otro-Notebook.html'), NOTEBOOK_EN_HTML, 'utf-8')
  })

  afterEach(() => {
    fs.rmSync(documents, { recursive: true, force: true })
    fs.rmSync(custom, { recursive: true, force: true })
  })

  it('should read only the exports of the default folder, with their modification date', async () => {
    const scanner = new KindleNotebookScanner({
      defaultFolder: () => documents,
      configuredFolder: async () => ''
    })
    expect(await scanner.resolveFolder()).toEqual({
      folder: path.resolve(documents),
      isDefault: true
    })

    const scan = await scanner.scan()
    expect(scan.folder).toBe(path.resolve(documents))
    expect(scan.files.map((f) => f.fileName).sort()).toEqual(
      [NOTEBOOK_ES_FILE_NAME, NOTEBOOK_EN_FILE_NAME].sort()
    )
    const es = scan.files.find((f) => f.fileName === NOTEBOOK_ES_FILE_NAME)
    expect(es?.path).toBe(path.join(path.resolve(documents), NOTEBOOK_ES_FILE_NAME))
    expect(es?.html).toBe(NOTEBOOK_ES_HTML)
    expect(es?.modifiedAt.getTime()).toBe(
      fs.statSync(path.join(documents, NOTEBOOK_ES_FILE_NAME)).mtime.getTime()
    )
  })

  it('should use the configured folder when there is one', async () => {
    const scanner = new KindleNotebookScanner({
      defaultFolder: () => documents,
      configuredFolder: async () => custom
    })
    expect(await scanner.resolveFolder()).toEqual({
      folder: path.resolve(custom),
      isDefault: false
    })
    expect((await scanner.scan()).files).toEqual([])
  })

  it('should report a folder that cannot be opened', async () => {
    const scanner = new KindleNotebookScanner({
      defaultFolder: () => documents,
      configuredFolder: async () => path.join(custom, 'no-existe')
    })
    await expect(scanner.scan()).rejects.toBeInstanceOf(KindleFileError)
  })
})

describe('Feature #26 — notebook folder in settings.json', () => {
  let tempDir: string
  let settingsFile: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'booklog-notebook-settings-'))
    settingsFile = path.join(tempDir, 'settings.json')
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('should persist the folder and keep it when other settings are saved', async () => {
    const service = new SettingsStorageService(settingsFile, null)
    expect(await service.getKindleNotebookFolder()).toBe('')

    await service.setKindleNotebookFolder('  E:\\Exportaciones  ')
    await service.saveSettings({ theme: 'dark' })

    const reloaded = new SettingsStorageService(settingsFile, null)
    expect(await reloaded.getKindleNotebookFolder()).toBe('E:\\Exportaciones')
    expect(await reloaded.getSettings()).toEqual({ googleBooksApiKey: '', theme: 'dark' })
  })

  it('should ignore a folder sent through saveSettings and allow resetting it', async () => {
    const service = new SettingsStorageService(settingsFile, null)
    await service.setKindleNotebookFolder('E:\\Exportaciones')
    await service.saveSettings({ kindleNotebookFolder: 'C:\\Windows' } as never)
    expect(await service.getKindleNotebookFolder()).toBe('E:\\Exportaciones')

    await service.setKindleNotebookFolder('')
    const stored = JSON.parse(fs.readFileSync(settingsFile, 'utf-8')) as Record<string, unknown>
    expect(stored).not.toHaveProperty('kindleNotebookFolder')
  })
})

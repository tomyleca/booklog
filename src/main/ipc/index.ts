import type { PrismaClient } from '@prisma/client'
import { app, dialog } from 'electron'
import type { OpenDialogOptions } from 'electron'
import { PrismaBookRepository } from '../../shared/infrastructure/persistence/repositories/PrismaBookRepository.js'
import { PrismaNoteRepository } from '../../shared/infrastructure/persistence/repositories/PrismaNoteRepository.js'
import { PrismaHighlightRepository } from '../../shared/infrastructure/persistence/repositories/PrismaHighlightRepository.js'
import { PrismaImportedNotebookFileRepository } from '../../shared/infrastructure/persistence/repositories/PrismaImportedNotebookFileRepository.js'
import { CoverStorageService } from '../services/CoverStorageService.js'
import type { BookSearchService } from '../../shared/domain/ports/BookSearchService.js'
import { GoogleBooksService } from '../../shared/infrastructure/api/GoogleBooksService.js'
import { CachedBookSearchService } from '../../shared/infrastructure/api/CachedBookSearchService.js'
import { SettingsStorageService } from '../services/SettingsStorageService.js'
import { KindleDeviceService } from '../services/KindleDeviceService.js'
import { KindleNotebookScanner } from '../services/KindleNotebookScanner.js'
import { registerBookHandlers } from './bookHandlers.js'
import { registerNoteHandlers } from './noteHandlers.js'
import { registerHighlightHandlers } from './highlightHandlers.js'
import { registerCoverHandlers } from './coverHandlers.js'
import { registerSearchHandlers } from './searchHandlers.js'
import { registerWindowHandlers, type WindowGetter } from './windowHandlers.js'
import { registerSettingsHandlers } from './settingsHandlers.js'
import {
  registerKindleHandlers,
  type ChooseClippingsFile,
  type ChooseNotebookFolder
} from './kindleHandlers.js'

const CLIPPINGS_DIALOG_OPTIONS: OpenDialogOptions = {
  title: 'Elegí el archivo My Clippings.txt del Kindle',
  properties: ['openFile'],
  filters: [{ name: 'Recortes del Kindle', extensions: ['txt'] }]
}

function createClippingsFileChooser(getWindow?: WindowGetter): ChooseClippingsFile {
  return async () => {
    const window = getWindow?.()
    const result = window
      ? await dialog.showOpenDialog(window, CLIPPINGS_DIALOG_OPTIONS)
      : await dialog.showOpenDialog(CLIPPINGS_DIALOG_OPTIONS)
    return result.canceled ? null : (result.filePaths[0] ?? null)
  }
}

const NOTEBOOK_FOLDER_DIALOG_OPTIONS: OpenDialogOptions = {
  title: 'Elegí la carpeta donde la app de Kindle guarda las exportaciones',
  properties: ['openDirectory']
}

function createNotebookFolderChooser(getWindow?: WindowGetter): ChooseNotebookFolder {
  return async () => {
    const window = getWindow?.()
    const result = window
      ? await dialog.showOpenDialog(window, NOTEBOOK_FOLDER_DIALOG_OPTIONS)
      : await dialog.showOpenDialog(NOTEBOOK_FOLDER_DIALOG_OPTIONS)
    return result.canceled ? null : (result.filePaths[0] ?? null)
  }
}

export function registerIpcHandlers(
  prisma: PrismaClient,
  coverService: CoverStorageService = new CoverStorageService(),
  searchService?: BookSearchService,
  getWindow?: WindowGetter,
  settingsService: SettingsStorageService = new SettingsStorageService(),
  kindleService?: KindleDeviceService
): void {
  const bookRepository = new PrismaBookRepository(prisma)
  const noteRepository = new PrismaNoteRepository(prisma)
  const highlightRepository = new PrismaHighlightRepository(prisma)
  const actualSearchService =
    searchService ??
    new CachedBookSearchService(
      new GoogleBooksService(fetch, () => settingsService.getCachedApiKey())
    )

  // Pre-warm settings cache in background
  settingsService.getSettings().catch(() => {})

  registerBookHandlers(bookRepository)
  registerNoteHandlers(bookRepository, noteRepository)
  registerHighlightHandlers(bookRepository, highlightRepository)
  registerCoverHandlers(coverService)
  registerSearchHandlers(actualSearchService)
  registerWindowHandlers(getWindow)
  registerSettingsHandlers(settingsService)
  registerKindleHandlers({
    bookRepository,
    highlightRepository,
    noteRepository,
    deviceService: kindleService ?? new KindleDeviceService({ baseDir: app.getPath('userData') }),
    chooseFile: createClippingsFileChooser(getWindow),
    notebook: {
      scanner: new KindleNotebookScanner({
        defaultFolder: () => app.getPath('documents'),
        configuredFolder: () => settingsService.getKindleNotebookFolder()
      }),
      importedFiles: new PrismaImportedNotebookFileRepository(prisma),
      chooseFolder: createNotebookFolderChooser(getWindow),
      saveFolder: (folder) => settingsService.setKindleNotebookFolder(folder)
    }
  })
}

export {
  registerBookHandlers,
  registerNoteHandlers,
  registerHighlightHandlers,
  registerCoverHandlers,
  registerSearchHandlers,
  registerWindowHandlers,
  registerSettingsHandlers,
  registerKindleHandlers
}


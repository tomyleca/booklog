import type { PrismaClient } from '@prisma/client'
import { app, dialog } from 'electron'
import type { OpenDialogOptions } from 'electron'
import { PrismaBookRepository } from '../../shared/infrastructure/persistence/repositories/PrismaBookRepository.js'
import { PrismaNoteRepository } from '../../shared/infrastructure/persistence/repositories/PrismaNoteRepository.js'
import { PrismaHighlightRepository } from '../../shared/infrastructure/persistence/repositories/PrismaHighlightRepository.js'
import { CoverStorageService } from '../services/CoverStorageService.js'
import type { BookSearchService } from '../../shared/domain/ports/BookSearchService.js'
import { GoogleBooksService } from '../../shared/infrastructure/api/GoogleBooksService.js'
import { SettingsStorageService } from '../services/SettingsStorageService.js'
import { KindleDeviceService } from '../services/KindleDeviceService.js'
import { registerBookHandlers } from './bookHandlers.js'
import { registerNoteHandlers } from './noteHandlers.js'
import { registerHighlightHandlers } from './highlightHandlers.js'
import { registerCoverHandlers } from './coverHandlers.js'
import { registerSearchHandlers } from './searchHandlers.js'
import { registerWindowHandlers, type WindowGetter } from './windowHandlers.js'
import { registerSettingsHandlers } from './settingsHandlers.js'
import { registerKindleHandlers, type ChooseClippingsFile } from './kindleHandlers.js'

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
    searchService ?? new GoogleBooksService(fetch, () => settingsService.getCachedApiKey())

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
    chooseFile: createClippingsFileChooser(getWindow)
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


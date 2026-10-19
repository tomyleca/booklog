import type { PrismaClient } from '@prisma/client'
import { PrismaBookRepository } from '../../shared/infrastructure/persistence/repositories/PrismaBookRepository.js'
import { PrismaNoteRepository } from '../../shared/infrastructure/persistence/repositories/PrismaNoteRepository.js'
import { PrismaHighlightRepository } from '../../shared/infrastructure/persistence/repositories/PrismaHighlightRepository.js'
import { CoverStorageService } from '../services/CoverStorageService.js'
import type { BookSearchService } from '../../shared/domain/ports/BookSearchService.js'
import { GoogleBooksService } from '../../shared/infrastructure/api/GoogleBooksService.js'
import { SettingsStorageService } from '../services/SettingsStorageService.js'
import { registerBookHandlers } from './bookHandlers.js'
import { registerNoteHandlers } from './noteHandlers.js'
import { registerHighlightHandlers } from './highlightHandlers.js'
import { registerCoverHandlers } from './coverHandlers.js'
import { registerSearchHandlers } from './searchHandlers.js'
import { registerWindowHandlers, type WindowGetter } from './windowHandlers.js'
import { registerSettingsHandlers } from './settingsHandlers.js'

export function registerIpcHandlers(
  prisma: PrismaClient,
  coverService: CoverStorageService = new CoverStorageService(),
  searchService?: BookSearchService,
  getWindow?: WindowGetter,
  settingsService: SettingsStorageService = new SettingsStorageService()
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
}

export {
  registerBookHandlers,
  registerNoteHandlers,
  registerHighlightHandlers,
  registerCoverHandlers,
  registerSearchHandlers,
  registerWindowHandlers,
  registerSettingsHandlers
}


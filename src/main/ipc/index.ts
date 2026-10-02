import type { PrismaClient } from '@prisma/client'
import { PrismaBookRepository } from '../../shared/infrastructure/persistence/repositories/PrismaBookRepository.js'
import { PrismaNoteRepository } from '../../shared/infrastructure/persistence/repositories/PrismaNoteRepository.js'
import { CoverStorageService } from '../services/CoverStorageService.js'
import type { BookSearchService } from '../../shared/domain/ports/BookSearchService.js'
import { GoogleBooksService } from '../../shared/infrastructure/api/GoogleBooksService.js'
import { registerBookHandlers } from './bookHandlers.js'
import { registerNoteHandlers } from './noteHandlers.js'
import { registerCoverHandlers } from './coverHandlers.js'
import { registerSearchHandlers } from './searchHandlers.js'
import { registerWindowHandlers, type WindowGetter } from './windowHandlers.js'

export function registerIpcHandlers(
  prisma: PrismaClient,
  coverService: CoverStorageService = new CoverStorageService(),
  searchService: BookSearchService = new GoogleBooksService(),
  getWindow?: WindowGetter
): void {
  const bookRepository = new PrismaBookRepository(prisma)
  const noteRepository = new PrismaNoteRepository(prisma)

  registerBookHandlers(bookRepository)
  registerNoteHandlers(bookRepository, noteRepository)
  registerCoverHandlers(coverService)
  registerSearchHandlers(searchService)
  registerWindowHandlers(getWindow)
}

export {
  registerBookHandlers,
  registerNoteHandlers,
  registerCoverHandlers,
  registerSearchHandlers,
  registerWindowHandlers
}


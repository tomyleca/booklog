import { describe, it, expect, beforeEach, vi } from 'vitest'

type IpcHandler = (event: unknown, ...args: unknown[]) => Promise<unknown> | unknown
const registeredHandlers = new Map<string, IpcHandler>()

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: IpcHandler) => {
      registeredHandlers.set(channel, handler)
    })
  }
}))

import { IPC_CHANNELS } from '../../src/shared/infrastructure/ipc/channels.js'
import {
  formatIpcError,
  IPC_ERROR_CODES,
  type IpcResult
} from '../../src/shared/infrastructure/ipc/contracts.js'
import { registerSearchHandlers } from '../../src/main/ipc/searchHandlers.js'
import {
  SearchApiKeyInvalidError,
  SearchQuotaExceededError,
  SearchRequestFailedError,
  SearchServiceUnavailableError
} from '../../src/shared/domain/errors/BookSearchErrors.js'
import type {
  BookSearchResult,
  BookSearchService
} from '../../src/shared/domain/ports/BookSearchService.js'

describe('Feature #27 — typed search errors over IPC', () => {
  it.each([
    [new SearchServiceUnavailableError(503), IPC_ERROR_CODES.SEARCH_UNAVAILABLE],
    [new SearchServiceUnavailableError(), IPC_ERROR_CODES.SEARCH_UNAVAILABLE],
    [new SearchQuotaExceededError(429), IPC_ERROR_CODES.SEARCH_QUOTA_EXCEEDED],
    [new SearchApiKeyInvalidError(400), IPC_ERROR_CODES.SEARCH_INVALID_API_KEY],
    [new SearchRequestFailedError(404), IPC_ERROR_CODES.SEARCH_FAILED]
  ])('formatIpcError maps %s to its code', (error, code) => {
    const result = formatIpcError(error)
    expect(result).toEqual({ success: false, error: error.message, code })
  })

  describe('search:books handler', () => {
    let searchByQuery: ReturnType<typeof vi.fn>

    beforeEach(() => {
      registeredHandlers.clear()
      searchByQuery = vi.fn()
      registerSearchHandlers({ searchByQuery } as BookSearchService)
    })

    async function invoke(args: unknown): Promise<IpcResult<BookSearchResult[]>> {
      const handler = registeredHandlers.get(IPC_CHANNELS.SEARCH.BOOKS)
      if (!handler) throw new Error('search:books not registered')
      return (await handler(null, args)) as IpcResult<BookSearchResult[]>
    }

    it('returns SEARCH_UNAVAILABLE when the service is down', async () => {
      searchByQuery.mockRejectedValue(new SearchServiceUnavailableError(503))

      const res = await invoke({ query: 'Carrie' })

      expect(res.success).toBe(false)
      if (!res.success) expect(res.code).toBe(IPC_ERROR_CODES.SEARCH_UNAVAILABLE)
    })

    it('returns SEARCH_INVALID_API_KEY when the key is rejected', async () => {
      searchByQuery.mockRejectedValue(new SearchApiKeyInvalidError(400))

      const res = await invoke({ query: 'Carrie', author: 'King' })

      expect(res.success).toBe(false)
      if (!res.success) expect(res.code).toBe(IPC_ERROR_CODES.SEARCH_INVALID_API_KEY)
    })
  })
})

import type { IpcResult } from '../../../shared/infrastructure/ipc/contracts.js'

/**
 * Resolves any cover string (local path, external URL, booklog-media:// URL, or empty)
 * into a valid image URL for <img src="..." />.
 */
export function resolveCoverUrl(
  coverPathOrUrl?: string | null,
  fallbackUrl: string = ''
): string {
  if (!coverPathOrUrl || typeof coverPathOrUrl !== 'string') {
    return fallbackUrl
  }

  const trimmed = coverPathOrUrl.trim()
  if (!trimmed) {
    return fallbackUrl
  }

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:')
  ) {
    return trimmed
  }

  if (trimmed.startsWith('booklog-media://')) {
    return trimmed
  }

  const normalized = trimmed.replace(/\\/g, '/').replace(/^\/+/, '')
  if (normalized.startsWith('covers/')) {
    return `booklog-media://${normalized}`
  }

  return `booklog-media://covers/${normalized}`
}

export const coverService = {
  resolveUrl: resolveCoverUrl,

  async saveFromUrl(url: string): Promise<IpcResult<string>> {
    return await window.api.covers.saveFromUrl(url)
  },

  async saveFromLocal(filePath: string): Promise<IpcResult<string>> {
    return await window.api.covers.saveFromLocal(filePath)
  }
}

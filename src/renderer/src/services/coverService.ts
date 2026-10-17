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

/**
 * Ordered list of image URLs to try for a stored book cover: the local copy first
 * (booklog-media://), then the remote coverUrl. Empty and duplicate entries are dropped.
 * An empty list means "show the placeholder".
 */
export function buildCoverCandidates(
  coverPath?: string | null,
  coverUrl?: string | null
): string[] {
  const candidates = [resolveCoverUrl(coverPath), resolveCoverUrl(coverUrl)]
  return candidates.filter((url, index) => url !== '' && candidates.indexOf(url) === index)
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

import { useState } from 'react'
import { buildCoverCandidates } from '../services/coverService.js'

export interface CoverSource {
  /** URL to put in <img src>, or null when every candidate failed (show placeholder). */
  src: string | null
  /** Pass to <img onError>: advances to the next candidate. */
  onError: () => void
}

/**
 * Local cover -> remote coverUrl -> placeholder.
 *
 * The failure counter is stored together with the candidate list it belongs to, so when the
 * book changes (new coverPath/coverUrl) the chain restarts on the same render, without an
 * effect and without a frame showing the previous book's placeholder.
 */
export function useCoverSource(
  coverPath?: string | null,
  coverUrl?: string | null
): CoverSource {
  const candidates = buildCoverCandidates(coverPath, coverUrl)
  const key = candidates.join('\n')
  const [failures, setFailures] = useState<{ key: string; count: number }>({ key, count: 0 })

  const failedCount = failures.key === key ? failures.count : 0
  const src = candidates[failedCount] ?? null

  const onError = (): void => {
    setFailures((prev) => ({
      key,
      count: (prev.key === key ? prev.count : 0) + 1
    }))
  }

  return { src, onError }
}

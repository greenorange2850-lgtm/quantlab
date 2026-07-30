import {
  DEFAULT_PROGRESS_THROTTLE_MS,
  isBestImprovement,
  isImmediateProgressStatus,
} from './progress.js'
import type { RandomSearchProgress } from './types.js'

export interface ThrottledProgressHandlerOptions {
  /** Ordinary update interval in ms (default 150). */
  intervalMs?: number
  /** Injectable clock for deterministic tests. */
  now?: () => number
  /** Injectable timer APIs for deterministic tests. */
  setTimer?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>
  clearTimer?: (id: ReturnType<typeof setTimeout>) => void
}

export interface ThrottledProgressHandler {
  /** Emit a progress update (may be delayed unless immediate). */
  emit: (progress: RandomSearchProgress) => void
  /** Force-deliver any pending throttled update. */
  flush: () => void
  /** Cancel pending timer without delivering. */
  dispose: () => void
}

/**
 * Throttles ordinary Random Search progress updates to ~100–250 ms.
 * Always delivers immediately for:
 * - INITIALIZING / FINALIZING / COMPLETED / FAILED / CANCELLED
 * - new best-candidate improvements
 */
export function createThrottledProgressHandler(
  onProgress: (progress: RandomSearchProgress) => void,
  options: ThrottledProgressHandlerOptions = {},
): ThrottledProgressHandler {
  const intervalMs = options.intervalMs ?? DEFAULT_PROGRESS_THROTTLE_MS
  const now = options.now ?? Date.now
  const setTimer = options.setTimer ?? setTimeout
  const clearTimer = options.clearTimer ?? clearTimeout

  let lastEmitAt = 0
  let lastEmitted: RandomSearchProgress | null = null
  let pending: RandomSearchProgress | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  const clearPendingTimer = () => {
    if (timer !== null) {
      clearTimer(timer)
      timer = null
    }
  }

  const deliver = (progress: RandomSearchProgress) => {
    clearPendingTimer()
    pending = null
    lastEmitted = progress
    lastEmitAt = now()
    onProgress(progress)
  }

  const shouldEmitImmediately = (progress: RandomSearchProgress): boolean => {
    if (isImmediateProgressStatus(progress.status)) return true
    if (lastEmitted === null) return true
    if (isBestImprovement(lastEmitted, progress)) return true
    return false
  }

  const schedulePending = () => {
    if (timer !== null || pending === null) return
    const wait = Math.max(0, intervalMs - (now() - lastEmitAt))
    timer = setTimer(() => {
      timer = null
      if (pending) deliver(pending)
    }, wait)
  }

  return {
    emit(progress) {
      if (shouldEmitImmediately(progress)) {
        deliver(progress)
        return
      }

      pending = progress
      if (now() - lastEmitAt >= intervalMs) {
        deliver(progress)
        return
      }
      schedulePending()
    },
    flush() {
      if (pending) deliver(pending)
      else clearPendingTimer()
    },
    dispose() {
      clearPendingTimer()
      pending = null
    },
  }
}

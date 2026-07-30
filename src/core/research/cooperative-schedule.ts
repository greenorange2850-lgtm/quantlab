/**
 * Cooperative scheduling helpers for Random Search.
 * Yields to the browser event loop so paint / input can run between candidate batches.
 *
 * Prefer `scheduler.yield()` when available; fall back to `setTimeout(0)` (macrotask).
 * Do not use `Promise.resolve()` alone — microtask-only yields can still starve rendering.
 */

/** Target uninterrupted main-thread work budget (middle of 16–50 ms band). */
export const TARGET_BATCH_BUDGET_MS = 32
export const MIN_BATCH_SIZE = 1
export const MAX_BATCH_SIZE = 8
export const INITIAL_BATCH_SIZE = 1

type SchedulerWithYield = {
  yield?: () => Promise<void>
}

/**
 * Yield control to the browser so it can paint and process input.
 * Uses Scheduler API when present; otherwise a 0ms macrotask timer.
 */
export async function yieldToBrowser(): Promise<void> {
  const scheduler = (globalThis as typeof globalThis & { scheduler?: SchedulerWithYield })
    .scheduler
  if (typeof scheduler?.yield === 'function') {
    await scheduler.yield()
    return
  }

  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0)
  })
}

export interface AdaptiveBatchController {
  /** Candidates to run before the next yield (adapts over time). */
  readonly batchSize: number
  /** Candidates completed since the last yield. */
  readonly candidatesSinceYield: number
  /** Call after each candidate completes (before deciding the next yield). */
  noteCandidate: () => void
  /**
   * True when the next candidate should be preceded by a browser yield.
   * `candidateIndex` is 0-based; never yields before the first candidate.
   */
  shouldYieldBefore: (candidateIndex: number, nowMs: number) => boolean
  /** Record a completed batch so the next batch size can adapt. */
  recordBatch: (candidateCount: number, durationMs: number) => void
}

/**
 * Starts at a small batch and adapts toward the responsiveness budget.
 * Also yields when wall-clock time since the last yield exceeds the budget,
 * even if the candidate count has not yet reached `batchSize`.
 */
export function createAdaptiveBatchController(
  options: {
    targetBudgetMs?: number
    minBatchSize?: number
    maxBatchSize?: number
    initialBatchSize?: number
    /** Fixed batch size disables adaptation (useful in tests). */
    fixedBatchSize?: number
    now?: () => number
  } = {},
): AdaptiveBatchController {
  const targetBudgetMs = options.targetBudgetMs ?? TARGET_BATCH_BUDGET_MS
  const minBatchSize = options.minBatchSize ?? MIN_BATCH_SIZE
  const maxBatchSize = options.maxBatchSize ?? MAX_BATCH_SIZE
  const now = options.now ?? (() => performance.now())
  const fixed = options.fixedBatchSize

  let batchSize = fixed ?? options.initialBatchSize ?? INITIAL_BATCH_SIZE
  let candidatesSinceYield = 0
  let lastYieldAt = now()

  return {
    get batchSize() {
      return batchSize
    },
    get candidatesSinceYield() {
      return candidatesSinceYield
    },
    noteCandidate() {
      candidatesSinceYield += 1
    },
    shouldYieldBefore(candidateIndex, nowMs) {
      if (candidateIndex === 0) return false
      const countExceeded = candidatesSinceYield >= batchSize
      const timeExceeded = nowMs - lastYieldAt >= targetBudgetMs
      return countExceeded || timeExceeded
    },
    recordBatch(candidateCount, durationMs) {
      candidatesSinceYield = 0
      lastYieldAt = now()

      if (fixed !== undefined) {
        batchSize = fixed
        return
      }
      if (candidateCount <= 0) return

      if (durationMs > targetBudgetMs * 1.25) {
        batchSize = Math.max(minBatchSize, Math.floor(batchSize / 2) || minBatchSize)
        return
      }

      if (durationMs < targetBudgetMs * 0.5 && batchSize < maxBatchSize) {
        batchSize = Math.min(maxBatchSize, batchSize + 1)
      }
    },
  }
}

export interface RandomSearchPerfDiagnostics {
  candidatesProcessed: number
  totalDurationMs: number
  maxBatchDurationMs: number
  yieldCount: number
  averageCandidateDurationMs: number
}

export function createPerfDiagnosticsTracker(): {
  noteYield: () => void
  noteBatch: (candidateCount: number, durationMs: number) => void
  snapshot: (totalDurationMs: number) => RandomSearchPerfDiagnostics
} {
  let yieldCount = 0
  let maxBatchDurationMs = 0
  let candidatesProcessed = 0

  return {
    noteYield() {
      yieldCount += 1
    },
    noteBatch(candidateCount, durationMs) {
      candidatesProcessed += candidateCount
      maxBatchDurationMs = Math.max(maxBatchDurationMs, durationMs)
    },
    snapshot(totalDurationMs) {
      return {
        candidatesProcessed,
        totalDurationMs,
        maxBatchDurationMs,
        yieldCount,
        averageCandidateDurationMs:
          candidatesProcessed > 0 ? totalDurationMs / candidatesProcessed : 0,
      }
    },
  }
}

export function isPerfDiagnosticsEnabled(explicit?: boolean): boolean {
  if (explicit === true) return true
  if (explicit === false) return false
  // Vitest / Node unit tests should stay quiet unless explicitly requested.
  if (typeof process !== 'undefined' && process.env?.VITEST) return false
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) return true
  } catch {
    // ignore non-Vite environments
  }
  return false
}

export function logRandomSearchPerfDiagnostics(
  diagnostics: RandomSearchPerfDiagnostics,
): void {
  console.info('[RandomSearch perf]', {
    candidatesProcessed: diagnostics.candidatesProcessed,
    totalDurationMs: Math.round(diagnostics.totalDurationMs),
    maxBatchDurationMs: Math.round(diagnostics.maxBatchDurationMs),
    yieldCount: diagnostics.yieldCount,
    averageCandidateDurationMs: Number(
      diagnostics.averageCandidateDurationMs.toFixed(2),
    ),
  })
}

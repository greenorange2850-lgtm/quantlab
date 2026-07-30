/**
 * Development / CI probe: measures cooperative yielding vs microtask-only chaining.
 * Run: npx tsx src/core/research/__tests__/cooperative-blocking-probe.ts
 *
 * In browsers, microtask-only awaits still prevent paint/input until the chain ends.
 * This probe treats the entire microtask-only run as one uninterrupted paint-blocking
 * stretch, and measures gaps between macrotask yields for the cooperative path.
 */
import {
  createAdaptiveBatchController,
  createPerfDiagnosticsTracker,
  yieldToBrowser,
  TARGET_BATCH_BUDGET_MS,
} from '../cooperative-schedule.js'

function busyWait(ms: number): void {
  const start = performance.now()
  while (performance.now() - start < ms) {
    // intentional main-thread work
  }
}

async function runMicrotaskOnly(candidates: number, workMs: number): Promise<{
  totalMs: number
  /** Entire chain blocks paint — report total as longest uninterrupted stretch. */
  longestPaintBlockingMs: number
  candidatesBetweenYields: number
}> {
  const start = performance.now()
  for (let i = 0; i < candidates; i++) {
    busyWait(workMs)
    await Promise.resolve()
  }
  const totalMs = performance.now() - start
  return {
    totalMs,
    longestPaintBlockingMs: totalMs,
    candidatesBetweenYields: candidates,
  }
}

async function runCooperative(candidates: number, workMs: number): Promise<{
  totalMs: number
  longestPaintBlockingMs: number
  yieldCount: number
  maxBatchDurationMs: number
  averageCandidateDurationMs: number
  maxCandidatesBetweenYields: number
}> {
  const start = performance.now()
  let stretchStart = start
  let longest = 0
  let maxCandidatesBetweenYields = 0
  const batcher = createAdaptiveBatchController({
    targetBudgetMs: TARGET_BATCH_BUDGET_MS,
    initialBatchSize: 1,
  })
  const perf = createPerfDiagnosticsTracker()
  let batchStartedAt = performance.now()
  let openBatch = 0

  for (let i = 0; i < candidates; i++) {
    if (batcher.shouldYieldBefore(i, performance.now())) {
      if (openBatch > 0) {
        const duration = performance.now() - batchStartedAt
        batcher.recordBatch(openBatch, duration)
        perf.noteBatch(openBatch, duration)
        maxCandidatesBetweenYields = Math.max(maxCandidatesBetweenYields, openBatch)
        openBatch = 0
      }
      // End of uninterrupted stretch just before macrotask yield.
      longest = Math.max(longest, performance.now() - stretchStart)
      await yieldToBrowser()
      perf.noteYield()
      stretchStart = performance.now()
      batchStartedAt = stretchStart
    }

    busyWait(workMs)
    batcher.noteCandidate()
    openBatch += 1
  }

  if (openBatch > 0) {
    const duration = performance.now() - batchStartedAt
    batcher.recordBatch(openBatch, duration)
    perf.noteBatch(openBatch, duration)
    maxCandidatesBetweenYields = Math.max(maxCandidatesBetweenYields, openBatch)
  }
  longest = Math.max(longest, performance.now() - stretchStart)

  const totalMs = performance.now() - start
  const snapshot = perf.snapshot(totalMs)
  return {
    totalMs,
    longestPaintBlockingMs: longest,
    yieldCount: snapshot.yieldCount,
    maxBatchDurationMs: snapshot.maxBatchDurationMs,
    averageCandidateDurationMs: snapshot.averageCandidateDurationMs,
    maxCandidatesBetweenYields,
  }
}

async function main() {
  // ~25ms/candidate approximates heavier mobile backtests on larger candle sets.
  const workMs = 25
  const sizes = [200, 500, 1000]

  console.log(
    `Per-candidate busy-wait ≈ ${workMs}ms; cooperative budget ${TARGET_BATCH_BUDGET_MS}ms\n`,
  )

  for (const n of sizes) {
    const blocked = await runMicrotaskOnly(n, workMs)
    const coop = await runCooperative(n, workMs)
    console.log(`candidates=${n}`)
    console.log(
      `  microtask-only: total=${blocked.totalMs.toFixed(0)}ms longestPaintBlocking=${blocked.longestPaintBlockingMs.toFixed(0)}ms candidatesBetweenYields=${blocked.candidatesBetweenYields}`,
    )
    console.log(
      `  cooperative:    total=${coop.totalMs.toFixed(0)}ms longestPaintBlocking=${coop.longestPaintBlockingMs.toFixed(0)}ms yields=${coop.yieldCount} maxBatch=${coop.maxBatchDurationMs.toFixed(0)}ms maxCand/batch=${coop.maxCandidatesBetweenYields} avgCand=${coop.averageCandidateDurationMs.toFixed(2)}ms`,
    )
    console.log('')
  }
}

void main()

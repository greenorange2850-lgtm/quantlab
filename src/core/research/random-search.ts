import { runAdaptiveSearch } from './adaptive-search.js'
import { createEmptyProgress } from './progress.js'
import type { ResearchSession, RunRandomSearchOptions, RandomSearchProgress } from './types.js'

/**
 * Adaptive multi-stage optimizer entry point
 * (Baseline → Exploration → Refinement → Stability).
 * Kept as `runRandomSearch` for store/UI compatibility.
 *
 * Pause / resume / cancel are honored via `options.controls`
 * (and legacy `pauseController`) inside the adaptive engine.
 * Cooperative yielding and deterministic candidate order are preserved.
 *
 * Live progress is ephemeral: FINALIZING is emitted before return on success.
 * COMPLETED is reserved for the store after the Research Session is persisted.
 */
export async function runRandomSearch(
  options: RunRandomSearchOptions,
): Promise<ResearchSession> {
  return runAdaptiveSearch(options)
}

export function getProgressSnapshot(
  progress: RandomSearchProgress | null | undefined,
): RandomSearchProgress {
  if (!progress) return createEmptyProgress(0)
  return { ...progress }
}

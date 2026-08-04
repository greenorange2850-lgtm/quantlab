import { runAdaptiveSearch } from './adaptive-search.js'
import type { ResearchSession, RunRandomSearchOptions, RandomSearchProgress } from './types.js'

/**
 * Adaptive multi-stage optimizer entry point (Baseline → Exploration → Refinement → Stability).
 * Kept as `runRandomSearch` for store/UI compatibility.
 *
 * Live progress is ephemeral: FINALIZING is emitted before return on success.
 * COMPLETED is reserved for the store after the Research Session is persisted.
 */
export async function runRandomSearch(
  options: RunRandomSearchOptions,
): Promise<ResearchSession> {
  return runAdaptiveSearch(options)
}

export function getProgressSnapshot(session: ResearchSession): RandomSearchProgress {
  return { ...session.progress }
}

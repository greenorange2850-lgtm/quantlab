/**
 * Shared UI gating helpers for research archive / session hydrate.
 * Pure functions — easy to unit test without mounting pages.
 */

/** True while research list/detail must show skeleton instead of empty state. */
export function shouldAwaitResearchArchive(input: {
  archiveReady: boolean
  hasData: boolean
  isPending: boolean
}): boolean {
  return !input.archiveReady || (!input.hasData && input.isPending)
}

/** True while dashboard must show skeleton instead of “No backtest results yet”. */
export function shouldAwaitDashboardSessionHydrate(input: {
  hasBacktest: boolean
  hasAttemptedSessionHydrate: boolean
  isHydratingSession: boolean
  sessionHydrateError: string | null
}): boolean {
  if (input.hasBacktest || input.sessionHydrateError) return false
  return !input.hasAttemptedSessionHydrate || input.isHydratingSession
}

/**
 * Optimizer deep-link: prefer `session` (used by Sessions / Analysis / Compare).
 * Keep `analysis` as a legacy fallback for bookmarks.
 */
export function resolveOptimizerSessionId(params: {
  get: (key: string) => string | null
}): string | null {
  return params.get('session') ?? params.get('analysis')
}

/**
 * Rank trading setups by actionable quality.
 */

import type { SetupStatus, TradingSetup } from './setup-types'

const STATUS_RANK: Record<SetupStatus, number> = {
  READY: 100,
  WAITING_RETEST: 70,
  WATCHING: 50,
  COMPLETED: 20,
  EXPIRED: 10,
  INVALIDATED: 0,
}

export function compareSetups(a: TradingSetup, b: TradingSetup): number {
  const statusDelta = STATUS_RANK[b.status] - STATUS_RANK[a.status]
  if (statusDelta !== 0) return statusDelta
  if (b.strength.score !== a.strength.score) return b.strength.score - a.strength.score
  if (b.updatedIndex !== a.updatedIndex) return b.updatedIndex - a.updatedIndex
  return a.id.localeCompare(b.id)
}

export function rankSetups(setups: readonly TradingSetup[]): TradingSetup[] {
  return [...setups].sort(compareSetups)
}

export function rankedSetupIds(setups: readonly TradingSetup[]): string[] {
  return rankSetups(setups).map((s) => s.id)
}

/** Prefer READY setups; otherwise highest ranked non-terminal. */
export function pickHighestRanked(setups: readonly TradingSetup[]): TradingSetup | null {
  const ranked = rankSetups(setups)
  return (
    ranked.find((s) => s.status === 'READY') ??
    ranked.find((s) => s.status === 'WAITING_RETEST' || s.status === 'WATCHING') ??
    ranked[0] ??
    null
  )
}

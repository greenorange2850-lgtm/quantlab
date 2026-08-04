/**
 * Analyze-tab Setup Summary builder.
 */

import { pickHighestRanked } from './setup-ranking'
import type {
  SetupConflict,
  SetupSummary,
  SetupSummaryStance,
  TradingSetup,
} from './setup-types'

export function buildSetupSummary(
  setups: readonly TradingSetup[],
  conflicts: readonly SetupConflict[],
): SetupSummary {
  const buyReady = setups.filter(
    (s) => s.direction === 'BULLISH' && s.status === 'READY',
  )
  const sellReady = setups.filter(
    (s) => s.direction === 'BEARISH' && s.status === 'READY',
  )
  const watching = setups.filter((s) => s.status === 'WATCHING')
  const waiting = setups.filter((s) => s.status === 'WAITING_RETEST')
  const invalidated = setups.filter((s) => s.status === 'INVALIDATED')
  const expired = setups.filter((s) => s.status === 'EXPIRED')
  const completed = setups.filter((s) => s.status === 'COMPLETED')

  const highest = pickHighestRanked(setups)

  let stance: SetupSummaryStance = 'No Setup'
  if (buyReady.length > 0 && sellReady.length === 0) stance = 'BUY READY'
  else if (sellReady.length > 0 && buyReady.length === 0) stance = 'SELL READY'
  else if (buyReady.length > 0 && sellReady.length > 0) stance = 'WAIT'
  else if (watching.length > 0 || waiting.length > 0) stance = 'WAIT'
  else if (setups.length === 0) stance = 'No Setup'
  else stance = 'WAIT'

  const missing =
    highest?.missingChecks.slice(0, 6) ??
    (stance === 'No Setup' ? ['No qualifying detector chain'] : [])

  const reason =
    highest?.reason ??
    (stance === 'No Setup'
      ? 'No valid setup currently exists from detector outputs'
      : 'Setups present but none READY')

  return {
    stance,
    highestRanked: highest,
    buyReadyCount: buyReady.length,
    sellReadyCount: sellReady.length,
    watchingCount: watching.length,
    waitingRetestCount: waiting.length,
    invalidatedCount: invalidated.length,
    expiredCount: expired.length,
    completedCount: completed.length,
    strength: highest?.strength.score ?? null,
    reason,
    missingConditions: missing,
    conflictCount: conflicts.length,
  }
}

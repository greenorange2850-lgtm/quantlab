import type {
  ZoneLifecycleMeta,
  ZoneLifecycleReport,
  ZoneLifecycleState,
  ZoneLifecycleType,
} from './zone-lifecycle-types'
import { isTerminalLifecycleState } from './zone-lifecycle-transition'

function emptyByType(): Record<ZoneLifecycleType, number> {
  return {
    BULLISH_FVG: 0,
    BEARISH_FVG: 0,
    BULLISH_ORDER_BLOCK: 0,
    BEARISH_ORDER_BLOCK: 0,
    LIQUIDITY_LEVEL: 0,
    EQUAL_HIGH: 0,
    EQUAL_LOW: 0,
  }
}

function emptyByState(): Record<ZoneLifecycleState, number> {
  return {
    NEW: 0,
    ACTIVE: 0,
    TOUCHED: 0,
    PARTIAL: 0,
    MITIGATED: 0,
    INVALIDATED: 0,
    EXPIRED: 0,
    SWEEPED: 0,
    SWEPT: 0,
    CONSUMED: 0,
  }
}

/**
 * Aggregate lifecycle diagnostics report from managed zones.
 */
export function buildZoneLifecycleReport(
  zones: readonly ZoneLifecycleMeta[],
): ZoneLifecycleReport {
  const byType = emptyByType()
  const byState = emptyByState()
  let lifetimeSum = 0
  let lifetimeN = 0

  for (const z of zones) {
    byType[z.type] += 1
    byState[z.currentState] += 1
    if (isTerminalLifecycleState(z.currentState)) {
      const end =
        z.expiredIndex ?? z.invalidatedIndex ?? z.mitigatedIndex ?? z.createdIndex
      lifetimeSum += Math.max(0, end - z.createdIndex)
      lifetimeN += 1
    } else {
      lifetimeSum += z.ageCandles
      lifetimeN += 1
    }
  }

  return {
    zonesCreated: zones.length,
    active: byState.ACTIVE + byState.NEW,
    touched: byState.TOUCHED,
    partial: byState.PARTIAL,
    mitigated: byState.MITIGATED,
    invalidated: byState.INVALIDATED,
    expired: byState.EXPIRED,
    sweeped: byState.SWEEPED + byState.SWEPT,
    consumed: byState.CONSUMED,
    averageLifetimeCandles:
      lifetimeN === 0 ? 0 : Math.round((lifetimeSum / lifetimeN) * 10) / 10,
    byType,
    byState,
  }
}

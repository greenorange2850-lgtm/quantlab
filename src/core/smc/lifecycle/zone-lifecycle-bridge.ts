import type { SmcZoneKind, SmcZoneProjection } from './types'
import { lifecycleStateLabel, toChartZoneState } from './zone-lifecycle-render'
import type { ZoneLifecycleMeta, ZoneLifecycleType } from './zone-lifecycle-types'

function zoneKindOf(type: ZoneLifecycleType): SmcZoneKind {
  switch (type) {
    case 'BULLISH_FVG':
    case 'BEARISH_FVG':
      return 'FVG'
    case 'BULLISH_ORDER_BLOCK':
    case 'BEARISH_ORDER_BLOCK':
      return 'ORDER_BLOCK'
    case 'EQUAL_HIGH':
    case 'EQUAL_LOW':
      return 'EQUAL_LEVEL'
    case 'LIQUIDITY_LEVEL':
    default:
      return 'LIQUIDITY_LEVEL'
  }
}

function shortLabelOf(meta: ZoneLifecycleMeta): string {
  switch (meta.type) {
    case 'BULLISH_FVG':
      return 'bull FVG'
    case 'BEARISH_FVG':
      return 'bear FVG'
    case 'BULLISH_ORDER_BLOCK':
      return 'bull OB'
    case 'BEARISH_ORDER_BLOCK':
      return 'bear OB'
    case 'EQUAL_HIGH':
      return 'EQH'
    case 'EQUAL_LOW':
      return 'EQL'
    case 'LIQUIDITY_LEVEL':
      return meta.direction === 'BULLISH' ? 'SSL' : 'BSL'
    default:
      return meta.type
  }
}

/** Convert Phase 6 managed zone → chart projection (backward compatible). */
export function managedZoneToProjection(
  meta: ZoneLifecycleMeta,
  setupRefs: string[] = [],
  visibilityReason = 'Lifecycle manager',
): SmcZoneProjection {
  const state = toChartZoneState(meta.currentState, meta.family)
  const live =
    meta.currentState === 'NEW' ||
    meta.currentState === 'ACTIVE' ||
    meta.currentState === 'TOUCHED' ||
    meta.currentState === 'PARTIAL'

  return {
    zoneId: meta.id,
    zoneKind: zoneKindOf(meta.type),
    direction: meta.direction,
    sourceEventId: meta.sourceEventId,
    startIndex: meta.startIndex,
    endIndex: meta.endIndex,
    low: meta.low,
    high: meta.high,
    midpoint: meta.midpoint ?? undefined,
    state,
    firstTouchIndex: meta.firstTouchIndex ?? undefined,
    mitigationIndex: meta.mitigatedIndex ?? undefined,
    invalidationIndex: meta.invalidatedIndex ?? undefined,
    expirationIndex: meta.expiredIndex ?? undefined,
    activeAtVisibleIndex: live,
    setupRefs,
    lifecycleReason: meta.reason,
    shortLabel: shortLabelOf(meta),
    fullLabel: `${shortLabelOf(meta)} · ${lifecycleStateLabel(meta.currentState)}`,
    visibilityReason,
    extendsToVisibleEdge: meta.extendsToVisibleEdge,
    lifecycle: meta,
  }
}

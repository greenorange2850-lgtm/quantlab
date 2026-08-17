import type { SmcOrderBlockEvent } from '../types'
import type { SmcChartZoneState, SmcZoneProjection } from './types'

function knowable(
  events: readonly SmcOrderBlockEvent[],
  visibleIndex: number,
): SmcOrderBlockEvent[] {
  return events.filter((e) => e.candleIndex <= visibleIndex)
}

function stateLabel(state: SmcChartZoneState): string {
  switch (state) {
    case 'ACTIVE':
      return 'Fresh'
    case 'TOUCHED':
      return 'Touched'
    case 'PARTIALLY_MITIGATED':
      return 'Partial'
    case 'MITIGATED':
      return 'Mitigated'
    case 'INVALIDATED':
      return 'Invalidated'
    default:
      return state
  }
}

/**
 * Project Order Block zones at progressive visibleIndex.
 */
export function projectOrderBlockZones(
  orderBlockEvents: readonly SmcOrderBlockEvent[],
  visibleIndex: number,
  options?: { extendActiveRight?: boolean },
): SmcZoneProjection[] {
  const extendActive = options?.extendActiveRight !== false
  const known = knowable(orderBlockEvents, visibleIndex)
  const created = known.filter(
    (e) =>
      e.kind === 'BULLISH_ORDER_BLOCK_CREATED' || e.kind === 'BEARISH_ORDER_BLOCK_CREATED',
  )

  const projections: SmcZoneProjection[] = []

  for (const create of created) {
    const updates = known
      .filter(
        (e) => e.orderBlockId === create.orderBlockId && e.candleIndex >= create.candleIndex,
      )
      .sort((a, b) => a.candleIndex - b.candleIndex || a.id.localeCompare(b.id))

    let state: SmcChartZoneState = 'ACTIVE'
    let firstTouchIndex: number | undefined
    let mitigationIndex: number | undefined
    let invalidationIndex: number | undefined
    let terminalIndex: number | undefined

    for (const u of updates) {
      if (
        u.kind === 'BULLISH_ORDER_BLOCK_CREATED' ||
        u.kind === 'BEARISH_ORDER_BLOCK_CREATED'
      ) {
        continue
      }
      if (u.kind === 'ORDER_BLOCK_TOUCHED') {
        firstTouchIndex = firstTouchIndex ?? u.candleIndex
        if (state === 'ACTIVE') state = 'TOUCHED'
      }
      if (u.kind === 'ORDER_BLOCK_MITIGATED') {
        // HALF_FILLED-style partial is rare today — treat as partial (still extends).
        // Full mitigation clips at the mitigation candle.
        if (u.mitigationStatus === 'HALF_FILLED') {
          state = 'PARTIALLY_MITIGATED'
          mitigationIndex = u.candleIndex
        } else {
          state = 'MITIGATED'
          mitigationIndex = u.candleIndex
          terminalIndex = u.candleIndex
        }
      }
      if (u.kind === 'ORDER_BLOCK_INVALIDATED' || u.invalidationStatus) {
        state = 'INVALIDATED'
        invalidationIndex = u.candleIndex
        terminalIndex = u.candleIndex
      }
    }

    const stillActive =
      state === 'ACTIVE' || state === 'TOUCHED' || state === 'PARTIALLY_MITIGATED'
    let endIndex: number
    let extendsToVisibleEdge = false
    let lifecycleReason: string

    if (stillActive && extendActive) {
      endIndex = visibleIndex
      extendsToVisibleEdge = true
      lifecycleReason =
        state === 'ACTIVE'
          ? 'Fresh Order Block extends to visible candle.'
          : `Order Block remains ${stateLabel(state).toLowerCase()} and extends while valid.`
    } else if (terminalIndex != null) {
      endIndex = Math.min(terminalIndex, visibleIndex)
      lifecycleReason =
        state === 'INVALIDATED'
          ? 'Zone no longer extends because invalidation occurred.'
          : 'Zone no longer extends because mitigation occurred.'
    } else {
      endIndex = Math.min(create.sourceCandleIndex + 1, visibleIndex)
      lifecycleReason = 'No terminal OB lifecycle event yet; clipped near source.'
    }

    projections.push({
      zoneId: create.orderBlockId,
      zoneKind: 'ORDER_BLOCK',
      direction: create.direction,
      sourceEventId: create.id,
      startIndex: create.sourceCandleIndex,
      endIndex,
      low: create.zoneLow,
      high: create.zoneHigh,
      midpoint: create.midpoint,
      state,
      firstTouchIndex,
      mitigationIndex,
      invalidationIndex,
      activeAtVisibleIndex: stillActive,
      setupRefs: [],
      lifecycleReason,
      shortLabel: 'OB',
      fullLabel: `${create.direction === 'BULLISH' ? 'Bullish' : 'Bearish'} OB · ${stateLabel(state)}`,
      visibilityReason: stillActive ? 'Active/fresh Order Block' : `Finished OB (${state})`,
      extendsToVisibleEdge,
    })
  }

  return projections.sort((a, b) => a.startIndex - b.startIndex || a.zoneId.localeCompare(b.zoneId))
}

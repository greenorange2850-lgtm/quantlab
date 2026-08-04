import type { SmcFvgEvent } from '../types'
import type { SmcChartZoneState, SmcZoneProjection } from './types'

function knowable(events: readonly SmcFvgEvent[], visibleIndex: number): SmcFvgEvent[] {
  return events.filter((e) => e.candleIndex <= visibleIndex)
}

function mapState(kind: SmcFvgEvent['kind'], fallback: SmcChartZoneState): SmcChartZoneState {
  switch (kind) {
    case 'FVG_TOUCHED':
      return 'TOUCHED'
    case 'FVG_HALF_FILLED':
      return 'PARTIALLY_MITIGATED'
    case 'FVG_FULLY_FILLED':
      return 'FILLED'
    case 'FVG_INVALIDATED':
      return 'INVALIDATED'
    default:
      return fallback
  }
}

function stateLabel(state: SmcChartZoneState): string {
  switch (state) {
    case 'ACTIVE':
      return 'Active'
    case 'TOUCHED':
      return 'Touched'
    case 'PARTIALLY_MITIGATED':
      return 'Partial'
    case 'FILLED':
      return 'Filled'
    case 'INVALIDATED':
      return 'Invalidated'
    case 'EXPIRED':
      return 'Expired'
    default:
      return state
  }
}

/**
 * Project FVG zones at progressive visibleIndex from detector events.
 * Never mutates detector events. Terminal states clip at terminal candle.
 */
export function projectFvgZones(
  fvgEvents: readonly SmcFvgEvent[],
  visibleIndex: number,
  options?: { extendActiveRight?: boolean },
): SmcZoneProjection[] {
  const extendActive = options?.extendActiveRight !== false
  const known = knowable(fvgEvents, visibleIndex)
  const created = known.filter(
    (e) => e.kind === 'BULLISH_FVG_CREATED' || e.kind === 'BEARISH_FVG_CREATED',
  )

  const projections: SmcZoneProjection[] = []

  for (const create of created) {
    const updates = known
      .filter((e) => e.fvgId === create.fvgId && e.candleIndex >= create.candleIndex)
      .sort((a, b) => a.candleIndex - b.candleIndex || a.id.localeCompare(b.id))

    let state: SmcChartZoneState = 'ACTIVE'
    let firstTouchIndex: number | undefined
    let mitigationIndex: number | undefined
    let invalidationIndex: number | undefined
    let terminalIndex: number | undefined

    for (const u of updates) {
      if (u.kind === 'BULLISH_FVG_CREATED' || u.kind === 'BEARISH_FVG_CREATED') continue
      const next = mapState(u.kind, state)
      if (u.kind === 'FVG_TOUCHED' && firstTouchIndex == null) {
        firstTouchIndex = u.candleIndex
        if (state === 'ACTIVE') state = 'TOUCHED'
      }
      if (u.kind === 'FVG_HALF_FILLED') {
        state = 'PARTIALLY_MITIGATED'
        mitigationIndex = u.candleIndex
      }
      if (u.kind === 'FVG_FULLY_FILLED') {
        state = 'FILLED'
        mitigationIndex = u.candleIndex
        terminalIndex = u.candleIndex
      }
      if (u.kind === 'FVG_INVALIDATED') {
        state = 'INVALIDATED'
        invalidationIndex = u.candleIndex
        terminalIndex = u.candleIndex
      }
      // Keep last mapped state for ordered updates
      if (next !== 'ACTIVE') state = next
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
          ? 'Active untouched FVG extends to visible candle.'
          : `FVG remains ${stateLabel(state).toLowerCase()} and extends while still valid.`
    } else if (terminalIndex != null) {
      endIndex = Math.min(terminalIndex, visibleIndex)
      lifecycleReason =
        state === 'FILLED'
          ? 'Zone no longer extends because full-fill occurred.'
          : 'Zone no longer extends because invalidation occurred.'
    } else {
      endIndex = Math.min(create.candleIndex + 1, visibleIndex)
      lifecycleReason = 'No terminal lifecycle event yet; clipped near creation.'
    }

    const startIndex = create.candleIndices[0] ?? create.candleIndex
    projections.push({
      zoneId: create.fvgId,
      zoneKind: 'FVG',
      direction: create.direction,
      sourceEventId: create.id,
      startIndex,
      endIndex,
      low: create.lowerBoundary,
      high: create.upperBoundary,
      midpoint: create.midpoint,
      state,
      firstTouchIndex,
      mitigationIndex,
      invalidationIndex,
      activeAtVisibleIndex: stillActive,
      setupRefs: [],
      lifecycleReason,
      shortLabel: 'FVG',
      fullLabel: `${create.direction === 'BULLISH' ? 'Bullish' : 'Bearish'} FVG · ${stateLabel(state)}`,
      visibilityReason: stillActive ? 'Active/touched FVG' : `Finished FVG (${state})`,
      extendsToVisibleEdge,
    })
  }

  return projections.sort((a, b) => a.startIndex - b.startIndex || a.zoneId.localeCompare(b.zoneId))
}

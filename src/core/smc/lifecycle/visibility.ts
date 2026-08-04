import type { SmcDetectionResult, SmcEvent } from '../types'
import type {
  SmcSmartVisibilityPreset,
  SmcStructureEventProjection,
  SmcStructureRelevance,
  SmcZoneLifecycleSettings,
  SmcZoneProjection,
} from './types'

function isFinishedZone(state: SmcZoneProjection['state']): boolean {
  return (
    state === 'FILLED' ||
    state === 'MITIGATED' ||
    state === 'INVALIDATED' ||
    state === 'EXPIRED' ||
    state === 'SWEPT' ||
    state === 'BROKEN' ||
    state === 'SUPERSEDED'
  )
}

function isTouchedLike(state: SmcZoneProjection['state']): boolean {
  return state === 'TOUCHED' || state === 'PARTIALLY_MITIGATED'
}

/**
 * Filter zone projections by smart visibility preset + lifecycle settings.
 * Setup-referenced zones are always kept when setupZoneIds is provided.
 */
export function filterZonesBySmartVisibility(
  zones: readonly SmcZoneProjection[],
  preset: SmcSmartVisibilityPreset,
  settings: SmcZoneLifecycleSettings,
  setupZoneIds?: ReadonlySet<string>,
): SmcZoneProjection[] {
  return zones
    .map((zone) => {
      const setupForced = setupZoneIds?.has(zone.zoneId) === true
      let visible = true
      let reason = zone.visibilityReason

      if (preset === 'setup-focus') {
        visible = setupForced
        reason = setupForced
          ? 'Setup-referenced — always visible'
          : 'Hidden by Setup Focus (not in setup chain)'
      } else if (setupForced) {
        visible = true
        reason = 'Setup-referenced — always visible'
      } else if (preset === 'debug') {
        visible = true
        reason = 'Debug shows all lifecycle zones'
      } else if (preset === 'history') {
        visible = true
        reason = isFinishedZone(zone.state)
          ? 'History: finished zone visible but clipped'
          : 'History: active/touched zone'
      } else if (preset === 'active-only') {
        visible = zone.activeAtVisibleIndex && zone.state === 'ACTIVE'
        reason = visible
          ? 'Active Only: untouched active zone'
          : 'Hidden by Active Only (not untouched active)'
      } else {
        // balanced
        if (zone.activeAtVisibleIndex && zone.state === 'ACTIVE') {
          visible = settings.showActive
          reason = visible ? 'Balanced: active zone' : 'Hidden by lifecycle setting (active off)'
        } else if (isTouchedLike(zone.state)) {
          visible = settings.showTouched
          reason = visible
            ? 'Balanced: touched/partial zone'
            : 'Hidden by lifecycle setting (touched off)'
        } else if (zone.state === 'FILLED' || zone.state === 'MITIGATED' || zone.state === 'SWEPT') {
          visible = settings.showMitigatedFilled
          reason = visible
            ? 'Balanced: finished zone shown by setting'
            : 'Hidden by Balanced (finished lifecycle)'
        } else if (
          zone.state === 'INVALIDATED' ||
          zone.state === 'BROKEN' ||
          zone.state === 'EXPIRED'
        ) {
          visible = settings.showInvalidated
          reason = visible
            ? 'Balanced: invalidated zone shown by setting'
            : 'Hidden by Balanced (invalidated)'
        } else if (zone.state === 'SUPERSEDED') {
          visible = false
          reason = 'Hidden superseded liquidity'
        }
      }

      return {
        zone: {
          ...zone,
          visibilityReason: reason,
          setupRefs: setupForced
            ? [...new Set([...zone.setupRefs, 'setup'])]
            : zone.setupRefs,
        },
        visible,
      }
    })
    .filter((row) => row.visible)
    .map((row) => row.zone)
}

function flattenPointEvents(result: SmcDetectionResult): SmcEvent[] {
  const useClassified = result.classifiedSwings.length > 0
  return [
    ...(useClassified ? result.classifiedSwings : result.swings),
    ...result.bosEvents,
    ...result.chochEvents,
    ...result.displacementEvents,
  ]
}

/**
 * Structure / point-event relevance for smart chart visibility.
 */
export function projectStructureRelevance(
  result: SmcDetectionResult,
  visibleIndex: number,
  preset: SmcSmartVisibilityPreset,
  setupEventIds?: ReadonlySet<string>,
): SmcStructureEventProjection[] {
  const events = flattenPointEvents(result).filter((e) => e.candleIndex <= visibleIndex)
  const externalSwings = result.classifiedSwings.filter(
    (s) => s.classification === 'EXTERNAL' && s.candleIndex <= visibleIndex,
  )
  const latestExternalIds = new Set(
    [...externalSwings]
      .sort((a, b) => b.candleIndex - a.candleIndex)
      .slice(0, 4)
      .map((s) => s.id),
  )
  const latestBreaks = [...result.bosEvents, ...result.chochEvents]
    .filter((e) => e.candleIndex <= visibleIndex)
    .sort((a, b) => b.candleIndex - a.candleIndex)
    .slice(0, 4)
  const latestBreakIds = new Set(latestBreaks.map((e) => e.id))

  return events.map((event) => {
    const setupForced = setupEventIds?.has(event.id) === true
    let relevance: SmcStructureRelevance = 'HISTORICAL'
    let visible = false
    let reason = 'Historical'

    if (setupForced) {
      relevance = 'SETUP_REFERENCED'
      visible = true
      reason = 'Setup-referenced event'
    } else if (latestExternalIds.has(event.id) || latestBreakIds.has(event.id)) {
      relevance = 'CURRENT_STRUCTURE'
      visible = preset !== 'setup-focus'
      reason = 'Current external structure / latest break'
    } else if (visibleIndex - event.candleIndex <= 48) {
      relevance = 'RECENT_CONTEXT'
      visible = preset === 'history' || preset === 'debug' || preset === 'balanced'
      reason = 'Recent context'
    } else {
      relevance = 'HIDDEN_BY_DEFAULT'
      visible = preset === 'debug' || preset === 'history'
      reason = visible ? 'Shown by History/Debug' : 'Hidden by default'
    }

    if (preset === 'active-only') {
      visible = relevance === 'CURRENT_STRUCTURE' || setupForced
      if (!visible) reason = 'Hidden by Active Only'
    }
    if (preset === 'setup-focus') {
      visible = setupForced
      reason = setupForced ? 'Setup Focus chain' : 'Hidden by Setup Focus'
    }
    if (preset === 'debug') {
      visible = true
      reason = 'Debug shows all structure events'
    }

    return {
      eventId: event.id,
      kind: event.kind,
      candleIndex: event.candleIndex,
      relevance,
      visible,
      reason,
    }
  })
}

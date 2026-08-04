import type { SmcDetectionResult, SmcEvent } from '../types'
import { eventFamilyKey, scoreSmcEvent } from './score-event'
import {
  SMC_RANKING_VERSION,
  SMC_VISIBILITY_POLICIES,
  type SmcIntelligenceLayer,
  type SmcRankedEventMeta,
  type SmcRankingDiagnostics,
  type SmcVisibilityMode,
} from './types'

function listAllEvents(result: SmcDetectionResult): SmcEvent[] {
  return [
    ...result.swings,
    ...result.classifiedSwings,
    ...result.bosEvents,
    ...result.chochEvents,
    ...result.displacementEvents,
    ...result.fvgEvents,
    ...result.equalLevelEvents,
    ...result.liquiditySweepEvents,
    ...result.orderBlockEvents,
  ]
}

/** Reviewable-primary set for visibility caps (lifecycle still scored but usually low). */
function isPrimaryForVisibility(event: SmcEvent, result: SmcDetectionResult): boolean {
  if (
    event.kind === 'FVG_TOUCHED' ||
    event.kind === 'FVG_HALF_FILLED' ||
    event.kind === 'FVG_FULLY_FILLED' ||
    event.kind === 'FVG_INVALIDATED' ||
    event.kind === 'ORDER_BLOCK_TOUCHED' ||
    event.kind === 'ORDER_BLOCK_MITIGATED' ||
    event.kind === 'ORDER_BLOCK_INVALIDATED'
  ) {
    return false
  }
  if (
    (event.kind === 'SWING_HIGH' || event.kind === 'SWING_LOW') &&
    result.classifiedSwings.length > 0
  ) {
    return false
  }
  return true
}

function buildNeighborIndex(events: SmcEvent[]): Map<string, SmcEvent[]> {
  const byFamily = new Map<string, SmcEvent[]>()
  for (const event of events) {
    const key = eventFamilyKey(event.kind)
    const list = byFamily.get(key) ?? []
    list.push(event)
    byFamily.set(key, list)
  }
  for (const list of byFamily.values()) {
    list.sort((a, b) => a.candleIndex - b.candleIndex)
  }
  return byFamily
}

function nearbyPeers(
  event: SmcEvent,
  byFamily: Map<string, SmcEvent[]>,
  window = 2,
): string[] {
  const peers = byFamily.get(eventFamilyKey(event.kind)) ?? []
  return peers
    .filter(
      (p) =>
        p.id !== event.id && Math.abs(p.candleIndex - event.candleIndex) <= window,
    )
    .map((p) => p.id)
}

function priorContinuationBos(event: SmcEvent, bosEvents: SmcDetectionResult['bosEvents']): boolean {
  if (!event.kind.includes('BOS') || event.kind.includes('ORDER')) return false
  const bull = event.kind.startsWith('BULLISH')
  return bosEvents.some(
    (b) =>
      b.id !== event.id &&
      b.candleIndex < event.candleIndex &&
      b.kind === (bull ? 'BULLISH_BOS' : 'BEARISH_BOS') &&
      event.candleIndex - b.candleIndex <= 40,
  )
}

function sweepBeforeReversal(
  event: SmcEvent,
  result: SmcDetectionResult,
  window = 8,
): boolean {
  if (!event.kind.includes('LIQUIDITY_SWEEP')) return false
  const buy = event.kind === 'BUY_SIDE_LIQUIDITY_SWEEP'
  // Buy-side sweep (highs) often precedes bearish reversal; sell-side precedes bullish.
  const breaks = [...result.chochEvents, ...result.bosEvents, ...result.displacementEvents]
  return breaks.some((b) => {
    if (b.candleIndex <= event.candleIndex || b.candleIndex - event.candleIndex > window) {
      return false
    }
    if (buy) {
      return (
        b.kind === 'BEARISH_CHOCH' ||
        b.kind === 'BEARISH_BOS' ||
        b.kind === 'BEARISH_DISPLACEMENT'
      )
    }
    return (
      b.kind === 'BULLISH_CHOCH' ||
      b.kind === 'BULLISH_BOS' ||
      b.kind === 'BULLISH_DISPLACEMENT'
    )
  })
}

function emptyDiagnostics(mode: SmcVisibilityMode): SmcRankingDiagnostics {
  return {
    detectedEvents: 0,
    visibleEvents: 0,
    hiddenByRanking: 0,
    averageImportance: 0,
    highestImportance: 0,
    lowestImportance: 0,
    mode,
    focusThreshold: SMC_VISIBILITY_POLICIES.focus.minScore,
    balancedThreshold: SMC_VISIBILITY_POLICIES.balanced.minScore,
    focusMaxVisible: SMC_VISIBILITY_POLICIES.focus.maxVisible,
    balancedMaxVisible: SMC_VISIBILITY_POLICIES.balanced.maxVisible,
  }
}

/**
 * Rank all detector events and mark visibility for the given mode.
 * Never deletes or mutates detector event payloads.
 */
export function rankSmcDetectionResult(
  result: SmcDetectionResult,
  mode: SmcVisibilityMode = 'balanced',
): SmcIntelligenceLayer {
  const events = listAllEvents(result)
  const candleCount = result.diagnostics.candleCount || 1
  const byFamily = buildNeighborIndex(events)
  const byEventId: Record<string, SmcRankedEventMeta> = {}

  for (const event of events) {
    const scored = scoreSmcEvent(event, result, {
      candleCount,
      nearbySameFamilyIds: nearbyPeers(event, byFamily),
      priorContinuationBos: priorContinuationBos(event, result.bosEvents),
      sweepBeforeReversal: sweepBeforeReversal(event, result),
    })
    byEventId[event.id] = {
      eventId: event.id,
      importanceScore: scored.importanceScore,
      importanceReasons: scored.importanceReasons,
      visible: false,
    }
  }

  const policy = SMC_VISIBILITY_POLICIES[mode]
  const primary = events.filter((e) => isPrimaryForVisibility(e, result))
  const rankedPrimary = [...primary].sort((a, b) => {
    const sa = byEventId[a.id]?.importanceScore ?? 0
    const sb = byEventId[b.id]?.importanceScore ?? 0
    if (sb !== sa) return sb - sa
    return a.candleIndex - b.candleIndex
  })

  const visibleIds = new Set<string>()
  if (mode === 'debug') {
    for (const event of events) visibleIds.add(event.id)
  } else {
    let count = 0
    for (const event of rankedPrimary) {
      const meta = byEventId[event.id]
      if (!meta) continue
      if (meta.importanceScore < policy.minScore) continue
      if (count >= policy.maxVisible) break
      visibleIds.add(event.id)
      count += 1
    }
  }

  for (const id of Object.keys(byEventId)) {
    byEventId[id]!.visible = visibleIds.has(id)
  }

  const rankedEventIds = Object.values(byEventId)
    .sort((a, b) => {
      if (b.importanceScore !== a.importanceScore) {
        return b.importanceScore - a.importanceScore
      }
      return a.eventId.localeCompare(b.eventId)
    })
    .map((m) => m.eventId)

  const scores = Object.values(byEventId).map((m) => m.importanceScore)
  const detectedEvents = events.length
  const visibleEvents = visibleIds.size
  const diagnostics: SmcRankingDiagnostics = {
    ...emptyDiagnostics(mode),
    detectedEvents,
    visibleEvents,
    hiddenByRanking: Math.max(0, detectedEvents - visibleEvents),
    averageImportance:
      scores.length === 0
        ? 0
        : Math.round((scores.reduce((s, n) => s + n, 0) / scores.length) * 10) / 10,
    highestImportance: scores.length === 0 ? 0 : Math.max(...scores),
    lowestImportance: scores.length === 0 ? 0 : Math.min(...scores),
  }

  return {
    rankingVersion: SMC_RANKING_VERSION,
    mode,
    byEventId,
    rankedEventIds,
    diagnostics,
  }
}

/**
 * Attach intelligence to a detection result (immutable shallow copy).
 * Detector arrays are preserved unchanged.
 */
export function applySmcIntelligence(
  result: SmcDetectionResult,
  mode: SmcVisibilityMode = 'balanced',
): SmcDetectionResult {
  const intelligence = rankSmcDetectionResult(result, mode)
  return {
    ...result,
    intelligence,
    diagnostics: {
      ...result.diagnostics,
      ranking: intelligence.diagnostics,
    },
  }
}

/** Re-apply visibility for a new mode without re-scoring (uses existing scores when present). */
export function withSmcVisibilityMode(
  result: SmcDetectionResult,
  mode: SmcVisibilityMode,
): SmcDetectionResult {
  // Re-rank so nearby / visibility caps recompute consistently for the mode.
  return applySmcIntelligence(
    {
      ...result,
      intelligence: undefined,
      diagnostics: {
        ...result.diagnostics,
        ranking: undefined,
      },
    },
    mode,
  )
}

export function getEventImportance(
  result: SmcDetectionResult,
  eventId: string,
): SmcRankedEventMeta | null {
  return result.intelligence?.byEventId[eventId] ?? null
}

export function isEventVisibleByRanking(
  result: SmcDetectionResult,
  eventId: string,
): boolean {
  if (!result.intelligence) return true
  if (result.intelligence.mode === 'debug') return true
  return result.intelligence.byEventId[eventId]?.visible ?? false
}

/**
 * Filter detection arrays to ranking-visible events only.
 * Lifecycle and detector payloads are never deleted from the source result —
 * this returns a view copy for chart/list.
 */
export function filterDetectionByRanking(result: SmcDetectionResult): SmcDetectionResult {
  if (!result.intelligence || result.intelligence.mode === 'debug') {
    return result
  }
  const visible = (id: string) => result.intelligence!.byEventId[id]?.visible === true
  return {
    ...result,
    swings: result.swings.filter((e) => visible(e.id)),
    classifiedSwings: result.classifiedSwings.filter((e) => visible(e.id)),
    bosEvents: result.bosEvents.filter((e) => visible(e.id)),
    chochEvents: result.chochEvents.filter((e) => visible(e.id)),
    displacementEvents: result.displacementEvents.filter((e) => visible(e.id)),
    fvgEvents: result.fvgEvents.filter((e) => visible(e.id)),
    equalLevelEvents: result.equalLevelEvents.filter((e) => visible(e.id)),
    liquiditySweepEvents: result.liquiditySweepEvents.filter((e) => visible(e.id)),
    orderBlockEvents: result.orderBlockEvents.filter((e) => visible(e.id)),
  }
}

export function relatedEventsByRank(
  result: SmcDetectionResult,
  eventId: string,
  options?: { higherLimit?: number; nearbyLimit?: number; candleWindow?: number },
): { higher: SmcRankedEventMeta[]; nearbyLower: SmcRankedEventMeta[] } {
  const intelligence = result.intelligence
  const self = intelligence?.byEventId[eventId]
  if (!intelligence || !self) return { higher: [], nearbyLower: [] }

  const higherLimit = options?.higherLimit ?? 5
  const nearbyLimit = options?.nearbyLimit ?? 5
  const candleWindow = options?.candleWindow ?? 12
  const allEvents = listAllEvents(result)
  const selfEvent = allEvents.find((e) => e.id === eventId)
  const selfIndex = selfEvent?.candleIndex ?? 0

  const higher = intelligence.rankedEventIds
    .map((id) => intelligence.byEventId[id]!)
    .filter((m) => m.eventId !== eventId && m.importanceScore > self.importanceScore)
    .slice(0, higherLimit)

  const nearbyLower = allEvents
    .filter(
      (e) =>
        e.id !== eventId &&
        Math.abs(e.candleIndex - selfIndex) <= candleWindow &&
        (intelligence.byEventId[e.id]?.importanceScore ?? 0) < self.importanceScore,
    )
    .map((e) => intelligence.byEventId[e.id]!)
    .filter(Boolean)
    .sort((a, b) => b.importanceScore - a.importanceScore)
    .slice(0, nearbyLimit)

  return { higher, nearbyLower }
}

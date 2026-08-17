import type { Candle } from '@/data/candles'
import { detectSmc, detectSmcUntil } from '../detection-pipeline'
import type { SmcDetectionResult, SmcDetectorConfig, SmcEvent } from '../types'
import { toDetectedProbes } from './probes'
import type { SmcLookAheadViolation, SmcProgressiveConsistencyReport } from './types'

function eventKey(event: { id: string; kind: string; candleIndex: number }): string {
  return `${event.kind}:${event.candleIndex}:${event.id}`
}

function flattenIds(result: SmcDetectionResult): Set<string> {
  const probes = toDetectedProbes(result)
  return new Set(probes.map((p) => p.id))
}

function flattenEvents(result: SmcDetectionResult): SmcEvent[] {
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

/**
 * Compare full-history detection with progressive detection at the last candle.
 * Also checks that each event is absent before its knowable index.
 */
export function validateProgressiveConsistency(
  candles: readonly Candle[],
  config: SmcDetectorConfig,
): SmcProgressiveConsistencyReport {
  if (candles.length === 0) {
    return {
      ok: true,
      fullHistoryEventCount: 0,
      progressiveFinalEventCount: 0,
      missingInProgressive: [],
      extraInProgressive: [],
      lookAheadViolations: [],
    }
  }

  const full = detectSmc(candles, config)
  const progressiveFinal = detectSmcUntil(candles, candles.length - 1, config)
  const fullIds = flattenIds(full)
  const progIds = flattenIds(progressiveFinal)

  const missingInProgressive = [...fullIds].filter((id) => !progIds.has(id)).sort()
  const extraInProgressive = [...progIds].filter((id) => !fullIds.has(id)).sort()

  const lookAheadViolations: SmcLookAheadViolation[] = []
  const probes = toDetectedProbes(full)

  for (const probe of probes) {
    const knowable = probe.knowableAtIndex
    if (knowable <= 0) continue
    const before = detectSmcUntil(candles, knowable - 1, config)
    const beforeIds = flattenIds(before)
    if (beforeIds.has(probe.id)) {
      lookAheadViolations.push({
        eventId: probe.id,
        kind: probe.kind,
        candleIndex: probe.candleIndex,
        knowableAtIndex: knowable,
        appearedAtIndex: knowable - 1,
        detail: `Event ${probe.id} (${probe.kind}) appeared at index ${knowable - 1} before knowable index ${knowable}`,
      })
    }
  }

  lookAheadViolations.sort((a, b) => a.eventId.localeCompare(b.eventId))

  return {
    ok:
      missingInProgressive.length === 0 &&
      extraInProgressive.length === 0 &&
      lookAheadViolations.length === 0,
    fullHistoryEventCount: fullIds.size,
    progressiveFinalEventCount: progIds.size,
    missingInProgressive,
    extraInProgressive,
    lookAheadViolations,
  }
}

/** Find the earliest progressive index where an event id appears (for diagnostics). */
export function earliestAppearanceIndex(
  candles: readonly Candle[],
  config: SmcDetectorConfig,
  eventId: string,
): number | null {
  for (let i = 0; i < candles.length; i++) {
    const result = detectSmcUntil(candles, i, config)
    if (flattenIds(result).has(eventId)) return i
  }
  return null
}

export function eventsEqualByIdentity(
  a: SmcDetectionResult,
  b: SmcDetectionResult,
): boolean {
  const keysA = flattenEvents(a)
    .map(eventKey)
    .sort()
  const keysB = flattenEvents(b)
    .map(eventKey)
    .sort()
  if (keysA.length !== keysB.length) return false
  return keysA.every((k, i) => k === keysB[i])
}

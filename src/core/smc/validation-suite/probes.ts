import type { QmlPattern } from '../qml/qml-types'
import type { SmcDetectionKind, SmcDetectionResult, SmcEvent } from '../types'
import { validationModuleForKind } from './matching'
import type { SmcDetectedEventProbe, SmcValidationModule } from './types'

function priceOf(event: SmcEvent): number {
  if ('price' in event && typeof event.price === 'number') return event.price
  if ('closePrice' in event && typeof event.closePrice === 'number') return event.closePrice
  if ('close' in event && typeof event.close === 'number') return event.close
  if ('level' in event && typeof event.level === 'number') return event.level
  if ('sweptLevel' in event && typeof event.sweptLevel === 'number') return event.sweptLevel
  if ('midpoint' in event && typeof event.midpoint === 'number') return event.midpoint
  if ('zoneHigh' in event && typeof event.zoneHigh === 'number') return event.zoneHigh
  return Number.NaN
}

function sourceStructureIdOf(event: SmcEvent): string | null {
  if ('brokenSwingId' in event && typeof event.brokenSwingId === 'string') {
    return event.brokenSwingId
  }
  if ('originalSwingId' in event && typeof event.originalSwingId === 'string') {
    return event.originalSwingId
  }
  if ('sourceBreakId' in event && typeof event.sourceBreakId === 'string') {
    return event.sourceBreakId
  }
  if ('canonicalLevelId' in event && typeof event.canonicalLevelId === 'string') {
    return event.canonicalLevelId
  }
  return null
}

function knowableAt(event: SmcEvent): number {
  if ('confirmedAtIndex' in event && typeof event.confirmedAtIndex === 'number') {
    return event.confirmedAtIndex
  }
  return event.candleIndex
}

/** Primary detection probes used for golden matching (excludes lifecycle updates). */
export function toDetectedProbes(result: SmcDetectionResult): SmcDetectedEventProbe[] {
  const useClassified = result.classifiedSwings.length > 0
  const events: SmcEvent[] = [
    ...(useClassified ? result.classifiedSwings : result.swings),
    ...result.bosEvents,
    ...result.chochEvents,
    ...result.displacementEvents,
    ...result.fvgEvents.filter(
      (e) => e.kind === 'BULLISH_FVG_CREATED' || e.kind === 'BEARISH_FVG_CREATED',
    ),
    ...result.equalLevelEvents,
    ...result.liquiditySweepEvents,
    ...result.orderBlockEvents.filter(
      (e) =>
        e.kind === 'BULLISH_ORDER_BLOCK_CREATED' ||
        e.kind === 'BEARISH_ORDER_BLOCK_CREATED',
    ),
  ]

  const base = events.map((event) => ({
    id: event.id,
    kind: event.kind,
    candleIndex: event.candleIndex,
    timestamp: event.timestamp,
    price: priceOf(event),
    sourceStructureId: sourceStructureIdOf(event),
    knowableAtIndex: knowableAt(event),
  }))

  const qmlProbes = (result.qml?.patterns ?? [])
    .filter((p) => p.status !== 'CANDIDATE')
    .map(qmlPatternToProbe)

  return [...base, ...qmlProbes]
}

/** Map a confirmed QML pattern to a golden-matching probe. */
export function qmlPatternToProbe(pattern: QmlPattern): SmcDetectedEventProbe {
  const kind: SmcDetectionKind =
    pattern.direction === 'BULLISH' ? 'BULLISH_QML' : 'BEARISH_QML'
  return {
    id: pattern.id,
    kind,
    candleIndex: pattern.createdIndex,
    timestamp: pattern.sourceCandleTime ?? pattern.createdIndex,
    price: (pattern.zoneLow + pattern.zoneHigh) / 2,
    sourceStructureId: [
      pattern.sourceSwingId,
      pattern.extremeSwingId,
      pattern.structureShiftEventId,
    ].join('|'),
    knowableAtIndex: pattern.confirmedIndex ?? pattern.createdIndex,
  }
}

export function filterProbesByModule(
  probes: readonly SmcDetectedEventProbe[],
  module: SmcValidationModule,
): SmcDetectedEventProbe[] {
  return probes.filter((p) => validationModuleForKind(p.kind) === module)
}

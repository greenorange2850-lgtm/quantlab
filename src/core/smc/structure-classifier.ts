import type { Candle } from '@/data/candles'
import { detectConfirmedSwings } from './swing-detector'
import type {
  SmcClassifiedSwingEvent,
  SmcStructureConfig,
  SmcSwingClassification,
  SmcSwingEvent,
} from './types'

export interface StructureClassificationInternal {
  classified: SmcClassifiedSwingEvent[]
  internal: SmcClassifiedSwingEvent[]
  external: SmcClassifiedSwingEvent[]
  /** Base swings annotated with classification when matched. */
  annotatedBaseSwings: SmcSwingEvent[]
}

function prominencePercent(price: number, surroundingHigh: number, surroundingLow: number): number {
  const range = surroundingHigh - surroundingLow
  if (range <= 0 || price === 0) return 0
  return (range / Math.abs(price)) * 100
}

function surroundingRange(
  candles: readonly Candle[],
  index: number,
  left: number,
  right: number,
): { high: number; low: number } {
  let high = -Infinity
  let low = Infinity
  const start = Math.max(0, index - left)
  const end = Math.min(candles.length - 1, index + right)
  for (let i = start; i <= end; i++) {
    high = Math.max(high, candles[i]!.high)
    low = Math.min(low, candles[i]!.low)
  }
  return { high, low }
}

function toClassified(
  swing: SmcSwingEvent,
  classification: 'INTERNAL' | 'EXTERNAL',
  prominence: number,
  range: { high: number; low: number },
): SmcClassifiedSwingEvent {
  const isHigh = swing.kind === 'SWING_HIGH'
  const kind =
    classification === 'INTERNAL'
      ? isHigh
        ? 'INTERNAL_SWING_HIGH'
        : 'INTERNAL_SWING_LOW'
      : isHigh
        ? 'EXTERNAL_SWING_HIGH'
        : 'EXTERNAL_SWING_LOW'

  return {
    id: `${classification === 'INTERNAL' ? 'i' : 'e'}-${swing.id}`,
    kind,
    candleIndex: swing.candleIndex,
    timestamp: swing.timestamp,
    price: swing.price,
    confirmedAtIndex: swing.confirmedAtIndex,
    confirmedAtTimestamp: swing.confirmedAtTimestamp,
    leftBars: swing.leftBars,
    rightBars: swing.rightBars,
    classification,
    originalSwingId: swing.id,
    prominence,
    surroundingRange: range,
    reason: [
      `${classification} ${isHigh ? 'Swing High' : 'Swing Low'} at index ${swing.candleIndex}.`,
      `Prominence ${prominence.toFixed(4)}%, surrounding range [${range.low}, ${range.high}].`,
      `Confirmed at index ${swing.confirmedAtIndex}. Original swing ${swing.id}.`,
    ].join(' '),
    refs: [{ id: swing.id, kind: swing.kind }],
  }
}

/**
 * Internal vs External structure classification.
 * Internal: more sensitive pivots inside the broader range.
 * External: less sensitive pivots with prominence + spacing filters.
 * No silent promotion — external requires deterministic criteria.
 */
export function classifyInternalExternalStructure(
  candles: readonly Candle[],
  baseSwings: readonly SmcSwingEvent[],
  config: SmcStructureConfig,
  visibleThroughIndex: number,
): StructureClassificationInternal {
  if (!config.enabled || candles.length === 0) {
    return {
      classified: [],
      internal: [],
      external: [],
      annotatedBaseSwings: baseSwings.map((s) => ({ ...s, classification: 'UNCLASSIFIED' })),
    }
  }

  const last = Math.min(visibleThroughIndex, candles.length - 1)

  const internalRaw = detectConfirmedSwings(
    candles,
    {
      enabled: true,
      pivotLeft: config.internalPivotLeft,
      pivotRight: config.internalPivotRight,
      equalTolerancePercent: 0,
    },
    last,
  ).swings

  const externalRaw = detectConfirmedSwings(
    candles,
    {
      enabled: true,
      pivotLeft: config.externalPivotLeft,
      pivotRight: config.externalPivotRight,
      equalTolerancePercent: 0,
    },
    last,
  ).swings

  const external: SmcClassifiedSwingEvent[] = []
  const lastExternalByKind = new Map<'SWING_HIGH' | 'SWING_LOW', SmcClassifiedSwingEvent>()

  for (const swing of externalRaw) {
    const range = surroundingRange(
      candles,
      swing.candleIndex,
      config.externalPivotLeft,
      config.externalPivotRight,
    )
    const prom = prominencePercent(swing.price, range.high, range.low)
    if (prom + 1e-12 < config.minimumExternalProminencePercent) {
      continue
    }
    const prev = lastExternalByKind.get(swing.kind)
    if (
      prev &&
      swing.candleIndex - prev.candleIndex < config.minimumExternalBarsApart
    ) {
      // Keep the more prominent; do not silently promote the weaker/closer one.
      if (prom <= prev.prominence) continue
      const idx = external.findIndex((e) => e.id === prev.id)
      if (idx >= 0) external.splice(idx, 1)
    }
    const classified = toClassified(swing, 'EXTERNAL', prom, range)
    external.push(classified)
    lastExternalByKind.set(swing.kind, classified)
  }

  const externalKeys = new Set(
    external.map((e) => `${e.kind.includes('HIGH') ? 'H' : 'L'}:${e.candleIndex}`),
  )

  const internal: SmcClassifiedSwingEvent[] = []
  for (const swing of internalRaw) {
    const key = `${swing.kind === 'SWING_HIGH' ? 'H' : 'L'}:${swing.candleIndex}`
    if (externalKeys.has(key)) continue // external wins at same bar
    const range = surroundingRange(
      candles,
      swing.candleIndex,
      config.internalPivotLeft,
      config.internalPivotRight,
    )
    const prom = prominencePercent(swing.price, range.high, range.low)
    internal.push(toClassified(swing, 'INTERNAL', prom, range))
  }

  const classified = [...external, ...internal].sort(
    (a, b) => a.confirmedAtIndex - b.confirmedAtIndex || a.candleIndex - b.candleIndex,
  )

  const classByBaseId = new Map<string, 'INTERNAL' | 'EXTERNAL'>()
  for (const c of classified) classByBaseId.set(c.originalSwingId, c.classification)

  // Also map base swings by candle index when original ids differ (different pivot windows).
  const classByIndexKind = new Map<string, 'INTERNAL' | 'EXTERNAL'>()
  for (const c of classified) {
    classByIndexKind.set(
      `${c.kind.includes('HIGH') ? 'SWING_HIGH' : 'SWING_LOW'}:${c.candleIndex}`,
      c.classification,
    )
  }

  const annotatedBaseSwings = baseSwings.map((s) => {
    const byId = classByBaseId.get(s.id)
    const byIdx = classByIndexKind.get(`${s.kind}:${s.candleIndex}`)
    const classification: SmcSwingClassification = byId ?? byIdx ?? 'UNCLASSIFIED'
    const match = classified.find(
      (c) => c.originalSwingId === s.id || c.candleIndex === s.candleIndex,
    )
    return {
      ...s,
      classification,
      prominence: match?.prominence,
      surroundingRange: match?.surroundingRange,
    }
  })

  return { classified, internal, external, annotatedBaseSwings }
}

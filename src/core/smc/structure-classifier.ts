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

/**
 * Prominence = how much the pivot dominates the next-best extreme in its window.
 * For a Swing High: (high - max(other highs)) / |high| * 100
 * For a Swing Low: (min(other lows) - low) / |low| * 100
 *
 * Previous Phase-2 formula used full window range / price, which is nearly always
 * above a 0.15% threshold on crypto and made external classification too permissive.
 */
export function swingProminence(
  candles: readonly Candle[],
  index: number,
  kind: 'SWING_HIGH' | 'SWING_LOW',
  left: number,
  right: number,
): { prominence: number; nextBestExtreme: number | null; range: { high: number; low: number } } {
  const start = Math.max(0, index - left)
  const end = Math.min(candles.length - 1, index + right)
  let high = -Infinity
  let low = Infinity
  let nextBest: number | null = null

  for (let i = start; i <= end; i++) {
    const c = candles[i]!
    high = Math.max(high, c.high)
    low = Math.min(low, c.low)
    if (i === index) continue
    if (kind === 'SWING_HIGH') {
      nextBest = nextBest == null ? c.high : Math.max(nextBest, c.high)
    } else {
      nextBest = nextBest == null ? c.low : Math.min(nextBest, c.low)
    }
  }

  const pivot = candles[index]!
  const price = kind === 'SWING_HIGH' ? pivot.high : pivot.low
  let prominence = 0
  if (nextBest != null && price !== 0) {
    prominence =
      kind === 'SWING_HIGH'
        ? ((price - nextBest) / Math.abs(price)) * 100
        : ((nextBest - price) / Math.abs(price)) * 100
    prominence = Math.max(0, prominence)
  }

  return { prominence, nextBestExtreme: nextBest, range: { high, low } }
}

function toClassified(
  swing: SmcSwingEvent,
  classification: 'INTERNAL' | 'EXTERNAL',
  prominence: number,
  nextBestExtreme: number | null,
  range: { high: number; low: number },
  promotionReason: string,
  barsFromPreviousExternal: number | null,
  replacedExternalSwingId: string | null,
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
    nextBestExtreme,
    surroundingRange: range,
    promotionReason,
    barsFromPreviousExternal,
    replacedExternalSwingId,
    reason: [
      `${classification} ${isHigh ? 'Swing High' : 'Swing Low'} at index ${swing.candleIndex}.`,
      `Prominence ${prominence.toFixed(4)}% vs next-best ${nextBestExtreme ?? 'n/a'}.`,
      `Surrounding range [${range.low}, ${range.high}].`,
      promotionReason,
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
    const { prominence, nextBestExtreme, range } = swingProminence(
      candles,
      swing.candleIndex,
      swing.kind,
      config.externalPivotLeft,
      config.externalPivotRight,
    )

    if (prominence + 1e-12 < config.minimumExternalProminencePercent) {
      // Still useful as internal candidate later; skip external.
      continue
    }

    const prev = lastExternalByKind.get(swing.kind)
    let barsFromPrevious: number | null = null
    let replacedId: string | null = null
    let promotionReason = `External: prominence ${prominence.toFixed(4)}% >= ${config.minimumExternalProminencePercent}%`

    if (prev) {
      barsFromPrevious = swing.candleIndex - prev.candleIndex
      if (barsFromPrevious < config.minimumExternalBarsApart) {
        if (prominence <= prev.prominence) {
          continue
        }
        replacedId = prev.id
        const idx = external.findIndex((e) => e.id === prev.id)
        if (idx >= 0) external.splice(idx, 1)
        promotionReason = [
          `External: prominence ${prominence.toFixed(4)}% replaced prior external ${prev.id}`,
          `(${barsFromPrevious} bars < min ${config.minimumExternalBarsApart}, prior prominence ${prev.prominence.toFixed(4)}%).`,
        ].join(' ')
      } else {
        promotionReason = [
          `External: prominence ${prominence.toFixed(4)}% >= ${config.minimumExternalProminencePercent}%`,
          `and ${barsFromPrevious} bars from prior external (min ${config.minimumExternalBarsApart}).`,
        ].join(' ')
      }
    }

    const classified = toClassified(
      swing,
      'EXTERNAL',
      prominence,
      nextBestExtreme,
      range,
      promotionReason,
      barsFromPrevious,
      replacedId,
    )
    external.push(classified)
    lastExternalByKind.set(swing.kind, classified)
  }

  const externalKeys = new Set(
    external.map((e) => `${e.kind.includes('HIGH') ? 'H' : 'L'}:${e.candleIndex}`),
  )

  const internal: SmcClassifiedSwingEvent[] = []
  for (const swing of internalRaw) {
    const key = `${swing.kind === 'SWING_HIGH' ? 'H' : 'L'}:${swing.candleIndex}`
    if (externalKeys.has(key)) continue
    const { prominence, nextBestExtreme, range } = swingProminence(
      candles,
      swing.candleIndex,
      swing.kind,
      config.internalPivotLeft,
      config.internalPivotRight,
    )
    internal.push(
      toClassified(
        swing,
        'INTERNAL',
        prominence,
        nextBestExtreme,
        range,
        'Internal: sensitive pivot not selected as external',
        null,
        null,
      ),
    )
  }

  const classified = [...external, ...internal].sort(
    (a, b) => a.confirmedAtIndex - b.confirmedAtIndex || a.candleIndex - b.candleIndex,
  )

  const classByBaseId = new Map<string, 'INTERNAL' | 'EXTERNAL'>()
  for (const c of classified) classByBaseId.set(c.originalSwingId, c.classification)

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

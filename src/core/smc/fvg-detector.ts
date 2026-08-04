import type { Candle } from '@/data/candles'
import { atr } from '@/core/indicators/atr'
import type {
  SmcDisplacementEvent,
  SmcFvgConfig,
  SmcFvgEvent,
  SmcZoneState,
} from './types'

export interface FvgDetectionInternal {
  events: SmcFvgEvent[]
}

interface ActiveFvg {
  id: string
  direction: 'BULLISH' | 'BEARISH'
  candleIndices: [number, number, number]
  createdTimestamp: number
  createdIndex: number
  upperBoundary: number
  lowerBoundary: number
  midpoint: number
  gapSize: number
  gapPercent: number
  gapAtrMultiple: number
  state: SmcZoneState
  firstMitigationTimestamp: number | null
  invalidationTimestamp: number | null
  displacementId: string | null
  reason: string
}

/**
 * Three-candle Fair Value Gap detector.
 * Appears only when candle 3 closes (no look-ahead).
 */
export function detectFairValueGaps(
  candles: readonly Candle[],
  config: SmcFvgConfig,
  visibleThroughIndex: number,
  displacements: readonly SmcDisplacementEvent[] = [],
): FvgDetectionInternal {
  if (!config.enabled || candles.length < 3) {
    return { events: [] }
  }

  const last = Math.min(visibleThroughIndex, candles.length - 1)
  const events: SmcFvgEvent[] = []
  const active: ActiveFvg[] = []
  const dispByMiddle = new Map(
    displacements.map((d) => [d.candleIndex, d] as const),
  )

  for (let i = 2; i <= last; i++) {
    const c1 = candles[i - 2]!
    const c3 = candles[i]!
    const atrValue = atr(candles, config.atrPeriod, i)

    // Bullish FVG: candle 3 low > candle 1 high
    if (c3.low > c1.high) {
      const gapSize = c3.low - c1.high
      const midPrice = (c3.low + c1.high) / 2
      const gapPercent = midPrice === 0 ? 0 : (gapSize / Math.abs(midPrice)) * 100
      const gapAtr = atrValue > 0 ? gapSize / atrValue : 0
      const sizeOk =
        gapPercent + 1e-12 >= config.minimumGapPercent &&
        gapAtr + 1e-12 >= config.minimumGapAtrMultiple
      const disp = dispByMiddle.get(i - 1) ?? null
      const dispOk =
        !config.requireDisplacementMiddleCandle ||
        (disp != null && disp.kind === 'BULLISH_DISPLACEMENT')

      if (sizeOk && dispOk) {
        const id = `fvg-bull-${i - 2}-${i}-${c3.time}`
        const zone: ActiveFvg = {
          id,
          direction: 'BULLISH',
          candleIndices: [i - 2, i - 1, i],
          createdTimestamp: c3.time,
          createdIndex: i,
          upperBoundary: c3.low,
          lowerBoundary: c1.high,
          midpoint: (c3.low + c1.high) / 2,
          gapSize,
          gapPercent,
          gapAtrMultiple: gapAtr,
          state: 'ACTIVE',
          firstMitigationTimestamp: null,
          invalidationTimestamp: null,
          displacementId: disp?.id ?? null,
          reason: [
            `Bullish FVG created at candle 3 index ${i}:`,
            `low ${c3.low} > candle1 high ${c1.high}, gap ${gapSize} (${gapPercent.toFixed(4)}%).`,
          ].join(' '),
        }
        active.push(zone)
        events.push(toCreatedEvent(zone, disp?.id ?? null))
      }
    }

    // Bearish FVG: candle 3 high < candle 1 low
    if (c3.high < c1.low) {
      const gapSize = c1.low - c3.high
      const midPrice = (c1.low + c3.high) / 2
      const gapPercent = midPrice === 0 ? 0 : (gapSize / Math.abs(midPrice)) * 100
      const gapAtr = atrValue > 0 ? gapSize / atrValue : 0
      const sizeOk =
        gapPercent + 1e-12 >= config.minimumGapPercent &&
        gapAtr + 1e-12 >= config.minimumGapAtrMultiple
      const disp = dispByMiddle.get(i - 1) ?? null
      const dispOk =
        !config.requireDisplacementMiddleCandle ||
        (disp != null && disp.kind === 'BEARISH_DISPLACEMENT')

      if (sizeOk && dispOk) {
        const id = `fvg-bear-${i - 2}-${i}-${c3.time}`
        const zone: ActiveFvg = {
          id,
          direction: 'BEARISH',
          candleIndices: [i - 2, i - 1, i],
          createdTimestamp: c3.time,
          createdIndex: i,
          upperBoundary: c1.low,
          lowerBoundary: c3.high,
          midpoint: (c1.low + c3.high) / 2,
          gapSize,
          gapPercent,
          gapAtrMultiple: gapAtr,
          state: 'ACTIVE',
          firstMitigationTimestamp: null,
          invalidationTimestamp: null,
          displacementId: disp?.id ?? null,
          reason: [
            `Bearish FVG created at candle 3 index ${i}:`,
            `high ${c3.high} < candle1 low ${c1.low}, gap ${gapSize} (${gapPercent.toFixed(4)}%).`,
          ].join(' '),
        }
        active.push(zone)
        events.push(toCreatedEvent(zone, disp?.id ?? null))
      }
    }

    // Mitigation / invalidation updates for prior FVGs (from next candle onward)
    if (!config.trackMitigation) continue
    for (const zone of active) {
      if (zone.state === 'INVALIDATED' || zone.state === 'FULLY_FILLED') continue
      if (i <= zone.createdIndex) continue
      const c = candles[i]!

      if (zone.direction === 'BULLISH') {
        // Invalidation: close below lower boundary
        if (c.close < zone.lowerBoundary) {
          zone.state = 'INVALIDATED'
          zone.invalidationTimestamp = c.time
          events.push(toStateEvent(zone, 'FVG_INVALIDATED', i, c.time))
          continue
        }
        const touched = c.low <= zone.upperBoundary
        if (!touched) continue
        if (zone.firstMitigationTimestamp == null) zone.firstMitigationTimestamp = c.time

        const fillDepth = zone.upperBoundary - c.low
        const half = zone.gapSize / 2
        if (c.low <= zone.lowerBoundary || fillDepth >= zone.gapSize) {
          zone.state = 'FULLY_FILLED'
          events.push(toStateEvent(zone, 'FVG_FULLY_FILLED', i, c.time))
        } else if (fillDepth >= half && config.mitigationMode !== 'TOUCH') {
          if (zone.state !== 'HALF_FILLED') {
            zone.state = 'HALF_FILLED'
            events.push(toStateEvent(zone, 'FVG_HALF_FILLED', i, c.time))
          }
        } else if (zone.state === 'ACTIVE') {
          zone.state = 'TOUCHED'
          events.push(toStateEvent(zone, 'FVG_TOUCHED', i, c.time))
        }
      } else {
        if (c.close > zone.upperBoundary) {
          zone.state = 'INVALIDATED'
          zone.invalidationTimestamp = c.time
          events.push(toStateEvent(zone, 'FVG_INVALIDATED', i, c.time))
          continue
        }
        const touched = c.high >= zone.lowerBoundary
        if (!touched) continue
        if (zone.firstMitigationTimestamp == null) zone.firstMitigationTimestamp = c.time

        const fillDepth = c.high - zone.lowerBoundary
        const half = zone.gapSize / 2
        if (c.high >= zone.upperBoundary || fillDepth >= zone.gapSize) {
          zone.state = 'FULLY_FILLED'
          events.push(toStateEvent(zone, 'FVG_FULLY_FILLED', i, c.time))
        } else if (fillDepth >= half && config.mitigationMode !== 'TOUCH') {
          if (zone.state !== 'HALF_FILLED') {
            zone.state = 'HALF_FILLED'
            events.push(toStateEvent(zone, 'FVG_HALF_FILLED', i, c.time))
          }
        } else if (zone.state === 'ACTIVE') {
          zone.state = 'TOUCHED'
          events.push(toStateEvent(zone, 'FVG_TOUCHED', i, c.time))
        }
      }
    }
  }

  return { events }
}

function toCreatedEvent(zone: ActiveFvg, displacementId: string | null): SmcFvgEvent {
  return {
    id: `${zone.id}-created`,
    kind: zone.direction === 'BULLISH' ? 'BULLISH_FVG_CREATED' : 'BEARISH_FVG_CREATED',
    candleIndex: zone.createdIndex,
    timestamp: zone.createdTimestamp,
    fvgId: zone.id,
    direction: zone.direction,
    candleIndices: zone.candleIndices,
    createdTimestamp: zone.createdTimestamp,
    upperBoundary: zone.upperBoundary,
    lowerBoundary: zone.lowerBoundary,
    midpoint: zone.midpoint,
    gapSize: zone.gapSize,
    gapPercent: zone.gapPercent,
    gapAtrMultiple: zone.gapAtrMultiple,
    state: 'ACTIVE',
    firstMitigationTimestamp: null,
    invalidationTimestamp: null,
    displacementId,
    reason: zone.reason,
    refs: displacementId
      ? [
          {
            id: displacementId,
            kind:
              zone.direction === 'BULLISH'
                ? 'BULLISH_DISPLACEMENT'
                : 'BEARISH_DISPLACEMENT',
          },
        ]
      : [],
  }
}

function toStateEvent(
  zone: ActiveFvg,
  kind: SmcFvgEvent['kind'],
  index: number,
  timestamp: number,
): SmcFvgEvent {
  return {
    id: `${zone.id}-${kind}-${index}`,
    kind,
    candleIndex: index,
    timestamp,
    fvgId: zone.id,
    direction: zone.direction,
    candleIndices: zone.candleIndices,
    createdTimestamp: zone.createdTimestamp,
    upperBoundary: zone.upperBoundary,
    lowerBoundary: zone.lowerBoundary,
    midpoint: zone.midpoint,
    gapSize: zone.gapSize,
    gapPercent: zone.gapPercent,
    gapAtrMultiple: zone.gapAtrMultiple,
    state: zone.state,
    firstMitigationTimestamp: zone.firstMitigationTimestamp,
    invalidationTimestamp: zone.invalidationTimestamp,
    displacementId: zone.displacementId,
    reason: `${kind} for FVG ${zone.id} at index ${index}.`,
    refs: [
      {
        id: `${zone.id}-created`,
        kind:
          zone.direction === 'BULLISH' ? 'BULLISH_FVG_CREATED' : 'BEARISH_FVG_CREATED',
      },
    ],
  }
}

import type { Candle } from '@/data/candles'
import {
  atr,
  candleBody,
  candleRange,
  lowerWick,
  upperWick,
} from '@/core/indicators/atr'
import type {
  SmcBosEvent,
  SmcChochEvent,
  SmcDisplacementConfig,
  SmcDisplacementEvent,
  SmcFvgEvent,
} from './types'

export interface DisplacementDetectionInternal {
  events: SmcDisplacementEvent[]
}

function meetsDisplacementGeometry(
  candle: Candle,
  index: number,
  candles: readonly Candle[],
  config: SmcDisplacementConfig,
): {
  ok: boolean
  direction: 'BULLISH' | 'BEARISH' | null
  body: number
  range: number
  atrValue: number
  bodyAtr: number
  bodyRange: number
  upWick: number
  lowWick: number
} {
  const body = candleBody(candle)
  const range = candleRange(candle)
  const atrValue = atr(candles, config.atrPeriod, index)
  const bodyAtr = atrValue > 0 ? body / atrValue : 0
  const bodyRange = range > 0 ? body / range : 0
  const upWick = upperWick(candle)
  const lowWick = lowerWick(candle)
  const bullish = candle.close > candle.open
  const bearish = candle.close < candle.open

  const atrOk = bodyAtr + 1e-12 >= config.minimumBodyAtrMultiple
  const ratioOk = bodyRange + 1e-12 >= config.minimumBodyToRangeRatio

  if (!atrOk || !ratioOk || range <= 0) {
    return {
      ok: false,
      direction: null,
      body,
      range,
      atrValue,
      bodyAtr,
      bodyRange,
      upWick,
      lowWick,
    }
  }

  if (bullish) {
    const oppositeWickRatio = range > 0 ? lowWick / range : 1
    const closeNearExtreme = (candle.high - candle.close) / range <= 0.25
    const ok =
      oppositeWickRatio <= config.maximumOppositeWickRatio + 1e-12 && closeNearExtreme
    return {
      ok,
      direction: ok ? 'BULLISH' : null,
      body,
      range,
      atrValue,
      bodyAtr,
      bodyRange,
      upWick,
      lowWick,
    }
  }

  if (bearish) {
    const oppositeWickRatio = range > 0 ? upWick / range : 1
    const closeNearExtreme = (candle.close - candle.low) / range <= 0.25
    const ok =
      oppositeWickRatio <= config.maximumOppositeWickRatio + 1e-12 && closeNearExtreme
    return {
      ok,
      direction: ok ? 'BEARISH' : null,
      body,
      range,
      atrValue,
      bodyAtr,
      bodyRange,
      upWick,
      lowWick,
    }
  }

  return {
    ok: false,
    direction: null,
    body,
    range,
    atrValue,
    bodyAtr,
    bodyRange,
    upWick,
    lowWick,
  }
}

/** Pure geometry check usable by CHoCH requireDisplacement without look-ahead. */
export function isDisplacementCandleAt(
  candles: readonly Candle[],
  index: number,
  config: SmcDisplacementConfig,
  direction?: 'BULLISH' | 'BEARISH',
): boolean {
  if (index < 0 || index >= candles.length) return false
  const geo = meetsDisplacementGeometry(candles[index]!, index, candles, config)
  if (!geo.ok || !geo.direction) return false
  if (direction && geo.direction !== direction) return false
  return true
}

/**
 * Displacement / impulse detector.
 * ATR and ratios at candle N use data only through N.
 */
export function detectDisplacement(
  candles: readonly Candle[],
  config: SmcDisplacementConfig,
  visibleThroughIndex: number,
  breaks: readonly (SmcBosEvent | SmcChochEvent)[] = [],
  fvgs: readonly SmcFvgEvent[] = [],
): DisplacementDetectionInternal {
  if (!config.enabled || candles.length === 0) {
    return { events: [] }
  }

  const last = Math.min(visibleThroughIndex, candles.length - 1)
  const events: SmcDisplacementEvent[] = []

  for (let i = 1; i <= last; i++) {
    const candle = candles[i]!
    const geo = meetsDisplacementGeometry(candle, i, candles, config)
    if (!geo.ok || !geo.direction) continue

    const breakMatch =
      breaks.find(
        (b) =>
          b.candleIndex === i &&
          ((geo.direction === 'BULLISH' &&
            (b.kind === 'BULLISH_BOS' || b.kind === 'BULLISH_CHOCH')) ||
            (geo.direction === 'BEARISH' &&
              (b.kind === 'BEARISH_BOS' || b.kind === 'BEARISH_CHOCH'))),
      ) ?? null

    if (config.requireStructureBreak && !breakMatch) continue

    const fvgMatch =
      fvgs.find(
        (f) =>
          (f.kind === 'BULLISH_FVG_CREATED' || f.kind === 'BEARISH_FVG_CREATED') &&
          f.candleIndices[1] === i,
      ) ?? null

    if (config.requireFvgCreation && !fvgMatch) continue

    const kind =
      geo.direction === 'BULLISH' ? 'BULLISH_DISPLACEMENT' : 'BEARISH_DISPLACEMENT'
    const refs = []
    if (breakMatch) refs.push({ id: breakMatch.id, kind: breakMatch.kind })
    if (fvgMatch) refs.push({ id: fvgMatch.id, kind: fvgMatch.kind })

    events.push({
      id: `disp-${geo.direction === 'BULLISH' ? 'bull' : 'bear'}-${i}-${candle.time}`,
      kind,
      candleIndex: i,
      timestamp: candle.time,
      closePrice: candle.close,
      bodySize: geo.body,
      fullRange: geo.range,
      atr: geo.atrValue,
      bodyAtrMultiple: geo.bodyAtr,
      bodyToRangeRatio: geo.bodyRange,
      upperWick: geo.upWick,
      lowerWick: geo.lowWick,
      structureBreakId: breakMatch?.id ?? null,
      fvgId: fvgMatch?.id ?? null,
      reason: [
        `${geo.direction} displacement at index ${i}:`,
        `close ${candle.close}, body ${geo.body.toFixed(6)}, range ${geo.range.toFixed(6)}, ATR ${geo.atrValue.toFixed(6)},`,
        `body/ATR ${geo.bodyAtr.toFixed(4)}, body/range ${geo.bodyRange.toFixed(4)},`,
        `opposite wick within ${config.maximumOppositeWickRatio}.`,
      ].join(' '),
      refs,
    })
  }

  return { events }
}

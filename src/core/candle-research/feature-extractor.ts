import type { Candle } from '@/data/candles'
import type {
  CandleDirection,
  CandleFeature,
  PreviousBreakClassification,
  PreviousCandleReference,
} from './types.js'

function clampRatio(value: number): number {
  return Math.max(0, Math.min(1, value))
}

export function classifyCandleDirection(candle: Candle): CandleDirection {
  if (candle.close > candle.open) return 'BULLISH'
  if (candle.close < candle.open) return 'BEARISH'
  return 'DOJI'
}

export function classifyPreviousBreak(input: {
  brokePreviousHigh: boolean
  brokePreviousLow: boolean
}): PreviousBreakClassification {
  if (input.brokePreviousHigh && input.brokePreviousLow) return 'BOTH'
  if (input.brokePreviousHigh) return 'HIGH_ONLY'
  if (input.brokePreviousLow) return 'LOW_ONLY'
  return 'NEITHER'
}

export function calculateRetracementDepthIntoPrevious(input: {
  candle: Candle
  previous: PreviousCandleReference | null
}): number | null {
  const previous = input.previous
  if (!previous) return null

  const previousBodySize = Math.abs(previous.close - previous.open)
  if (previousBodySize <= 0) return 0

  if (previous.direction === 'BULLISH') {
    const bodyTop = previous.close
    const depth = (bodyTop - Math.min(input.candle.low, bodyTop)) / previousBodySize
    return clampRatio(depth)
  }

  if (previous.direction === 'BEARISH') {
    const bodyBottom = previous.close
    const depth = (Math.max(input.candle.high, bodyBottom) - bodyBottom) / previousBodySize
    return clampRatio(depth)
  }

  return 0
}

function buildPreviousReference(
  candles: readonly Candle[],
  index: number,
): PreviousCandleReference | null {
  if (index <= 0) return null
  const previous = candles[index - 1]
  if (!previous) return null

  return {
    index: index - 1,
    time: previous.time,
    open: previous.open,
    high: previous.high,
    low: previous.low,
    close: previous.close,
    direction: classifyCandleDirection(previous),
  }
}

export function extractCandleFeatures(candles: readonly Candle[]): CandleFeature[] {
  return candles.map((candle, index) => {
    const direction = classifyCandleDirection(candle)
    const bodySize = Math.abs(candle.close - candle.open)
    const fullRange = Math.max(0, candle.high - candle.low)
    const upperWick = Math.max(0, candle.high - Math.max(candle.open, candle.close))
    const lowerWick = Math.max(0, Math.min(candle.open, candle.close) - candle.low)

    const previous = buildPreviousReference(candles, index)
    const brokePreviousHigh = previous ? candle.high > previous.high : false
    const brokePreviousLow = previous ? candle.low < previous.low : false

    return {
      index,
      candle,
      direction,
      bullish: direction === 'BULLISH',
      bearish: direction === 'BEARISH',
      bodySize,
      fullRange,
      upperWick,
      lowerWick,
      bodyRangeRatio: fullRange > 0 ? bodySize / fullRange : 0,
      upperWickRangeRatio: fullRange > 0 ? upperWick / fullRange : 0,
      lowerWickRangeRatio: fullRange > 0 ? lowerWick / fullRange : 0,
      previous,
      brokePreviousHigh,
      brokePreviousLow,
      previousBreakClassification: classifyPreviousBreak({
        brokePreviousHigh,
        brokePreviousLow,
      }),
      retracementDepthIntoPrevious: calculateRetracementDepthIntoPrevious({
        candle,
        previous,
      }),
    }
  })
}

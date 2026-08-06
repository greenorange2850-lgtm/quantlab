// Shared deterministic fixtures for playbook tests.

import type { PlaybookCandle, PlaybookEvent } from '../types.js'

/**
 * Build a candle series by walking price legs between `points`. Each leg
 * produces `bars` candles (a single number applies to every leg, an array
 * supplies per-leg bar counts). Leg-end candles get a slightly larger wick so
 * the swing detector sees strict local extrema at the leg endpoints.
 */
export function buildLegs(
  points: number[],
  bars: number | number[] = 8,
  startTime = Date.parse('2024-01-01T00:00:00.000Z'),
): PlaybookCandle[] {
  const candles: PlaybookCandle[] = []
  const perLeg = typeof bars === 'number' ? Array(points.length - 1).fill(bars) : bars
  let time = startTime
  let price = points[0]
  for (let p = 1; p < points.length; p++) {
    const target = points[p]
    const count = perLeg[p - 1]
    for (let b = 0; b < count; b++) {
      const open = price
      const frac = (b + 1) / count
      const close = open + (target - open) * frac
      const isEndpoint = b === count - 1
      const wick = isEndpoint ? 0.4 : 0.1
      const high = Math.max(open, close) + wick
      const low = Math.min(open, close) - wick
      candles.push({
        timestamp: new Date(time).toISOString(),
        open,
        high,
        low,
        close,
        volume: 100,
      })
      time += 3_600_000
      price = close
    }
  }
  return candles
}

export function event(
  ruleName: string,
  direction: PlaybookEvent['direction'],
  candleIndex: number,
  timestamp: string,
  metadata: Record<string, unknown> = {},
): PlaybookEvent {
  return {
    id: `${ruleName}-${candleIndex}`,
    ruleId: ruleName.toLowerCase().replace(/\s+/g, '-'),
    ruleName,
    timestamp,
    direction,
    confidence: 80,
    score: 80,
    tags: [direction],
    metadata,
    candleIndex,
  }
}

/**
 * Bullish QML Reversal fixture.
 * LH + LL downtrend (highs 104→102→99, lows 98→95→92), then a close above the
 * last lower high (99 at idx 39) on bar 54, a shallow pullback into the zone,
 * and a retest candle that closes back above the zone before rallying.
 */
export function bullishQmlCandles(): PlaybookCandle[] {
  return buildLegs([100, 104, 98, 102, 95, 99, 92, 101, 98.8, 104], [8, 8, 8, 8, 8, 8, 8, 2, 8])
}

/**
 * Bearish QML Reversal fixture.
 * HH + HL uptrend (lows 96→98→101, highs 102→105→108), then a close below the
 * last higher low (101 at idx 39) on bar 54, a shallow pullback into the zone,
 * and a retest candle that closes back below the zone before dropping.
 */
export function bearishQmlCandles(): PlaybookCandle[] {
  return buildLegs([100, 96, 102, 98, 105, 101, 108, 99, 101, 96], [8, 8, 8, 8, 8, 8, 8, 3, 8])
}

/** HH + HL uptrend with a bullish BOS and a bullish FVG near the last pullback. */
export function bullishContinuationCandles(): PlaybookCandle[] {
  return buildLegs([100, 106, 102, 110, 105, 113, 108, 116])
}

export function bullishContinuationEvents(): PlaybookEvent[] {
  const candles = bullishContinuationCandles()
  return [
    event('BOS', 'bullish', 53, candles[53].timestamp, { level: 113 }),
    event('FVG', 'bullish', 47, candles[47].timestamp, { gapTop: 108.4, gapBottom: 107.5 }),
  ]
}

/** LH + LL downtrend with a bearish BOS and a bearish order block near the last pullback. */
export function bearishContinuationCandles(): PlaybookCandle[] {
  return buildLegs([100, 94, 98, 90, 95, 87, 92, 84])
}

export function bearishContinuationEvents(): PlaybookEvent[] {
  const candles = bearishContinuationCandles()
  return [
    event('BOS', 'bearish', 53, candles[53].timestamp, { level: 87 }),
    event('Order Block', 'bearish', 47, candles[47].timestamp, { obHigh: 92.4, obLow: 91.8 }),
  ]
}

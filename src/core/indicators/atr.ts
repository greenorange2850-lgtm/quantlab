import type { Candle } from '@/data/candles'

/**
 * Average True Range at candle `index`, using only data through `index` (no look-ahead).
 * Matches the rule-engine candle-math ATR (simple mean of true ranges over the window).
 */
export function atr(
  candles: readonly Candle[],
  period: number,
  index: number,
): number {
  if (index < 1 || candles.length < 2 || period < 1) return 0
  const start = Math.max(1, index - period + 1)
  let sum = 0
  let count = 0
  for (let i = start; i <= index; i++) {
    const prev = candles[i - 1]!
    const cur = candles[i]!
    const tr = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prev.close),
      Math.abs(cur.low - prev.close),
    )
    sum += tr
    count += 1
  }
  return count > 0 ? sum / count : 0
}

export function candleBody(c: Candle): number {
  return Math.abs(c.close - c.open)
}

export function candleRange(c: Candle): number {
  return c.high - c.low
}

export function upperWick(c: Candle): number {
  return c.high - Math.max(c.open, c.close)
}

export function lowerWick(c: Candle): number {
  return Math.min(c.open, c.close) - c.low
}

export function isBullishCandle(c: Candle): boolean {
  return c.close > c.open
}

export function isBearishCandle(c: Candle): boolean {
  return c.close < c.open
}

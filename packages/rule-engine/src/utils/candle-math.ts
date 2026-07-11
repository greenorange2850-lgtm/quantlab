import type { Candle } from '../types/index.js'

export function atr(candles: Candle[], period: number, index: number): number {
  if (index < 1 || candles.length < 2) return 0
  const start = Math.max(1, index - period + 1)
  let sum = 0
  let count = 0
  for (let i = start; i <= index; i++) {
    const prev = candles[i - 1]
    const cur = candles[i]
    const tr = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prev.close),
      Math.abs(cur.low - prev.close),
    )
    sum += tr
    count++
  }
  return count > 0 ? sum / count : 0
}

export function candleBody(c: Candle): number {
  return Math.abs(c.close - c.open)
}

export function candleRange(c: Candle): number {
  return c.high - c.low
}

export function isBullish(c: Candle): boolean {
  return c.close > c.open
}

export function isBearish(c: Candle): boolean {
  return c.close < c.open
}

export function upperWick(c: Candle): number {
  return c.high - Math.max(c.open, c.close)
}

export function lowerWick(c: Candle): number {
  return Math.min(c.open, c.close) - c.low
}

export function wickRatio(c: Candle): number {
  const range = candleRange(c)
  return range > 0 ? (upperWick(c) + lowerWick(c)) / range : 0
}

export function findSwingHighs(candles: Candle[], lookback = 5): number[] {
  const swings: number[] = []
  for (let i = lookback; i < candles.length - lookback; i++) {
    let isSwing = true
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j !== i && candles[j].high >= candles[i].high) { isSwing = false; break }
    }
    if (isSwing) swings.push(i)
  }
  return swings
}

export function findSwingLows(candles: Candle[], lookback = 5): number[] {
  const swings: number[] = []
  for (let i = lookback; i < candles.length - lookback; i++) {
    let isSwing = true
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j !== i && candles[j].low <= candles[i].low) { isSwing = false; break }
    }
    if (isSwing) swings.push(i)
  }
  return swings
}

export function averageVolume(candles: Candle[], index: number, period: number): number {
  const start = Math.max(0, index - period + 1)
  let sum = 0
  for (let i = start; i <= index; i++) sum += candles[i].volume
  return sum / (index - start + 1)
}

export function ema(values: number[], period: number): number[] {
  const result: number[] = []
  const k = 2 / (period + 1)
  for (let i = 0; i < values.length; i++) {
    if (i === 0) { result.push(values[0]); continue }
    result.push(values[i] * k + result[i - 1] * (1 - k))
  }
  return result
}

export function getParam<T>(params: Record<string, unknown>, key: string, fallback: T): T {
  return (params[key] as T) ?? fallback
}

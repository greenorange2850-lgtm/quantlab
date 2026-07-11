import type { IntelligenceCandle } from '../types/index.js'

export function atr(candles: IntelligenceCandle[], period: number, index: number): number {
  if (index < 1 || candles.length < 2) return 0
  const start = Math.max(1, index - period + 1)
  let sum = 0
  let count = 0
  for (let i = start; i <= index; i++) {
    const prev = candles[i - 1]
    const cur = candles[i]
    const tr = Math.max(cur.high - cur.low, Math.abs(cur.high - prev.close), Math.abs(cur.low - prev.close))
    sum += tr
    count++
  }
  return count > 0 ? sum / count : 0
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

export function rsi(candles: IntelligenceCandle[], period: number, index: number): number {
  if (index < period) return 50
  let gains = 0
  let losses = 0
  for (let i = index - period + 1; i <= index; i++) {
    const change = candles[i].close - candles[i - 1].close
    if (change > 0) gains += change
    else losses -= change
  }
  const avgGain = gains / period
  const avgLoss = losses / period
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

export function findSwingHighs(candles: IntelligenceCandle[], lookback = 5): number[] {
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

export function findSwingLows(candles: IntelligenceCandle[], lookback = 5): number[] {
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

export function findCandleIndex(candles: IntelligenceCandle[], timestamp: string): number {
  const t = new Date(timestamp).getTime()
  const idx = candles.findIndex((c) => new Date(c.timestamp).getTime() === t)
  if (idx >= 0) return idx
  let closest = 0
  let minDiff = Infinity
  for (let i = 0; i < candles.length; i++) {
    const diff = Math.abs(new Date(candles[i].timestamp).getTime() - t)
    if (diff < minDiff) { minDiff = diff; closest = i }
  }
  return closest
}

export function trendFromCloses(closes: number[]): { direction: 'bullish' | 'bearish' | 'sideways'; strength: number } {
  if (closes.length < 2) return { direction: 'sideways', strength: 0 }
  const first = closes[0]
  const last = closes[closes.length - 1]
  const change = (last - first) / first
  const strength = Math.min(100, Math.abs(change) * 10000)
  if (change > 0.001) return { direction: 'bullish', strength }
  if (change < -0.001) return { direction: 'bearish', strength }
  return { direction: 'sideways', strength }
}

import type { RawCandle } from '../types/index.js'
import { deduplicateCandles, normalizeTimestamp, sortByTimestamp } from './candle.normalizer.js'

export function normalizeCandles(
  candles: RawCandle[],
  timezone: 'utc' | 'broker' | 'local' = 'utc',
): RawCandle[] {
  const normalized = candles.map((c) => ({
    ...c,
    timestamp: normalizeTimestamp(c.timestamp, timezone),
    volume: c.volume ?? 0,
    spread: c.spread ?? 0,
  }))

  return sortByTimestamp(deduplicateCandles(normalized))
}

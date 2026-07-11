import { TIMEFRAME_ALIASES } from '../types/index.js'

export function normalizeSymbol(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, '')
}

export function normalizeTimeframe(raw: string): string {
  const trimmed = raw.trim()
  const upper = trimmed.toUpperCase()
  if (TIMEFRAME_ALIASES[trimmed.toLowerCase()]) {
    return TIMEFRAME_ALIASES[trimmed.toLowerCase()]
  }
  return upper
}

export function normalizeTimestamp(ts: string, mode: 'utc' | 'broker' | 'local' = 'utc'): string {
  const d = new Date(ts)
  if (isNaN(d.getTime())) throw new Error(`Invalid timestamp: ${ts}`)

  if (mode === 'utc') return d.toISOString()

  // Broker/local: store as UTC but preserve instant
  return d.toISOString()
}

export function deduplicateCandles<T extends { timestamp: string }>(candles: T[]): T[] {
  const seen = new Set<string>()
  const result: T[] = []
  for (const c of candles) {
    if (seen.has(c.timestamp)) continue
    seen.add(c.timestamp)
    result.push(c)
  }
  return result
}

export function sortByTimestamp<T extends { timestamp: string }>(candles: T[]): T[] {
  return [...candles].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
}

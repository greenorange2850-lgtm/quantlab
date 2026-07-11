import type { RawCandle } from '../types/index.js'
import type { ParseDetection } from '../types/index.js'
import { parseCsv } from './csv.parser.js'

export function parseDukascopy(content: string): { candles: RawCandle[]; detection: ParseDetection; rowsSkipped: number } {
  const lines = content.split(/\r?\n/).filter((l) => l.trim())
  const hasHeader = lines[0]?.toLowerCase().includes('open')
  const dataLines = hasHeader ? lines.slice(1) : lines

  const candles: RawCandle[] = []
  let rowsSkipped = 0

  for (const line of dataLines) {
    const cols = line.split(/[,;]/).map((c) => c.trim())
    if (cols.length < 5) { rowsSkipped++; continue }

    let timestamp: string | null = null
    const tsRaw = cols[0]
    if (/^\d{13}$/.test(tsRaw)) timestamp = new Date(Number(tsRaw)).toISOString()
    else if (/^\d{10}$/.test(tsRaw)) timestamp = new Date(Number(tsRaw) * 1000).toISOString()
    else {
      const d = new Date(tsRaw)
      timestamp = isNaN(d.getTime()) ? null : d.toISOString()
    }

    if (!timestamp) { rowsSkipped++; continue }

    const open = parseFloat(cols[1])
    const high = parseFloat(cols[2])
    const low = parseFloat(cols[3])
    const close = parseFloat(cols[4])
    if ([open, high, low, close].some(isNaN)) { rowsSkipped++; continue }

    candles.push({
      timestamp, open, high, low, close,
      volume: parseFloat(cols[5] ?? '0') || 0,
    })
  }

  if (candles.length === 0) {
    const fallback = parseCsv(content)
    return { ...fallback, detection: { ...fallback.detection, timezone: 'utc' } }
  }

  return {
    candles,
    detection: { delimiter: ',', hasHeader, dateFormat: 'unix_ms', columns: {}, timezone: 'utc' },
    rowsSkipped,
  }
}

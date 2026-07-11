import type { RawCandle } from '../types/index.js'
import type { ParseDetection } from '../types/index.js'
import { detectFormat, parseDateValue } from './detector.js'

export function parseCsv(content: string, detection?: ParseDetection): { candles: RawCandle[]; detection: ParseDetection; rowsSkipped: number } {
  const fmt = detection ?? detectFormat(content)
  const lines = content.split(/\r?\n/).filter((l) => l.trim())
  const dataLines = fmt.hasHeader ? lines.slice(1) : lines

  const candles: RawCandle[] = []
  let rowsSkipped = 0

  for (const line of dataLines) {
    const cols = line.split(fmt.delimiter).map((c) => c.trim())

    const dateIdx = fmt.columns.date ?? 0
    let timestamp = parseDateValue(cols[dateIdx] ?? '', fmt.dateFormat)

    if (!timestamp && fmt.columns.date !== undefined && cols.length > 1) {
      const combined = `${cols[dateIdx]} ${cols[dateIdx + 1]}`
      timestamp = parseDateValue(combined, 'YYYY-MM-DD HH:mm:ss')
    }

    if (!timestamp) {
      rowsSkipped++
      continue
    }

    const parseNum = (idx: number | undefined, fallback: number) => {
      if (idx === undefined) return fallback
      const v = parseFloat(cols[idx]?.replace(/"/g, '') ?? '')
      return isNaN(v) ? fallback : v
    }

    const open = parseNum(fmt.columns.open, NaN)
    const high = parseNum(fmt.columns.high, NaN)
    const low = parseNum(fmt.columns.low, NaN)
    const close = parseNum(fmt.columns.close, NaN)

    if ([open, high, low, close].some(isNaN)) {
      rowsSkipped++
      continue
    }

    candles.push({
      timestamp,
      open, high, low, close,
      volume: parseNum(fmt.columns.volume, 0),
      spread: parseNum(fmt.columns.spread, 0),
    })
  }

  return { candles, detection: fmt, rowsSkipped }
}

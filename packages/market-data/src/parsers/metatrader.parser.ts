import type { RawCandle } from '../types/index.js'
import type { ParseDetection } from '../types/index.js'
import { parseCsv } from './csv.parser.js'

export function parseMetaTrader(content: string): { candles: RawCandle[]; detection: ParseDetection; rowsSkipped: number } {
  if (content.trim().startsWith('<') || content.includes('\t')) {
    return parseMtTab(content)
  }
  const result = parseCsv(content)
  return { ...result, detection: { ...result.detection, timezone: 'broker' } }
}

function parseMtTab(content: string): { candles: RawCandle[]; detection: ParseDetection; rowsSkipped: number } {
  const lines = content.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('<'))
  const candles: RawCandle[] = []
  let rowsSkipped = 0

  for (const line of lines) {
    const cols = line.split('\t').map((c) => c.trim())
    if (cols.length < 6) { rowsSkipped++; continue }

    const dateStr = cols[0].replace(/\./g, '-')
    const d = new Date(`${dateStr}T${cols[1] ?? '00:00'}:00Z`)
    if (isNaN(d.getTime())) { rowsSkipped++; continue }

    const open = parseFloat(cols[2])
    const high = parseFloat(cols[3])
    const low = parseFloat(cols[4])
    const close = parseFloat(cols[5])
    if ([open, high, low, close].some(isNaN)) { rowsSkipped++; continue }

    candles.push({
      timestamp: d.toISOString(),
      open, high, low, close,
      volume: parseFloat(cols[6] ?? '0') || 0,
      spread: parseFloat(cols[8] ?? '0') || 0,
    })
  }

  return {
    candles,
    detection: { delimiter: '\t', hasHeader: true, dateFormat: 'YYYY.MM.DD', columns: {}, timezone: 'broker' },
    rowsSkipped,
  }
}

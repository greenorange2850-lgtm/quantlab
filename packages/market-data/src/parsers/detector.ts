import type { ParseDetection } from '../types/index.js'

const COLUMN_ALIASES: Record<string, string[]> = {
  date: ['date', 'time', 'datetime', 'timestamp', 'dt'],
  open: ['open', 'o'],
  high: ['high', 'h'],
  low: ['low', 'l'],
  close: ['close', 'c'],
  volume: ['volume', 'vol', 'tickvol', 'tick_volume', 'tick volume'],
  spread: ['spread', 'sp'],
}

export function detectDelimiter(line: string): string {
  const counts = { ',': 0, ';': 0, '\t': 0 }
  for (const ch of line) {
    if (ch in counts) counts[ch as keyof typeof counts]++
  }
  if (counts['\t'] >= counts[','] && counts['\t'] >= counts[';']) return '\t'
  if (counts[';'] > counts[',']) return ';'
  return ','
}

export function detectFormat(content: string): ParseDetection {
  const lines = content.split(/\r?\n/).filter((l) => l.trim())
  const firstLine = lines[0] ?? ''
  const delimiter = detectDelimiter(firstLine)
  const cols = firstLine.split(delimiter).map((c) => c.trim().toLowerCase().replace(/[<>]/g, ''))

  const hasHeader = cols.some((c) =>
    Object.values(COLUMN_ALIASES).flat().some((alias) => c.includes(alias)),
  )

  const columns: Record<string, number> = {}
  if (hasHeader) {
    for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
      const idx = cols.findIndex((c) => aliases.some((a) => c === a || c.includes(a)))
      if (idx >= 0) columns[key] = idx
    }
  } else {
    columns.date = 0
    columns.open = 1
    columns.high = 2
    columns.low = 3
    columns.close = 4
    columns.volume = 5
  }

  const sampleLine = hasHeader ? lines[1] : lines[0]
  const dateFormat = detectDateFormat(sampleLine?.split(delimiter)[columns.date] ?? '')

  return {
    delimiter,
    hasHeader,
    dateFormat,
    columns,
    timezone: 'utc',
  }
}

function detectDateFormat(sample: string): string {
  if (/^\d{13}$/.test(sample)) return 'unix_ms'
  if (/^\d{10}$/.test(sample)) return 'unix_s'
  if (/\d{4}\.\d{2}\.\d{2}/.test(sample)) return 'YYYY.MM.DD'
  if (/\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/.test(sample)) return 'YYYY-MM-DD HH:mm:ss'
  if (/\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(sample)) return 'YYYY-MM-DD HH:mm'
  return 'ISO'
}

export function parseDateValue(value: string, format: string): string | null {
  const trimmed = value.trim().replace(/"/g, '')

  if (format === 'unix_ms') return new Date(Number(trimmed)).toISOString()
  if (format === 'unix_s') return new Date(Number(trimmed) * 1000).toISOString()

  const isoCandidate = trimmed
    .replace(/\./g, '-')
    .replace(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}(?::\d{2})?)$/, '$1T$2Z')

  const d = new Date(isoCandidate.includes('T') ? isoCandidate : trimmed.replace(' ', 'T'))
  return isNaN(d.getTime()) ? null : d.toISOString()
}

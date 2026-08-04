import type { Candle } from '../candles.js'
import type { CandleInterval } from '../providers/MarketDataProvider.js'
import type { CsvImportFilePreview, DatasetMarketType } from './types.js'

const KNOWN_TIMEFRAMES = [
  '1m',
  '3m',
  '5m',
  '15m',
  '30m',
  '1h',
  '2h',
  '4h',
  '6h',
  '8h',
  '12h',
  '1d',
  '3d',
  '1w',
  '1M',
] as const

const TIMEFRAME_ALIASES: Record<string, CandleInterval> = {
  '1m': '1m',
  '1min': '1m',
  m1: '1m',
  '3m': '3m',
  '3min': '3m',
  m3: '3m',
  '5m': '5m',
  '5min': '5m',
  m5: '5m',
  '15m': '15m',
  '15min': '15m',
  m15: '15m',
  '30m': '30m',
  '30min': '30m',
  m30: '30m',
  '1h': '1h',
  '1hr': '1h',
  '1hour': '1h',
  h1: '1h',
  '60m': '1h',
  '2h': '2h',
  h2: '2h',
  '4h': '4h',
  h4: '4h',
  '240m': '4h',
  '6h': '6h',
  h6: '6h',
  '8h': '8h',
  h8: '8h',
  '12h': '12h',
  h12: '12h',
  '1d': '1d',
  '1day': '1d',
  daily: '1d',
  d1: '1d',
  '3d': '3d',
  d3: '3d',
  '1w': '1w',
  weekly: '1w',
  w1: '1w',
  '1M': '1M',
  monthly: '1M',
  mn1: '1M',
}

const TIMESTAMP_HEADERS = new Set([
  'timestamp',
  'time',
  'date',
  'datetime',
  'open time',
  'opentime',
  'date time',
  'gmt time',
  'local time',
])

const OPEN_HEADERS = new Set(['open', 'o', 'open price'])
const HIGH_HEADERS = new Set(['high', 'h', 'high price'])
const LOW_HEADERS = new Set(['low', 'l', 'low price'])
const CLOSE_HEADERS = new Set(['close', 'c', 'close price', 'adj close', 'adjclose'])
const VOLUME_HEADERS = new Set(['volume', 'vol', 'v', 'tick volume', 'tickvolume'])

export class CsvValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CsvValidationError'
  }
}

export function detectTimeframeFromFilename(fileName: string): CandleInterval | null {
  const base = fileName.replace(/\.[^.]+$/, '').toLowerCase()

  // Prefer delimited tokens: XAU_15m_data, XAUUSD-1h, BTCUSDT.4h
  const delimited = base.match(/(?:^|[_\-.\s])([a-z0-9]+)(?=$|[_\-.\s])/gi)
  if (delimited) {
    for (const raw of delimited) {
      const token = raw.replace(/^[_\-.\s]+/, '').toLowerCase()
      if (TIMEFRAME_ALIASES[token]) return TIMEFRAME_ALIASES[token]
    }
  }

  // Fallback: longest known alias appearing as a substring with word-ish boundaries
  const sortedAliases = Object.keys(TIMEFRAME_ALIASES).sort((a, b) => b.length - a.length)
  for (const alias of sortedAliases) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i')
    if (re.test(base)) return TIMEFRAME_ALIASES[alias]!
  }

  return null
}

export function detectSymbolFromFilename(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '')
  const parts = base.split(/[_\-.\s]+/).filter(Boolean)
  const skip = new Set([
    'data',
    'ohlc',
    'ohlcv',
    'candles',
    'candle',
    'export',
    'history',
    'historical',
    ...Object.keys(TIMEFRAME_ALIASES),
    ...KNOWN_TIMEFRAMES,
  ])

  for (const part of parts) {
    const upper = part.toUpperCase()
    if (skip.has(part.toLowerCase())) continue
    if (/^[A-Z]{2,12}$/i.test(part)) return upper
  }

  return parts[0]?.toUpperCase() ?? 'UNKNOWN'
}

export function inferMarketType(symbol: string): DatasetMarketType {
  const upper = symbol.toUpperCase()
  if (upper.includes('XAU') || upper.includes('GOLD')) return 'gold'
  if (
    upper.includes('USDT') ||
    upper.includes('USDC') ||
    upper.includes('BTC') ||
    upper.includes('ETH') ||
    upper.endsWith('USD') && (upper.includes('BTC') || upper.includes('ETH'))
  ) {
    return 'crypto'
  }
  if (
    /^[A-Z]{6}$/.test(upper) ||
    upper.includes('EUR') ||
    upper.includes('GBP') ||
    upper.includes('JPY') ||
    upper.includes('USD') && upper.length === 6
  ) {
    return 'forex'
  }
  return 'other'
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[_/]+/g, ' ').replace(/\s+/g, ' ')
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === ',' && !inQuotes) {
      cells.push(current.trim())
      current = ''
      continue
    }
    current += ch
  }
  cells.push(current.trim())
  return cells
}

export function parseTimestamp(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const numeric = Number(trimmed)
    if (!Number.isFinite(numeric)) return null
    // Seconds vs milliseconds heuristic
    if (numeric > 0 && numeric < 1e12) return Math.round(numeric * 1000)
    return Math.round(numeric)
  }

  // Normalize "YYYY-MM-DD HH:mm:ss" → ISO-ish
  const normalized = trimmed.includes('T')
    ? trimmed
    : trimmed.replace(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}(?::\d{2})?)/, '$1T$2')

  const withZone =
    /Z$|[+-]\d{2}:?\d{2}$/.test(normalized) || !/^\d{4}-\d{2}-\d{2}/.test(normalized)
      ? normalized
      : `${normalized}${normalized.includes('T') ? 'Z' : 'T00:00:00.000Z'}`

  const ms = Date.parse(withZone)
  return Number.isFinite(ms) ? ms : null
}

function parseNumber(raw: string, field: string, rowIndex: number): number {
  const cleaned = raw.replace(/,/g, '').trim()
  if (!cleaned) {
    throw new CsvValidationError(`Row ${rowIndex}: missing ${field}`)
  }
  const value = Number(cleaned)
  if (!Number.isFinite(value)) {
    throw new CsvValidationError(`Row ${rowIndex}: invalid ${field} "${raw}"`)
  }
  return value
}

function resolveColumnMap(headers: string[]): {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number | null
} {
  const normalized = headers.map(normalizeHeader)
  const find = (set: Set<string>) => normalized.findIndex((h) => set.has(h))

  const time = find(TIMESTAMP_HEADERS)
  const open = find(OPEN_HEADERS)
  const high = find(HIGH_HEADERS)
  const low = find(LOW_HEADERS)
  const close = find(CLOSE_HEADERS)
  const volume = find(VOLUME_HEADERS)

  const missing: string[] = []
  if (time < 0) missing.push('timestamp')
  if (open < 0) missing.push('open')
  if (high < 0) missing.push('high')
  if (low < 0) missing.push('low')
  if (close < 0) missing.push('close')

  if (missing.length > 0) {
    throw new CsvValidationError(
      `Missing required columns: ${missing.join(', ')}. Expected headers like timestamp, open, high, low, close (volume optional).`,
    )
  }

  return {
    time,
    open,
    high,
    low,
    close,
    volume: volume >= 0 ? volume : null,
  }
}

export function validateOhlc(candle: Candle, rowIndex: number): void {
  if (!(candle.high >= Math.max(candle.open, candle.close))) {
    throw new CsvValidationError(
      `Row ${rowIndex}: high (${candle.high}) must be ≥ open/close`,
    )
  }
  if (!(candle.low <= Math.min(candle.open, candle.close))) {
    throw new CsvValidationError(
      `Row ${rowIndex}: low (${candle.low}) must be ≤ open/close`,
    )
  }
  if (candle.volume < 0) {
    throw new CsvValidationError(`Row ${rowIndex}: volume cannot be negative`)
  }
}

export interface ParseOhlcvCsvOptions {
  /** Soft OHLC validation — warn instead of reject. Default false (strict). */
  softOhlc?: boolean
  /** Yield to event loop every N rows during large imports. */
  yieldEvery?: number
  onProgress?: (parsedRows: number, totalLines: number) => void
}

/**
 * Parse an OHLCV CSV string into normalized Candle[].
 * Throws CsvValidationError with a friendly message on invalid input.
 */
export async function parseOhlcvCsv(
  text: string,
  options: ParseOhlcvCsvOptions = {},
): Promise<{ candles: Candle[]; warnings: string[] }> {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length < 2) {
    throw new CsvValidationError('CSV file is empty or has no data rows')
  }

  const headers = parseCsvLine(lines[0]!)
  const columns = resolveColumnMap(headers)
  const candles: Candle[] = []
  const warnings: string[] = []
  const yieldEvery = options.yieldEvery ?? 2_500
  const softOhlc = options.softOhlc ?? false

  for (let i = 1; i < lines.length; i++) {
    const rowIndex = i + 1
    const cells = parseCsvLine(lines[i]!)
    if (cells.every((cell) => cell === '')) continue

    const timeRaw = cells[columns.time] ?? ''
    const time = parseTimestamp(timeRaw)
    if (time === null) {
      throw new CsvValidationError(
        `Row ${rowIndex}: invalid timestamp "${timeRaw}". Use ISO dates or Unix epoch.`,
      )
    }

    const candle: Candle = {
      time,
      open: parseNumber(cells[columns.open] ?? '', 'open', rowIndex),
      high: parseNumber(cells[columns.high] ?? '', 'high', rowIndex),
      low: parseNumber(cells[columns.low] ?? '', 'low', rowIndex),
      close: parseNumber(cells[columns.close] ?? '', 'close', rowIndex),
      volume:
        columns.volume !== null
          ? parseNumber(cells[columns.volume] ?? '0', 'volume', rowIndex)
          : 0,
    }

    try {
      validateOhlc(candle, rowIndex)
    } catch (error) {
      if (softOhlc && error instanceof CsvValidationError) {
        warnings.push(error.message)
      } else {
        throw error
      }
    }

    candles.push(candle)

    if (i % yieldEvery === 0) {
      options.onProgress?.(candles.length, lines.length - 1)
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    }
  }

  if (candles.length === 0) {
    throw new CsvValidationError('CSV file has headers but no valid candle rows')
  }

  candles.sort((a, b) => a.time - b.time)

  // Drop exact duplicate timestamps (keep last)
  const deduped: Candle[] = []
  for (const candle of candles) {
    if (deduped.length > 0 && deduped[deduped.length - 1]!.time === candle.time) {
      deduped[deduped.length - 1] = candle
    } else {
      deduped.push(candle)
    }
  }

  options.onProgress?.(deduped.length, lines.length - 1)
  return { candles: deduped, warnings }
}

export async function parseCsvFile(
  file: File,
  options: ParseOhlcvCsvOptions & {
    onFileProgress?: (ratio: number) => void
  } = {},
): Promise<CsvImportFilePreview> {
  const timeframe = detectTimeframeFromFilename(file.name)
  if (!timeframe) {
    throw new CsvValidationError(
      `Could not detect timeframe from filename "${file.name}". Use names like XAU_15m_data.csv or BTCUSDT_1h.csv.`,
    )
  }

  options.onFileProgress?.(0.05)
  const text = await file.text()
  options.onFileProgress?.(0.2)

  const { candles, warnings } = await parseOhlcvCsv(text, {
    ...options,
    onProgress: (parsed, total) => {
      const ratio = 0.2 + 0.75 * (total > 0 ? parsed / total : 1)
      options.onFileProgress?.(Math.min(0.95, ratio))
      options.onProgress?.(parsed, total)
    },
  })

  const symbol = detectSymbolFromFilename(file.name)
  options.onFileProgress?.(1)

  return {
    fileName: file.name,
    fileSize: file.size,
    symbol,
    timeframe,
    rowCount: candles.length,
    startDate: candles[0]!.time,
    endDate: candles[candles.length - 1]!.time,
    candles,
    warnings,
  }
}

export function buildImportPreview(files: CsvImportFilePreview[]): import('./types.js').CsvImportPreview {
  if (files.length === 0) {
    throw new CsvValidationError('Select at least one CSV file to import')
  }

  const timeframeSet = new Set<string>()
  for (const file of files) {
    if (timeframeSet.has(file.timeframe)) {
      throw new CsvValidationError(
        `Duplicate timeframe ${file.timeframe} in files "${files.find((f) => f.timeframe === file.timeframe)?.fileName}" and "${file.fileName}".`,
      )
    }
    timeframeSet.add(file.timeframe)
  }

  const symbols = [...new Set(files.map((f) => f.symbol))]
  const suggestedSymbol = symbols[0] ?? 'UNKNOWN'
  const startDate = Math.min(...files.map((f) => f.startDate))
  const endDate = Math.max(...files.map((f) => f.endDate))
  const marketType = inferMarketType(suggestedSymbol)
  const marketLabel =
    marketType === 'gold'
      ? 'Gold'
      : marketType === 'forex'
        ? 'Forex'
        : marketType === 'crypto'
          ? 'Crypto'
          : suggestedSymbol

  return {
    files,
    suggestedName: `${marketLabel} (${suggestedSymbol})`,
    suggestedSymbol,
    suggestedMarketType: marketType,
    totalRows: files.reduce((sum, f) => sum + f.rowCount, 0),
    totalFileSize: files.reduce((sum, f) => sum + f.fileSize, 0),
    timeframes: files.map((f) => f.timeframe).sort(compareTimeframes),
    startDate,
    endDate,
  }
}

function compareTimeframes(a: string, b: string): number {
  const order = KNOWN_TIMEFRAMES as readonly string[]
  const ai = order.indexOf(a)
  const bi = order.indexOf(b)
  if (ai === -1 && bi === -1) return a.localeCompare(b)
  if (ai === -1) return 1
  if (bi === -1) return -1
  return ai - bi
}

export { KNOWN_TIMEFRAMES }

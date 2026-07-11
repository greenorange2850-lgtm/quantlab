export interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

/** Raw kline tuple returned by Binance GET /api/v3/klines */
export type BinanceKlineRaw = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string,
]

function parseNumericField(value: unknown, field: string): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid Binance kline field "${field}": expected a finite number`)
  }
  return parsed
}

function assertBinanceKlineRaw(raw: unknown): asserts raw is BinanceKlineRaw {
  if (!Array.isArray(raw) || raw.length < 6) {
    throw new Error('Invalid Binance kline: expected an array with at least 6 elements')
  }
}

export function normalizeBinanceKline(raw: unknown): Candle {
  assertBinanceKlineRaw(raw)

  return {
    time: parseNumericField(raw[0], 'open time'),
    open: parseNumericField(raw[1], 'open'),
    high: parseNumericField(raw[2], 'high'),
    low: parseNumericField(raw[3], 'low'),
    close: parseNumericField(raw[4], 'close'),
    volume: parseNumericField(raw[5], 'volume'),
  }
}

export function normalizeBinanceKlines(raw: unknown): Candle[] {
  if (!Array.isArray(raw)) {
    throw new Error('Invalid Binance klines response: expected an array')
  }

  if (raw.length === 0) {
    throw new Error('Binance API returned no candle data')
  }

  return raw.map(normalizeBinanceKline)
}

export function extractClosePrices(candles: Candle[]): number[] {
  return candles.map((candle) => candle.close)
}

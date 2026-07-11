import { normalizeBinanceKlines, type Candle } from './candles.js'

export const BINANCE_BASE_URL = 'https://api.binance.com'

export type KlineInterval =
  | '1m'
  | '3m'
  | '5m'
  | '15m'
  | '30m'
  | '1h'
  | '2h'
  | '4h'
  | '6h'
  | '8h'
  | '12h'
  | '1d'
  | '3d'
  | '1w'
  | '1M'

export function parseBinanceKlinesResponse(data: unknown): Candle[] {
  return normalizeBinanceKlines(data)
}

function validateFetchParams(symbol: string, interval: string, limit: number): void {
  if (!symbol.trim()) {
    throw new Error('symbol must be a non-empty string')
  }
  if (!interval.trim()) {
    throw new Error('interval must be a non-empty string')
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
    throw new Error('limit must be an integer between 1 and 1000')
  }
}

export async function fetchKlines(
  symbol: string,
  interval: KlineInterval | string,
  limit: number,
): Promise<Candle[]> {
  validateFetchParams(symbol, interval, limit)

  const params = new URLSearchParams({
    symbol: symbol.toUpperCase(),
    interval,
    limit: String(limit),
  })
  const url = `${BINANCE_BASE_URL}/api/v3/klines?${params.toString()}`

  let response: Response
  try {
    response = await fetch(url)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Binance API request failed: ${message}`)
  }

  if (!response.ok) {
    throw new Error(`Binance API error: ${response.status} ${response.statusText}`)
  }

  let data: unknown
  try {
    data = await response.json()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Binance API returned invalid JSON: ${message}`)
  }

  return parseBinanceKlinesResponse(data)
}

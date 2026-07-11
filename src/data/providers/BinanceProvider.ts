import { normalizeBinanceKlines, type Candle } from '../candles.js'
import type { CandleInterval, GetCandlesParams, MarketDataProvider } from './MarketDataProvider.js'

export const BINANCE_BASE_URL = 'https://api.binance.com'

/** @deprecated Use CandleInterval from MarketDataProvider */
export type KlineInterval = CandleInterval

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

export class BinanceProvider implements MarketDataProvider {
  async getCandles(params: GetCandlesParams): Promise<Candle[]> {
    const { symbol, interval, limit } = params
    validateFetchParams(symbol, interval, limit)

    const query = new URLSearchParams({
      symbol: symbol.toUpperCase(),
      interval,
      limit: String(limit),
    })
    const url = `${BINANCE_BASE_URL}/api/v3/klines?${query.toString()}`

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
}

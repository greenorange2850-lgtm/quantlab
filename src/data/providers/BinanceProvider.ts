import { normalizeBinanceKlines, type Candle } from '../candles.js'
import type { CandleInterval, GetCandlesParams, MarketDataProvider } from './MarketDataProvider.js'

/** Public market-data host (no API key). Prefer over the trading API host for read-only klines/exchangeInfo. */
export const BINANCE_MARKET_DATA_BASE_URL = 'https://data-api.binance.vision'

/** @deprecated Prefer BINANCE_MARKET_DATA_BASE_URL — kept as alias for existing imports. */
export const BINANCE_BASE_URL = BINANCE_MARKET_DATA_BASE_URL

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
  private readonly baseUrl: string

  constructor(baseUrl: string = BINANCE_MARKET_DATA_BASE_URL) {
    this.baseUrl = baseUrl
  }

  async getCandles(params: GetCandlesParams): Promise<Candle[]> {
    const { symbol, interval, limit, signal } = params
    validateFetchParams(symbol, interval, limit)

    const query = new URLSearchParams({
      symbol: symbol.toUpperCase(),
      interval,
      limit: String(limit),
    })
    const url = `${this.baseUrl}/api/v3/klines?${query.toString()}`

    let response: Response
    try {
      response = await fetch(url, { signal })
    } catch (error) {
      if (signal?.aborted) {
        throw error
      }
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

import { normalizeBinanceKline, type Candle } from '../candles.js'
import {
  BINANCE_KLINES_PAGE_LIMIT,
  RESEARCH_PERIOD_MAX_CANDLES,
  clipCandlesToRange,
  mergeCandlePages,
} from '../research-period.js'
import type { CandleInterval, GetCandlesParams, MarketDataProvider } from './MarketDataProvider.js'

/** Public market-data host (no API key). Prefer over the trading API host for read-only klines/exchangeInfo. */
export const BINANCE_MARKET_DATA_BASE_URL = 'https://data-api.binance.vision'

/** @deprecated Prefer BINANCE_MARKET_DATA_BASE_URL — kept as alias for existing imports. */
export const BINANCE_BASE_URL = BINANCE_MARKET_DATA_BASE_URL

/** @deprecated Use CandleInterval from MarketDataProvider */
export type KlineInterval = CandleInterval

export function parseBinanceKlinesResponse(data: unknown): Candle[] {
  if (!Array.isArray(data)) {
    throw new Error('Invalid Binance klines response: expected an array')
  }
  if (data.length === 0) {
    throw new Error('Binance API returned no candle data')
  }
  return data.map(normalizeBinanceKline)
}

/** Allow empty pages during pagination (end of history). */
function parseBinanceKlinesPage(data: unknown): Candle[] {
  if (!Array.isArray(data)) {
    throw new Error('Invalid Binance klines response: expected an array')
  }
  if (data.length === 0) return []
  return data.map(normalizeBinanceKline)
}

function validateSymbolInterval(symbol: string, interval: string): void {
  if (!symbol.trim()) {
    throw new Error('symbol must be a non-empty string')
  }
  if (!interval.trim()) {
    throw new Error('interval must be a non-empty string')
  }
}

function validatePageLimit(limit: number): void {
  if (!Number.isInteger(limit) || limit < 1 || limit > BINANCE_KLINES_PAGE_LIMIT) {
    throw new Error(`limit must be an integer between 1 and ${BINANCE_KLINES_PAGE_LIMIT}`)
  }
}

export class BinanceProvider implements MarketDataProvider {
  private readonly baseUrl: string

  constructor(baseUrl: string = BINANCE_MARKET_DATA_BASE_URL) {
    this.baseUrl = baseUrl
  }

  async getCandles(params: GetCandlesParams): Promise<Candle[]> {
    const { symbol, interval, limit, startTime, endTime, maxCandles, signal } = params
    validateSymbolInterval(symbol, interval)

    const hasRange =
      startTime !== undefined &&
      endTime !== undefined &&
      Number.isFinite(startTime) &&
      Number.isFinite(endTime)

    if (hasRange) {
      return this.fetchRange({
        symbol,
        interval,
        startTime: startTime!,
        endTime: endTime!,
        pageLimit: Math.min(Math.max(1, limit || BINANCE_KLINES_PAGE_LIMIT), BINANCE_KLINES_PAGE_LIMIT),
        maxCandles: maxCandles ?? RESEARCH_PERIOD_MAX_CANDLES,
        signal,
      })
    }

    // Legacy limit-only path: single request for the latest N candles.
    validatePageLimit(limit)
    return this.fetchPage({
      symbol,
      interval,
      limit,
      signal,
      allowEmpty: false,
    })
  }

  private async fetchRange(input: {
    symbol: string
    interval: string
    startTime: number
    endTime: number
    pageLimit: number
    maxCandles: number
    signal?: AbortSignal
  }): Promise<Candle[]> {
    if (input.endTime < input.startTime) {
      throw new Error('endTime must be on or after startTime')
    }

    const pages: Candle[][] = []
    let cursor = input.startTime

    while (cursor <= input.endTime) {
      if (input.signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }

      const page = await this.fetchPage({
        symbol: input.symbol,
        interval: input.interval,
        limit: input.pageLimit,
        startTime: cursor,
        endTime: input.endTime,
        signal: input.signal,
        allowEmpty: true,
      })

      if (page.length === 0) break

      pages.push(page)
      const mergedSoFar = mergeCandlePages(pages)
      if (mergedSoFar.length > input.maxCandles) {
        throw new Error(
          `Requested research period requires more than ${input.maxCandles} candles. Narrow the calendar range or use a higher timeframe.`,
        )
      }

      const lastTime = page[page.length - 1]!.time
      if (lastTime >= input.endTime) break
      // Advance past the last open time to avoid duplicates; preserve interval boundaries.
      const nextCursor = lastTime + 1
      if (nextCursor <= cursor) break
      cursor = nextCursor

      // Partial page ⇒ no further history in range.
      if (page.length < input.pageLimit) break
    }

    const merged = mergeCandlePages(pages)
    const clipped = clipCandlesToRange(merged, input.startTime, input.endTime)
    if (clipped.length === 0) {
      throw new Error('Binance API returned no candle data for the selected research period')
    }
    if (clipped.length > input.maxCandles) {
      throw new Error(
        `Requested research period requires more than ${input.maxCandles} candles. Narrow the calendar range or use a higher timeframe.`,
      )
    }
    return clipped
  }

  private async fetchPage(input: {
    symbol: string
    interval: string
    limit: number
    startTime?: number
    endTime?: number
    signal?: AbortSignal
    allowEmpty: boolean
  }): Promise<Candle[]> {
    const query = new URLSearchParams({
      symbol: input.symbol.toUpperCase(),
      interval: input.interval,
      limit: String(input.limit),
    })
    if (input.startTime !== undefined) {
      query.set('startTime', String(input.startTime))
    }
    if (input.endTime !== undefined) {
      query.set('endTime', String(input.endTime))
    }

    const url = `${this.baseUrl}/api/v3/klines?${query.toString()}`

    let response: Response
    try {
      response = await fetch(url, { signal: input.signal })
    } catch (error) {
      if (input.signal?.aborted) {
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

    if (input.allowEmpty) {
      return parseBinanceKlinesPage(data)
    }
    return parseBinanceKlinesResponse(data)
  }
}

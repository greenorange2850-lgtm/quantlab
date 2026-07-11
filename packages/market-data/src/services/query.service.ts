import type { IMarketDataRepository } from '../repositories/market-data.repository.interface.js'
import type { MarketCandle, CandleQueryParams, CandleRange } from '../types/index.js'
import { LRUCache } from '../cache/lru-cache.js'

export class QueryService {
  private readonly repo: IMarketDataRepository
  private readonly cache: LRUCache<MarketCandle[]>
  private readonly rangeCache: LRUCache<CandleRange>

  constructor(
    repo: IMarketDataRepository,
    cacheSize = 200,
    ttlMs = 120_000,
  ) {
    this.repo = repo
    this.cache = new LRUCache(cacheSize, ttlMs)
    this.rangeCache = new LRUCache(50, ttlMs)
  }

  getCandles(params: CandleQueryParams): MarketCandle[] {
    const key = `candles:${params.symbol}:${params.timeframe}:${params.start ?? ''}:${params.end ?? ''}:${params.limit ?? 1000}:${params.offset ?? 0}`
    const cached = this.cache.get(key)
    if (cached) return cached

    const candles = this.repo.getCandles({
      symbol: params.symbol,
      timeframe: params.timeframe,
      start: params.start,
      end: params.end,
      limit: params.limit ?? 1000,
      offset: params.offset ?? 0,
    })

    this.cache.set(key, candles)
    return candles
  }

  getLatest(symbol: string, timeframe: string): MarketCandle | null {
    const key = `latest:${symbol}:${timeframe}`
    const cached = this.cache.get(key)
    if (cached?.[0]) return cached[0]

    const candle = this.repo.getLatest(symbol, timeframe)
    if (candle) this.cache.set(key, [candle])
    return candle
  }

  getRange(symbol: string, timeframe: string): CandleRange {
    const key = `range:${symbol}:${timeframe}`
    const cached = this.rangeCache.get(key)
    if (cached) return cached

    const range = this.repo.getRange(symbol, timeframe)
    const result: CandleRange = {
      symbol, timeframe,
      start: range.start ?? '',
      end: range.end ?? '',
      count: range.count,
    }
    this.rangeCache.set(key, result)
    return result
  }

  getPrevious(symbol: string, timeframe: string, timestamp: string): MarketCandle | null {
    return this.repo.getPrevious(symbol, timeframe, timestamp)
  }

  getNext(symbol: string, timeframe: string, timestamp: string): MarketCandle | null {
    return this.repo.getNext(symbol, timeframe, timestamp)
  }

  getSessions() {
    return this.repo.getSessions()
  }

  getTimeframes() {
    return this.repo.getTimeframes()
  }

  getSymbols() {
    return this.repo.getSymbols()
  }

  getImportHistory(limit = 50) {
    return this.repo.listImportJobs(limit)
  }

  getQualityReport(symbol: string, timeframe: string) {
    return this.repo.getLatestQuality(symbol, timeframe)
  }

  invalidateCache(symbol?: string, timeframe?: string) {
    if (symbol && timeframe) {
      this.cache.invalidatePrefix(`candles:${symbol}:${timeframe}`)
      this.cache.invalidatePrefix(`latest:${symbol}:${timeframe}`)
      this.rangeCache.delete(`range:${symbol}:${timeframe}`)
    } else {
      this.cache.clear()
      this.rangeCache.clear()
    }
  }
}

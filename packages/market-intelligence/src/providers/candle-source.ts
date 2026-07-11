import type { ICandleSource, IntelligenceCandle } from '../types/index.js'
import type { SessionType } from '@trading-os/market-data'

export interface MarketDataSource {
  getCandles(params: {
    symbol: string
    timeframe: string
    start?: string
    end?: string
    limit?: number
  }): Array<{
    timestamp: string
    open: number
    high: number
    low: number
    close: number
    volume: number
    spread?: number
    session?: SessionType | null
  }>
}

export class RepositoryCandleSource implements ICandleSource {
  constructor(private readonly source: MarketDataSource) {}

  getCandles(params: {
    symbol: string
    timeframe: string
    start?: string
    end?: string
    limit?: number
  }): IntelligenceCandle[] {
    return this.source.getCandles({ ...params, limit: params.limit ?? 1_000_000 })
  }
}

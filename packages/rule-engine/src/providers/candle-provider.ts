import type { ICandleProvider, Candle } from '../types/index.js'

export interface CandleSource {
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
  }>
}

export class RepositoryCandleProvider implements ICandleProvider {
  constructor(private readonly source: CandleSource) {}

  getCandles(symbol: string, timeframe: string, start?: string, end?: string): Candle[] {
    return this.source.getCandles({ symbol, timeframe, start, end, limit: 1_000_000 })
  }
}

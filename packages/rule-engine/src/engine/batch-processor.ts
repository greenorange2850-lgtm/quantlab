import type { Candle } from '../types/index.js'

export interface BatchSlice {
  startIndex: number
  endIndex: number
  candles: Candle[]
}

export class BatchProcessor {
  constructor(private readonly batchSize: number = 5000) {}

  slice(candles: Candle[]): BatchSlice[] {
    if (candles.length === 0) return []
    const slices: BatchSlice[] = []
    for (let i = 0; i < candles.length; i += this.batchSize) {
      const end = Math.min(i + this.batchSize, candles.length)
      slices.push({ startIndex: i, endIndex: end, candles: candles.slice(i, end) })
    }
    return slices
  }

  static warmupIndex(globalIndex: number, warmup: number): number {
    return Math.max(warmup, globalIndex)
  }
}

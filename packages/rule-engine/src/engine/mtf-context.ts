import type { Candle, ICandleProvider } from '../types/index.js'
import { HTF_MAP } from '../types/index.js'

export class MtfContext {
  private cache = new Map<string, Candle[]>()

  constructor(private readonly candleProvider: ICandleProvider) {}

  getHigherTimeframe(timeframe: string): string | null {
    return HTF_MAP[timeframe] ?? null
  }

  getHtfCandles(symbol: string, timeframe: string, start?: string, end?: string): Candle[] {
    const htf = this.getHigherTimeframe(timeframe)
    if (!htf) return []

    const key = `${symbol}:${htf}:${start ?? ''}:${end ?? ''}`
    if (this.cache.has(key)) return this.cache.get(key)!

    const candles = this.candleProvider.getCandles(symbol, htf, start, end)
    this.cache.set(key, candles)
    return candles
  }

  getHtfTrend(candles: Candle[], index: number): 'bullish' | 'bearish' | 'neutral' {
    if (candles.length < 20) return 'neutral'
    const htfIndex = Math.min(index, candles.length - 1)
    const slice = candles.slice(Math.max(0, htfIndex - 19), htfIndex + 1)
    const first = slice[0]?.close ?? 0
    const last = slice[slice.length - 1]?.close ?? 0
    const change = (last - first) / first
    if (change > 0.001) return 'bullish'
    if (change < -0.001) return 'bearish'
    return 'neutral'
  }

  clearCache(): void {
    this.cache.clear()
  }
}

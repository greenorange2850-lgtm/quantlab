import type { Candle } from '../candles.js'
import type { GetCandlesParams, MarketDataProvider } from './MarketDataProvider.js'

const INTERVAL_MS: Record<string, number> = {
  '1m': 60_000,
  '3m': 180_000,
  '5m': 300_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '1h': 3_600_000,
  '2h': 7_200_000,
  '4h': 14_400_000,
  '6h': 21_600_000,
  '8h': 28_800_000,
  '12h': 43_200_000,
  '1d': 86_400_000,
  '3d': 259_200_000,
  '1w': 604_800_000,
  '1M': 2_592_000_000,
}

export interface MockMarketDataOptions {
  seed?: number
  basePrice?: number
  startTime?: number
}

function createRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

function resolveIntervalMs(interval: string): number {
  return INTERVAL_MS[interval] ?? 3_600_000
}

export class MockMarketDataProvider implements MarketDataProvider {
  private readonly seed: number
  private readonly basePrice: number
  private readonly startTime: number

  constructor(options: MockMarketDataOptions = {}) {
    this.seed = options.seed ?? 42
    this.basePrice = options.basePrice ?? 100
    this.startTime = options.startTime ?? 1_700_000_000_000
  }

  async getCandles(params: GetCandlesParams): Promise<Candle[]> {
    const { limit, interval } = params
    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error('limit must be a positive integer')
    }

    const rng = createRng(this.seed)
    const stepMs = resolveIntervalMs(interval)
    const candles: Candle[] = []
    let close = this.basePrice

    for (let i = 0; i < limit; i++) {
      const drift = (rng() - 0.48) * 2
      const open = close
      close = Math.max(1, open + drift)
      const wick = rng() * 0.5
      const high = Math.max(open, close) + wick
      const low = Math.min(open, close) - wick
      const volume = 100 + Math.floor(rng() * 900)

      candles.push({
        time: this.startTime + i * stepMs,
        open,
        high,
        low,
        close,
        volume,
      })
    }

    return candles
  }
}

import { describe, expect, it } from 'vitest'
import { MockMarketDataProvider } from '../MockMarketDataProvider.js'

describe('MockMarketDataProvider', () => {
  it('generates deterministic candles for the same seed', async () => {
    const providerA = new MockMarketDataProvider({ seed: 7, basePrice: 200 })
    const providerB = new MockMarketDataProvider({ seed: 7, basePrice: 200 })

    const candlesA = await providerA.getCandles({ symbol: 'BTCUSDT', interval: '1h', limit: 10 })
    const candlesB = await providerB.getCandles({ symbol: 'BTCUSDT', interval: '1h', limit: 10 })

    expect(candlesA).toEqual(candlesB)
  })

  it('returns the requested number of candles', async () => {
    const provider = new MockMarketDataProvider()
    const candles = await provider.getCandles({ symbol: 'ETHUSDT', interval: '1h', limit: 25 })

    expect(candles).toHaveLength(25)
  })

  it('produces valid OHLCV values', async () => {
    const provider = new MockMarketDataProvider({ seed: 1 })
    const candles = await provider.getCandles({ symbol: 'BTCUSDT', interval: '1h', limit: 5 })

    for (const candle of candles) {
      expect(candle.high).toBeGreaterThanOrEqual(Math.max(candle.open, candle.close))
      expect(candle.low).toBeLessThanOrEqual(Math.min(candle.open, candle.close))
      expect(candle.volume).toBeGreaterThan(0)
      expect(candle.time).toBeGreaterThan(0)
    }
  })

  it('throws on invalid limit', async () => {
    const provider = new MockMarketDataProvider()
    await expect(provider.getCandles({ symbol: 'BTCUSDT', interval: '1h', limit: 0 })).rejects.toThrow(
      'limit must be a positive integer',
    )
  })
})

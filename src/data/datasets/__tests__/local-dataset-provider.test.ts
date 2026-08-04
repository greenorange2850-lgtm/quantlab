import { describe, expect, it } from 'vitest'
import type { Candle } from '../../candles.js'
import { LocalDatasetProvider } from '../LocalDatasetProvider.js'
import { DatasetLibrary, MemoryDatasetStore } from '../index.js'

function makeCandles(count: number, start = 1_700_000_000_000, step = 3_600_000): Candle[] {
  return Array.from({ length: count }, (_, i) => {
    const price = 100 + i
    return {
      time: start + i * step,
      open: price,
      high: price + 1,
      low: price - 1,
      close: price,
      volume: 50 + i,
    }
  })
}

async function seedLibrary() {
  const store = new MemoryDatasetStore()
  const library = new DatasetLibrary(store)
  const candles1h = makeCandles(20)
  const candles4h = makeCandles(10, candles1h[0]!.time, 14_400_000)
  const meta = await library.importDataset({
    name: 'Gold (XAUUSD)',
    symbol: 'XAUUSD',
    marketType: 'gold',
    provider: 'local',
    files: [
      {
        fileName: 'XAU_1h_data.csv',
        fileSize: 100,
        symbol: 'XAUUSD',
        timeframe: '1h',
        rowCount: candles1h.length,
        startDate: candles1h[0]!.time,
        endDate: candles1h.at(-1)!.time,
        candles: candles1h,
        warnings: [],
      },
      {
        fileName: 'XAU_4h_data.csv',
        fileSize: 80,
        symbol: 'XAUUSD',
        timeframe: '4h',
        rowCount: candles4h.length,
        startDate: candles4h[0]!.time,
        endDate: candles4h.at(-1)!.time,
        candles: candles4h,
        warnings: [],
      },
    ],
  })
  return { store, library, meta, candles1h }
}

describe('LocalDatasetProvider', () => {
  it('loads only the selected timeframe and honors calendar range', async () => {
    const { store, meta, candles1h } = await seedLibrary()
    const provider = new LocalDatasetProvider({ datasetId: meta.id, store })

    const start = candles1h[2]!.time
    const end = candles1h[6]!.time
    const candles = await provider.getCandles({
      symbol: 'XAUUSD',
      interval: '1h',
      limit: 1000,
      startTime: start,
      endTime: end,
    })

    expect(candles).toHaveLength(5)
    expect(candles[0]!.time).toBe(start)
    expect(candles.at(-1)!.time).toBe(end)
  })

  it('supports legacy latest-N loads', async () => {
    const { store, meta } = await seedLibrary()
    const provider = new LocalDatasetProvider({ datasetId: meta.id, store })
    const candles = await provider.getCandles({
      symbol: 'XAUUSD',
      interval: '1h',
      limit: 5,
    })
    expect(candles).toHaveLength(5)
  })

  it('throws when timeframe is missing', async () => {
    const { store, meta } = await seedLibrary()
    const provider = new LocalDatasetProvider({ datasetId: meta.id, store })
    await expect(
      provider.getCandles({ symbol: 'XAUUSD', interval: '15m', limit: 10 }),
    ).rejects.toThrow(/not available/)
  })

  it('throws when dataset is missing', async () => {
    const store = new MemoryDatasetStore()
    const provider = new LocalDatasetProvider({ datasetId: 'missing', store })
    await expect(
      provider.getCandles({ symbol: 'XAUUSD', interval: '1h', limit: 10 }),
    ).rejects.toThrow(/not found/)
  })

  it('implements MarketDataProvider shape used by research', async () => {
    const { store, meta } = await seedLibrary()
    const provider: { getCandles: LocalDatasetProvider['getCandles'] } =
      new LocalDatasetProvider({ datasetId: meta.id, store })
    const candles = await provider.getCandles({
      symbol: 'XAUUSD',
      interval: '4h',
      limit: 1000,
      startTime: meta.startDate,
      endTime: meta.endDate,
    })
    expect(candles.length).toBeGreaterThan(0)
    for (const c of candles) {
      expect(c.high).toBeGreaterThanOrEqual(Math.max(c.open, c.close))
      expect(c.low).toBeLessThanOrEqual(Math.min(c.open, c.close))
    }
  })
})

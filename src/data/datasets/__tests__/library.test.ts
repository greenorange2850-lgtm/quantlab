import { describe, expect, it } from 'vitest'
import type { Candle } from '../../candles.js'
import {
  DatasetLibrary,
  generateDatasetMetadata,
  MemoryDatasetStore,
} from '../index.js'

function candle(time: number, price = 100): Candle {
  return {
    time,
    open: price,
    high: price + 1,
    low: price - 1,
    close: price,
    volume: 10,
  }
}

function sampleImport(overrides: { name?: string; symbol?: string } = {}) {
  const c15 = [candle(1_000), candle(1_000 + 15 * 60_000), candle(1_000 + 30 * 60_000)]
  const c1h = [candle(1_000), candle(1_000 + 3_600_000)]
  const mapping = {
    timestamp: 'timestamp',
    open: 'open',
    high: 'high',
    low: 'low',
    close: 'close',
    volume: 'volume',
  } as const
  return {
    name: overrides.name ?? 'Gold (XAUUSD)',
    symbol: overrides.symbol ?? 'XAUUSD',
    marketType: 'gold' as const,
    provider: 'local' as const,
    files: [
      {
        fileName: 'XAU_15m_data.csv',
        fileSize: 1200,
        symbol: 'XAUUSD',
        timeframe: '15m' as const,
        rowCount: c15.length,
        startDate: c15[0]!.time,
        endDate: c15.at(-1)!.time,
        candles: c15,
        warnings: [],
        delimiter: ',' as const,
        delimiterLabel: 'Comma',
        columnMapping: { ...mapping },
      },
      {
        fileName: 'XAU_1h_data.csv',
        fileSize: 800,
        symbol: 'XAUUSD',
        timeframe: '1h' as const,
        rowCount: c1h.length,
        startDate: c1h[0]!.time,
        endDate: c1h.at(-1)!.time,
        candles: c1h,
        warnings: [],
        delimiter: ',' as const,
        delimiterLabel: 'Comma',
        columnMapping: { ...mapping },
      },
    ],
  }
}

describe('metadata generation', () => {
  it('aggregates coverage, timeframes, candle counts, and file size', () => {
    const { metadata } = generateDatasetMetadata(sampleImport(), 'ds_test', 5_000)
    expect(metadata.id).toBe('ds_test')
    expect(metadata.name).toBe('Gold (XAUUSD)')
    expect(metadata.symbol).toBe('XAUUSD')
    expect(metadata.marketType).toBe('gold')
    expect(metadata.provider).toBe('local')
    expect(metadata.timeframes).toEqual(['15m', '1h'])
    expect(metadata.candles).toBe(5)
    expect(metadata.candleCounts).toEqual({ '15m': 3, '1h': 2 })
    expect(metadata.fileSize).toBe(2000)
    expect(metadata.startDate).toBe(1_000)
    expect(metadata.endDate).toBe(1_000 + 3_600_000)
    expect(metadata.importedAt).toBe(5_000)
    expect(metadata.status).toBe('ready')
  })
})

describe('IndexedDB-compatible DatasetStore persistence (memory implementation)', () => {
  it('imports, lists, loads one timeframe, renames, refreshes, exports metadata, and deletes', async () => {
    const store = new MemoryDatasetStore()
    const library = new DatasetLibrary(store)

    const imported = await library.importDataset(sampleImport())
    expect(imported.status).toBe('ready')

    const listed = await library.list()
    expect(listed).toHaveLength(1)
    expect(listed[0]!.id).toBe(imported.id)

    const only15m = await library.getCandles(imported.id, '15m')
    expect(only15m).toHaveLength(3)
    const only1h = await library.getCandles(imported.id, '1h')
    expect(only1h).toHaveLength(2)
    expect(await library.getCandles(imported.id, '4h')).toBeNull()

    const renamed = await library.rename(imported.id, 'Gold Spot')
    expect(renamed.name).toBe('Gold Spot')

    const refreshed = await library.refreshMetadata(imported.id)
    expect(refreshed.candles).toBe(5)
    expect(refreshed.timeframes).toEqual(['15m', '1h'])

    const exported = await library.exportMetadata(imported.id)
    expect(exported).not.toHaveProperty('status')
    expect(exported).not.toHaveProperty('errorMessage')
    expect(exported.name).toBe('Gold Spot')
    expect(exported.candles).toBe(5) // count only
    expect(exported).toHaveProperty('exportedAt')
    // Must never include candle series arrays
    expect(JSON.stringify(exported)).not.toContain('"open"')

    await library.delete(imported.id)
    expect(await library.list()).toEqual([])
    expect(await library.get(imported.id)).toBeNull()
  })

  it('never loads all datasets when fetching candles for one id/timeframe', async () => {
    const store = new MemoryDatasetStore()
    const library = new DatasetLibrary(store)
    const a = await library.importDataset(sampleImport({ name: 'A', symbol: 'AAA' }))
    const b = await library.importDataset(
      sampleImport({ name: 'B', symbol: 'BBB' }),
    )

    const calls: string[] = []
    const original = store.getCandles.bind(store)
    store.getCandles = async (id, timeframe) => {
      calls.push(`${id}:${timeframe}`)
      return original(id, timeframe)
    }

    await library.getCandles(a.id, '15m')
    expect(calls).toEqual([`${a.id}:15m`])
    expect(calls.some((c) => c.startsWith(b.id))).toBe(false)
  })
})

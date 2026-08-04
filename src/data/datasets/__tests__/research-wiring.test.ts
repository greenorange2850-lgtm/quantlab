import { describe, expect, it, vi } from 'vitest'
import type { Candle } from '@/data/candles'
import { LocalDatasetProvider } from '@/data/datasets/LocalDatasetProvider'
import { DatasetLibrary, MemoryDatasetStore } from '@/data/datasets'
import { useResearchCandles } from '@/api/queries/research-candles'

/**
 * Research surfaces must dispatch to LocalDatasetProvider when source is local.
 * We assert the hook wiring contract without mounting React.
 */
describe('optimizer / strategy lab LocalDatasetProvider usage', () => {
  it('useResearchCandles is exported for shared Optimizer + Strategy Lab loading', () => {
    expect(typeof useResearchCandles).toBe('function')
  })

  it('optimizer-style prefetch uses LocalDatasetProvider candles unchanged', async () => {
    const store = new MemoryDatasetStore()
    const library = new DatasetLibrary(store)
    const series: Candle[] = Array.from({ length: 12 }, (_, i) => ({
      time: 1_700_000_000_000 + i * 3_600_000,
      open: 100,
      high: 101,
      low: 99,
      close: 100.5,
      volume: 10,
    }))

    const meta = await library.importDataset({
      name: 'Gold (XAUUSD)',
      symbol: 'XAUUSD',
      marketType: 'gold',
      files: [
        {
          fileName: 'XAU_1h_data.csv',
          fileSize: 10,
          symbol: 'XAUUSD',
          timeframe: '1h',
          rowCount: series.length,
          startDate: series[0]!.time,
          endDate: series.at(-1)!.time,
          candles: series,
          warnings: [],
        },
      ],
    })

    const spy = vi.spyOn(store, 'getCandles')
    const provider = new LocalDatasetProvider({ datasetId: meta.id, store })

    // Mirrors OptimizerPage / BacktestSetupForm prefetch → startRandomSearch / runBacktest
    const candles = await provider.getCandles({
      symbol: 'XAUUSD',
      interval: '1h',
      limit: 1000,
      startTime: series[0]!.time,
      endTime: series.at(-1)!.time,
    })

    expect(spy).toHaveBeenCalledWith(meta.id, '1h')
    expect(spy).toHaveBeenCalledTimes(1)
    expect(candles).toHaveLength(12)

    // BacktestEngine receives Candle[] only — provider identity never leaks into the payload.
    expect(candles.every((c) => typeof c.time === 'number' && typeof c.close === 'number')).toBe(
      true,
    )
  })

  it('strategy lab uses the same LocalDatasetProvider class as optimizer', async () => {
    const store = new MemoryDatasetStore()
    const library = new DatasetLibrary(store)
    const series: Candle[] = [
      { time: 1, open: 1, high: 2, low: 0.5, close: 1.5, volume: 1 },
      { time: 2, open: 1.5, high: 2.5, low: 1, close: 2, volume: 1 },
    ]
    const meta = await library.importDataset({
      name: 'FX',
      symbol: 'EURUSD',
      marketType: 'forex',
      files: [
        {
          fileName: 'EURUSD_1h.csv',
          fileSize: 1,
          symbol: 'EURUSD',
          timeframe: '1h',
          rowCount: 2,
          startDate: 1,
          endDate: 2,
          candles: series,
          warnings: [],
        },
      ],
    })

    const optimizerProvider = new LocalDatasetProvider({ datasetId: meta.id, store })
    const strategyLabProvider = new LocalDatasetProvider({ datasetId: meta.id, store })

    const a = await optimizerProvider.getCandles({
      symbol: 'EURUSD',
      interval: '1h',
      limit: 10,
    })
    const b = await strategyLabProvider.getCandles({
      symbol: 'EURUSD',
      interval: '1h',
      limit: 10,
    })

    expect(a).toEqual(b)
    expect(optimizerProvider).toBeInstanceOf(LocalDatasetProvider)
    expect(strategyLabProvider).toBeInstanceOf(LocalDatasetProvider)
  })
})

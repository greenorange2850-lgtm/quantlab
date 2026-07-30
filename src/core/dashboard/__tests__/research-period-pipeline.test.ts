import { describe, expect, it, vi } from 'vitest'
import { runBacktestPipeline } from '../run-backtest-pipeline.js'
import * as pipelineModule from '../run-backtest-pipeline.js'
import { runRandomSearch } from '../../research/random-search.js'
import { DEFAULT_MA_CROSS_RANGES } from '../../research/index.js'
import type { Candle } from '../../../data/candles.js'

function buildCandles(count: number, start = 1_700_000_000_000, step = 900_000): Candle[] {
  return Array.from({ length: count }, (_, index) => ({
    time: start + index * step,
    open: 100 + index * 0.01,
    high: 101 + index * 0.01,
    low: 99 + index * 0.01,
    close: 100.5 + index * 0.01,
    volume: 10 + index,
  }))
}

describe('calendar research period propagation', () => {
  it('runs Strategy Lab style backtests on the selected period candles (not latest 500)', async () => {
    const startDate = 1_700_000_000_000
    const candles = buildCandles(2_880, startDate) // ~30 days of 15m
    const endDate = candles[candles.length - 1]!.time

    const result = await runBacktestPipeline({
      symbol: 'BTCUSDT',
      interval: '15m',
      limit: 1000,
      startDate,
      endDate,
      initialCapital: 10_000,
      commissionPercent: 0.1,
      positionSizePercent: 100,
      candles,
    })

    expect(result.candles).toHaveLength(2_880)
    expect(result.candles[0]?.time).toBe(startDate)
    expect(result.candles.at(-1)?.time).toBe(endDate)
    // Must not silently shrink to the old 500/1000 latest-candle window.
    expect(result.candles.length).toBeGreaterThan(1000)
  })

  it('passes the identical candles array into each optimizer candidate pipeline call', async () => {
    const candles = buildCandles(120)
    const seen: unknown[] = []
    const original = pipelineModule.runBacktestPipeline

    const spy = vi.spyOn(pipelineModule, 'runBacktestPipeline').mockImplementation((params) => {
      seen.push(params!.candles)
      return original(params!)
    })

    try {
      await runRandomSearch({
        candles,
        config: {
          iterations: 4,
          parameterRanges: DEFAULT_MA_CROSS_RANGES,
          objective: 'netProfit',
          symbol: 'BTCUSDT',
          interval: '15m',
          limit: 1000,
          startDate: candles[0]!.time,
          endDate: candles[candles.length - 1]!.time,
          initialCapital: 10_000,
          seed: 7,
        },
      })

      expect(spy).toHaveBeenCalledTimes(4)
      expect(seen).toHaveLength(4)
      for (const batch of seen) {
        expect(batch).toBe(candles)
      }
    } finally {
      spy.mockRestore()
    }
  })
})

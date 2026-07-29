import { describe, expect, it } from 'vitest'
import { runBacktestPipeline } from '../run-backtest-pipeline.js'
import type { Candle } from '../../../data/candles.js'

function buildCandles(count: number): Candle[] {
  const candles: Candle[] = []
  let price = 100

  for (let i = 0; i < count; i++) {
    // Alternate mild up/down moves so MA cross can produce activity without relying on mock RNG.
    price = i % 20 < 10 ? price * 1.01 : price * 0.99
    const open = price
    const close = price * (i % 2 === 0 ? 1.002 : 0.998)
    candles.push({
      time: Date.parse('2024-01-01T00:00:00.000Z') + i * 3_600_000,
      open,
      high: Math.max(open, close) * 1.001,
      low: Math.min(open, close) * 0.999,
      close,
      volume: 10 + i,
    })
  }

  return candles
}

describe('runBacktestPipeline with prefetched candles', () => {
  it('uses provided canonical candles and never invents a mock series', async () => {
    const candles = buildCandles(80)
    const result = await runBacktestPipeline({
      symbol: 'ETHUSDT',
      interval: '1h',
      limit: candles.length,
      initialCapital: 10_000,
      commissionPercent: 0.1,
      positionSizePercent: 100,
      candles,
    })

    expect(result.candles).toBe(candles)
    expect(result.report.config.symbol).toBe('ETHUSDT')
    expect(result.context.timeframe).toBe('1H')
    expect(result.report.equityCurve.length).toBeGreaterThan(0)
  })

  it('does not duplicate recent-backtest ids when mapping', async () => {
    const candles = buildCandles(60)
    const pipelineResult = await runBacktestPipeline({
      symbol: 'BTCUSDT',
      interval: '15m',
      limit: candles.length,
      initialCapital: 10_000,
      commissionPercent: 0.1,
      positionSizePercent: 100,
      candles,
    })

    const { mapPipelineResultToDashboard } = await import('../run-backtest-pipeline.js')
    const first = mapPipelineResultToDashboard(pipelineResult, [])
    const second = mapPipelineResultToDashboard(pipelineResult, first.recentBacktests)

    const ids = second.recentBacktests.map((item) => item.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(second.recentBacktests[0]?.market).toBe('BTCUSDT')
    expect(second.recentBacktests[0]?.timeframe).toBe('15M')
  })
})

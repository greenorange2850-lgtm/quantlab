import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Candle } from '../../../data/candles.js'
import { DEFAULT_MA_CROSS_RANGES } from '../index.js'
import { runRandomSearch } from '../random-search.js'
import type { BacktestReport } from '../../analytics/types.js'
import { defaultRiskConfig } from '../../risk/config.js'

function buildCandles(count: number): Candle[] {
  const candles: Candle[] = []
  let price = 100
  for (let i = 0; i < count; i++) {
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

function stubReport(index: number): BacktestReport {
  return {
    summary: {
      totalTrades: 8 + index,
      winRate: 0.5,
      netProfit: 50 + index,
      profitFactor: 1.2 + index * 0.1,
      expectancy: 5,
      averageWin: 10,
      averageLoss: -5,
      maxDrawdown: 0.05,
      largestWinner: 20,
      largestLoser: -8,
      finalBalance: 10_050 + index,
    },
    equityCurve: [],
    drawdown: {
      currentDrawdown: 0,
      maxDrawdown: 0.05,
      maxDrawdownDurationMs: 0,
      maxDrawdownRecoveryMs: null,
    },
    monthlyReturns: { months: [], bestMonth: null, worstMonth: null },
    tradeAnalysis: {
      averageWin: 10,
      averageLoss: -5,
      largestWinner: 20,
      largestLoser: -8,
      profitFactor: 1.2 + index * 0.1,
      expectancy: 5,
      averageHoldingTimeMs: 1,
      longPerformance: { trades: 8, netProfit: 50, winRate: 0.5 },
      shortPerformance: { trades: 0, netProfit: 0, winRate: 0 },
    },
    topTrades: [],
    statistics: {
      totalTrades: 8,
      winningTrades: 4,
      losingTrades: 4,
      winRate: 0.5,
      netProfit: 50 + index,
      grossProfit: 80,
      grossLoss: -30,
      maxDrawdown: 0.05,
      averageTrade: 5,
      finalBalance: 10_050 + index,
    },
    trades: [],
    config: {
      initialCapital: 10_000,
      commissionPercent: 0.1,
      positionSizePercent: 100,
      symbol: 'BTCUSDT',
      riskConfig: defaultRiskConfig,
    },
  }
}

vi.mock('../../dashboard/run-backtest-pipeline.js', () => ({
  runBacktestPipeline: vi.fn(async (params: { strategyParams?: { fastPeriod: number } }) => {
    const fast = params?.strategyParams?.fastPeriod ?? 20
    return {
      report: stubReport(fast),
      candles: [],
      context: {
        strategyName: 'Moving Average Cross',
        strategyVersion: 'rs',
        timeframe: '1H',
        candles: [],
      },
      backtestId: `bt-${fast}`,
      strategyParams: {
        fastPeriod: fast,
        slowPeriod: 50,
        rsiPeriod: 14,
      },
    }
  }),
}))

import { runBacktestPipeline } from '../../dashboard/run-backtest-pipeline.js'

describe('runRandomSearch', () => {
  beforeEach(() => {
    vi.mocked(runBacktestPipeline).mockClear()
  })

  it('starts with the provided configuration and reports progress', async () => {
    const candles = buildCandles(60)
    const progressEvents: number[] = []

    const session = await runRandomSearch({
      candles,
      config: {
        iterations: 3,
        parameterRanges: DEFAULT_MA_CROSS_RANGES,
        objective: 'profitFactor',
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 60,
        initialCapital: 10_000,
        seed: 7,
      },
      onProgress: (progress) => {
        progressEvents.push(progress.completed)
      },
    })

    expect(session.status).toBe('completed')
    expect(session.candidates).toHaveLength(3)
    expect(progressEvents).toEqual([1, 2, 3, 3]) // final event repeats completed status
    expect(runBacktestPipeline).toHaveBeenCalledTimes(3)
    expect(session.bestCandidateId).not.toBeNull()
  })

  it('fails validation for empty/invalid ranges before running', async () => {
    const session = await runRandomSearch({
      candles: buildCandles(40),
      config: {
        iterations: 5,
        parameterRanges: [{ name: 'fastPeriod', min: 40, max: 10, step: 1 }],
        objective: 'netProfit',
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 40,
        initialCapital: 10_000,
      },
    })

    expect(session.status).toBe('failed')
    expect(session.error).toMatch(/max must be/i)
    expect(runBacktestPipeline).not.toHaveBeenCalled()
  })

  it('cancels mid-run when the abort signal fires', async () => {
    const controller = new AbortController()
    let calls = 0
    vi.mocked(runBacktestPipeline).mockImplementation(async (params) => {
      calls += 1
      if (calls === 1) controller.abort()
      const fast = params?.strategyParams?.fastPeriod ?? 20
      return {
        report: stubReport(fast),
        candles: [],
        context: {
          strategyName: 'Moving Average Cross',
          strategyVersion: 'rs',
          timeframe: '1H',
          candles: [],
        },
        backtestId: `bt-${fast}`,
        strategyParams: {
          fastPeriod: fast,
          slowPeriod: 50,
          rsiPeriod: 14,
        },
      }
    })

    const session = await runRandomSearch({
      candles: buildCandles(40),
      signal: controller.signal,
      config: {
        iterations: 5,
        parameterRanges: DEFAULT_MA_CROSS_RANGES,
        objective: 'profitFactor',
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 40,
        initialCapital: 10_000,
        seed: 1,
      },
    })

    expect(session.status).toBe('cancelled')
    expect(session.progress.completed).toBeLessThan(5)
  })
})

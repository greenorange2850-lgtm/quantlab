import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Candle } from '../../../data/candles.js'
import { DEFAULT_MA_CROSS_RANGES } from '../index.js'
import { runRandomSearch } from '../random-search.js'
import type { BacktestReport } from '../../analytics/types.js'
import type { RandomSearchProgress } from '../types.js'
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

function stubReport(index: number, trades?: number): BacktestReport {
  return {
    summary: {
      totalTrades: trades ?? 8 + index,
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
      totalTrades: trades ?? 8,
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
      report: stubReport(fast, 10 + fast),
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

describe('runRandomSearch live progress', () => {
  beforeEach(() => {
    vi.mocked(runBacktestPipeline).mockClear()
  })

  it('emits an initial INITIALIZING event before the first candidate', async () => {
    const events: RandomSearchProgress[] = []

    await runRandomSearch({
      candles: buildCandles(60),
      config: {
        iterations: 2,
        parameterRanges: DEFAULT_MA_CROSS_RANGES,
        objective: 'profitFactor',
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 60,
        initialCapital: 10_000,
        seed: 7,
      },
      onProgress: (progress) => {
        events.push({ ...progress })
      },
    })

    expect(events[0]?.status).toBe('INITIALIZING')
    expect(events[0]?.candidatesTested).toBe(0)
    expect(events[0]?.totalCandidates).toBe(2)
    expect(runBacktestPipeline).toHaveBeenCalledTimes(2)
  })

  it('emits ordinary progress updates as candidates complete', async () => {
    const events: RandomSearchProgress[] = []

    const session = await runRandomSearch({
      candles: buildCandles(60),
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
        events.push({ ...progress })
      },
    })

    const tested = events.filter((event) => event.candidatesTested > 0 && event.status !== 'FINALIZING')
    expect(tested.map((event) => event.candidatesTested)).toEqual([1, 2, 3])
    expect(events.at(-1)?.status).toBe('FINALIZING')
    expect(session.status).toBe('completed')
    expect(session.progress.status).toBe('FINALIZING')
  })

  it('emits immediately when a new best candidate is found with correct trade count', async () => {
    let call = 0
    vi.mocked(runBacktestPipeline).mockImplementation(async () => {
      call += 1
      const trades = call === 1 ? 11 : call === 2 ? 27 : 9
      return {
        report: stubReport(call, trades),
        candles: [],
        context: {
          strategyName: 'Moving Average Cross',
          strategyVersion: 'rs',
          timeframe: '1H',
          candles: [],
        },
        backtestId: `bt-${call}`,
        strategyParams: {
          fastPeriod: 10 + call,
          slowPeriod: 50,
          rsiPeriod: 14,
        },
      }
    })

    // Force all candidates to pass and control scores via profitFactor.
    const events: RandomSearchProgress[] = []
    await runRandomSearch({
      candles: buildCandles(40),
      config: {
        iterations: 3,
        parameterRanges: DEFAULT_MA_CROSS_RANGES,
        objective: 'profitFactor',
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 40,
        initialCapital: 10_000,
        seed: 1,
      },
      onProgress: (progress) => events.push({ ...progress }),
    })

    const improvements = events.filter((event) => event.status === 'IMPROVING')
    expect(improvements.length).toBeGreaterThanOrEqual(2)

    const secondBest = events.find(
      (event) => event.improvementsCount === 2 && event.bestTradeCount === 27,
    )
    expect(secondBest).toBeDefined()
    expect(secondBest?.bestTradeCount).toBe(27)
    // Trade count is of the best candidate, not a sum across candidates.
    expect(secondBest?.bestTradeCount).not.toBe(11 + 27)
  })

  it('emits FINALIZING before return (COMPLETED is store-owned after persist)', async () => {
    const statuses: RandomSearchProgress['status'][] = []
    const session = await runRandomSearch({
      candles: buildCandles(40),
      config: {
        iterations: 2,
        parameterRanges: DEFAULT_MA_CROSS_RANGES,
        objective: 'profitFactor',
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 40,
        initialCapital: 10_000,
        seed: 3,
      },
      onProgress: (progress) => statuses.push(progress.status),
    })

    expect(statuses[0]).toBe('INITIALIZING')
    expect(statuses.at(-1)).toBe('FINALIZING')
    expect(statuses).not.toContain('COMPLETED')
    expect(session.status).toBe('completed')
  })

  it('emits FAILED with a useful message and does not leave status running', async () => {
    const events: RandomSearchProgress[] = []
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
      onProgress: (progress) => events.push({ ...progress }),
    })

    expect(session.status).toBe('failed')
    expect(session.error).toMatch(/max must be/i)
    expect(events.at(-1)?.status).toBe('FAILED')
    expect(runBacktestPipeline).not.toHaveBeenCalled()
  })

  it('cancels mid-run, emits CANCELLED, and stops further evaluation', async () => {
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

    const events: RandomSearchProgress[] = []
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
      onProgress: (progress) => events.push({ ...progress }),
    })

    expect(session.status).toBe('cancelled')
    expect(session.progress.candidatesTested).toBeLessThan(5)
    expect(events.at(-1)?.status).toBe('CANCELLED')
    expect(calls).toBeLessThan(5)
  })

  it('keeps candidate generation deterministic for an unchanged seed', async () => {
    const config = {
      iterations: 3,
      parameterRanges: DEFAULT_MA_CROSS_RANGES,
      objective: 'profitFactor' as const,
      symbol: 'BTCUSDT',
      interval: '1h',
      limit: 60,
      initialCapital: 10_000,
      seed: 42,
    }
    const candles = buildCandles(60)

    const first = await runRandomSearch({ candles, config })
    const second = await runRandomSearch({ candles, config })

    expect(first.candidates.map((c) => c.parameters)).toEqual(
      second.candidates.map((c) => c.parameters),
    )
    expect(first.candidates.map((c) => c.score)).toEqual(second.candidates.map((c) => c.score))
  })
})

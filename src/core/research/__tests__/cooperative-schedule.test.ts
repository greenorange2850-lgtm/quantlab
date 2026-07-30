import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Candle } from '../../../data/candles.js'
import { DEFAULT_MA_CROSS_RANGES } from '../index.js'
import { runRandomSearch } from '../random-search.js'
import type { BacktestReport } from '../../analytics/types.js'
import type { RandomSearchProgress } from '../types.js'
import type { RandomSearchPerfDiagnostics } from '../cooperative-schedule.js'
import { defaultRiskConfig } from '../../risk/config.js'
import {
  createAdaptiveBatchController,
  yieldToBrowser,
} from '../cooperative-schedule.js'

function buildCandles(count: number): Candle[] {
  return Array.from({ length: count }, (_, i) => {
    const open = 100 + i
    const close = open + (i % 2 === 0 ? 0.5 : -0.5)
    return {
      time: Date.parse('2024-01-01T00:00:00.000Z') + i * 3_600_000,
      open,
      high: Math.max(open, close) + 0.25,
      low: Math.min(open, close) - 0.25,
      close,
      volume: 10 + i,
    }
  })
}

function stubReport(index: number): BacktestReport {
  return {
    summary: {
      totalTrades: 8 + (index % 5),
      winRate: 0.5,
      netProfit: 50 + index,
      profitFactor: 1.2 + (index % 7) * 0.05,
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
      profitFactor: 1.2,
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
    // Simulate synchronous CPU work before the async function settles.
    const start = performance.now()
    while (performance.now() - start < 2) {
      // busy-wait ~2ms of main-thread work per candidate
    }
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

describe('cooperative scheduling helpers', () => {
  it('yieldToBrowser uses setTimeout when scheduler.yield is unavailable', async () => {
    vi.useFakeTimers()
    const pending = yieldToBrowser()
    let resolved = false
    void pending.then(() => {
      resolved = true
    })
    expect(resolved).toBe(false)
    await vi.advanceTimersByTimeAsync(0)
    await pending
    expect(resolved).toBe(true)
    vi.useRealTimers()
  })

  it('adapts batch size from measured batch durations', () => {
    const batcher = createAdaptiveBatchController({
      initialBatchSize: 2,
      targetBudgetMs: 32,
      minBatchSize: 1,
      maxBatchSize: 8,
    })
    expect(batcher.batchSize).toBe(2)
    batcher.noteCandidate()
    batcher.noteCandidate()
    expect(batcher.shouldYieldBefore(2, performance.now())).toBe(true)
    batcher.recordBatch(2, 80)
    expect(batcher.batchSize).toBe(1)
    batcher.noteCandidate()
    batcher.recordBatch(1, 5)
    expect(batcher.batchSize).toBe(2)
  })
})

describe('runRandomSearch cooperative yielding', () => {
  beforeEach(() => {
    vi.mocked(runBacktestPipeline).mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('yields to the browser during searches above the batch threshold', async () => {
    const yieldFn = vi.fn(async () => undefined)
    const diagnostics: RandomSearchPerfDiagnostics[] = []

    await runRandomSearch({
      candles: buildCandles(40),
      yieldFn,
      cooperativeBatchSize: 1,
      enablePerfDiagnostics: true,
      onPerfDiagnostics: (d) => {
        diagnostics.push(d)
      },
      config: {
        iterations: 5,
        parameterRanges: DEFAULT_MA_CROSS_RANGES,
        objective: 'profitFactor',
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 40,
        initialCapital: 10_000,
        seed: 9,
      },
    })

    // Initializing yield + one yield before each candidate after the first.
    expect(yieldFn.mock.calls.length).toBeGreaterThanOrEqual(5)
    expect(diagnostics[0]?.yieldCount).toBeGreaterThanOrEqual(5)
    expect(diagnostics[0]?.candidatesProcessed).toBe(5)
    expect(diagnostics[0]?.maxBatchDurationMs).toBeGreaterThan(0)
  })

  it('keeps candidate order and final scores identical for the same seed', async () => {
    const yieldFn = vi.fn(async () => undefined)
    const config = {
      iterations: 6,
      parameterRanges: DEFAULT_MA_CROSS_RANGES,
      objective: 'profitFactor' as const,
      symbol: 'BTCUSDT',
      interval: '1h',
      limit: 40,
      initialCapital: 10_000,
      seed: 42,
    }
    const candles = buildCandles(40)

    const first = await runRandomSearch({ candles, config, yieldFn, cooperativeBatchSize: 1 })
    const second = await runRandomSearch({ candles, config, yieldFn, cooperativeBatchSize: 2 })

    expect(first.candidates.map((c) => c.parameters)).toEqual(
      second.candidates.map((c) => c.parameters),
    )
    expect(first.candidates.map((c) => c.score)).toEqual(second.candidates.map((c) => c.score))
    expect(first.candidates.map((c) => c.passedConstraints)).toEqual(
      second.candidates.map((c) => c.passedConstraints),
    )
    expect(first.bestCandidateId && first.candidates.find((c) => c.id === first.bestCandidateId)?.parameters)
      .toEqual(
        second.bestCandidateId &&
          second.candidates.find((c) => c.id === second.bestCandidateId)?.parameters,
      )
  })

  it('observes cancellation between batches after a yield', async () => {
    const controller = new AbortController()
    let yields = 0
    const yieldFn = vi.fn(async () => {
      yields += 1
      // Abort after the initializing yield + first mid-loop yield opportunity.
      if (yields === 2) controller.abort()
    })

    const session = await runRandomSearch({
      candles: buildCandles(30),
      signal: controller.signal,
      yieldFn,
      cooperativeBatchSize: 1,
      config: {
        iterations: 20,
        parameterRanges: DEFAULT_MA_CROSS_RANGES,
        objective: 'profitFactor',
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 30,
        initialCapital: 10_000,
        seed: 3,
      },
    })

    expect(session.status).toBe('cancelled')
    expect(session.progress.status).toBe('CANCELLED')
    expect(session.candidates.length).toBeLessThan(20)
    expect(runBacktestPipeline).toHaveBeenCalled()
    expect(vi.mocked(runBacktestPipeline).mock.calls.length).toBeLessThan(20)
  })

  it('emits progress before completion (progress advances during the run)', async () => {
    const progressEvents: RandomSearchProgress[] = []
    let sawProgressBeforeFinalizing = false

    await runRandomSearch({
      candles: buildCandles(30),
      yieldFn: async () => undefined,
      cooperativeBatchSize: 1,
      onProgress: (progress) => {
        progressEvents.push({ ...progress })
        if (
          progress.candidatesTested > 0 &&
          progress.status !== 'FINALIZING' &&
          progress.status !== 'COMPLETED'
        ) {
          sawProgressBeforeFinalizing = true
        }
      },
      config: {
        iterations: 4,
        parameterRanges: DEFAULT_MA_CROSS_RANGES,
        objective: 'profitFactor',
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 30,
        initialCapital: 10_000,
        seed: 5,
      },
    })

    expect(progressEvents[0]?.status).toBe('INITIALIZING')
    expect(sawProgressBeforeFinalizing).toBe(true)
    expect(progressEvents.some((event) => event.candidatesTested === 1)).toBe(true)
    expect(progressEvents.some((event) => event.candidatesTested === 2)).toBe(true)
    expect(progressEvents.at(-1)?.status).toBe('FINALIZING')
  })

  it('preserves the terminal lifecycle with cooperative yields', async () => {
    const statuses: RandomSearchProgress['status'][] = []
    const session = await runRandomSearch({
      candles: buildCandles(30),
      yieldFn: async () => undefined,
      cooperativeBatchSize: 2,
      onProgress: (progress) => statuses.push(progress.status),
      config: {
        iterations: 3,
        parameterRanges: DEFAULT_MA_CROSS_RANGES,
        objective: 'profitFactor',
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 30,
        initialCapital: 10_000,
        seed: 8,
      },
    })

    expect(statuses[0]).toBe('INITIALIZING')
    expect(statuses.at(-1)).toBe('FINALIZING')
    expect(statuses).not.toContain('COMPLETED')
    expect(session.status).toBe('completed')
    expect(session.candidates).toHaveLength(3)
  })
})

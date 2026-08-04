import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { Candle } from '../../../data/candles.js'
import { DEFAULT_MA_CROSS_RANGES } from '../index.js'
import { runRandomSearch } from '../random-search.js'
import { createRandomSearchRunControls } from '../run-controls.js'
import type { BacktestReport } from '../../analytics/types.js'
import type { RandomSearchProgress } from '../types.js'
import { defaultRiskConfig } from '../../risk/config.js'
import { createTimingState, markPauseEnd, markPauseStart, readTiming } from '../progress.js'

function buildCandles(count: number): Candle[] {
  return Array.from({ length: count }, (_, i) => ({
    time: Date.parse('2024-01-01T00:00:00.000Z') + i * 3_600_000,
    open: 100 + i,
    high: 101 + i,
    low: 99 + i,
    close: 100.5 + i,
    volume: 10,
  }))
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
  runBacktestPipeline: vi.fn(),
}))

import { runBacktestPipeline } from '../../dashboard/run-backtest-pipeline.js'

function installGatedPipeline() {
  const releases: Array<() => void> = []
  let started = 0

  vi.mocked(runBacktestPipeline).mockImplementation(async (params) => {
    started += 1
    await new Promise<void>((resolve) => {
      releases.push(resolve)
    })
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
      backtestId: `bt-${fast}-${started}`,
      strategyParams: {
        fastPeriod: fast,
        slowPeriod: 50,
        rsiPeriod: 14,
      },
    }
  })

  return {
    get started() {
      return started
    },
    releaseOne() {
      const resolve = releases.shift()
      resolve?.()
    },
    async releaseAll() {
      while (releases.length > 0) {
        releases.shift()?.()
        await Promise.resolve()
      }
    },
  }
}

describe('createTimingState pause exclusion', () => {
  it('excludes paused duration from active elapsed time', () => {
    const timing = createTimingState(1_000)
    markPauseStart(timing, 1_500)
    markPauseEnd(timing, 2_000)
    const snap = readTiming(timing, 2_500)
    expect(snap.pausedMs).toBe(500)
    expect(snap.wallElapsedMs).toBe(1_500)
    expect(snap.activeElapsedMs).toBe(1_000)
  })
})

describe('run controls pause / resume / cancel', () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.mocked(runBacktestPipeline).mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('pauses after the current candidate and does not evaluate while paused', async () => {
    const gate = installGatedPipeline()
    const controls = createRandomSearchRunControls()
    const statuses: RandomSearchProgress['status'][] = []

    const run = runRandomSearch({
      candles: buildCandles(40),
      controls,
      yieldFn: async () => undefined,
      cooperativeBatchSize: 1,
      onProgress: (progress) => {
        statuses.push(progress.status)
      },
      config: {
        iterations: 6,
        parameterRanges: DEFAULT_MA_CROSS_RANGES,
        objective: 'profitFactor',
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 40,
        initialCapital: 10_000,
        seed: 11,
      },
    })

    const waitUntil = async (label: string, predicate: () => boolean, ms = 2000) => {
      const start = Date.now()
      while (Date.now() - start < ms) {
        if (predicate()) return
        await new Promise((r) => setTimeout(r, 10))
      }
      throw new Error(
        `${label} timed out; started=${gate.started} statuses=${JSON.stringify(statuses)} paused=${controls.isPaused()}`,
      )
    }

    await waitUntil('start candidate', () => gate.started >= 1)
    controls.requestPause()
    gate.releaseOne()
    await waitUntil('enter PAUSED', () => statuses.includes('PAUSED') || controls.isPaused())

    expect(controls.isPaused()).toBe(true)
    expect(gate.started).toBe(1)

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(gate.started).toBe(1)

    controls.resume()
    for (let n = 2; n <= 6; n++) {
      await waitUntil(`start #${n}`, () => gate.started >= n)
      gate.releaseOne()
    }
    const session = await run
    expect(session.status).toBe('completed')
    expect(session.candidates).toHaveLength(6)
    expect(statuses).toContain('PAUSING')
    expect(statuses).toContain('PAUSED')
  })

  it('continues from the exact next candidate and stays deterministic', async () => {
    const gate = installGatedPipeline()
    const controls = createRandomSearchRunControls()
    const config = {
      iterations: 5,
      parameterRanges: DEFAULT_MA_CROSS_RANGES,
      objective: 'profitFactor' as const,
      symbol: 'BTCUSDT',
      interval: '1h',
      limit: 40,
      initialCapital: 10_000,
      seed: 77,
    }
    const candles = buildCandles(40)

    const pausedRun = runRandomSearch({
      candles,
      config,
      controls,
      yieldFn: async () => undefined,
      cooperativeBatchSize: 1,
    })

    await vi.waitFor(() => expect(gate.started).toBe(1))
    gate.releaseOne()
    await vi.waitFor(() => expect(gate.started).toBe(2))
    controls.requestPause()
    gate.releaseOne()
    await vi.waitFor(() => expect(controls.isPaused()).toBe(true))
    expect(gate.started).toBe(2)

    controls.resume()
    for (let n = gate.started + 1; n <= 5; n++) {
      await vi.waitFor(() => expect(gate.started).toBeGreaterThanOrEqual(n))
      gate.releaseOne()
    }
    const withPause = await pausedRun
    expect(withPause.candidates).toHaveLength(5)

    vi.mocked(runBacktestPipeline).mockReset()
    vi.mocked(runBacktestPipeline).mockImplementation(async (params) => {
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

    const uninterrupted = await runRandomSearch({
      candles,
      config,
      yieldFn: async () => undefined,
      cooperativeBatchSize: 1,
    })

    expect(withPause.candidates.map((c) => c.parameters)).toEqual(
      uninterrupted.candidates.map((c) => c.parameters),
    )
    expect(withPause.candidates.map((c) => c.score)).toEqual(
      uninterrupted.candidates.map((c) => c.score),
    )
  })

  it('emits CANCELLING then CANCELLED for discard without partial flag', async () => {
    const gate = installGatedPipeline()
    const controls = createRandomSearchRunControls()
    const statuses: RandomSearchProgress['status'][] = []

    const run = runRandomSearch({
      candles: buildCandles(30),
      controls,
      yieldFn: async () => undefined,
      cooperativeBatchSize: 1,
      onProgress: (p) => statuses.push(p.status),
      config: {
        iterations: 8,
        parameterRanges: DEFAULT_MA_CROSS_RANGES,
        objective: 'profitFactor',
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 30,
        initialCapital: 10_000,
        seed: 3,
      },
    })

    await vi.waitFor(() => expect(gate.started).toBe(1))
    controls.requestCancel('discard')
    gate.releaseOne()
    const session = await run

    expect(session.status).toBe('cancelled')
    expect(session.partial).toBe(false)
    expect(statuses).toContain('CANCELLING')
    expect(statuses.at(-1)).toBe('CANCELLED')
    expect(session.candidates.length).toBeLessThan(8)
  })

  it('save-partial cancel keeps counters and best candidate, marks partial', async () => {
    const gate = installGatedPipeline()
    const controls = createRandomSearchRunControls()

    const run = runRandomSearch({
      candles: buildCandles(30),
      controls,
      yieldFn: async () => undefined,
      cooperativeBatchSize: 1,
      config: {
        iterations: 10,
        parameterRanges: DEFAULT_MA_CROSS_RANGES,
        objective: 'profitFactor',
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 30,
        initialCapital: 10_000,
        seed: 4,
      },
    })

    await vi.waitFor(() => expect(gate.started).toBe(1))
    gate.releaseOne()
    await vi.waitFor(() => expect(gate.started).toBe(2))
    gate.releaseOne()
    await vi.waitFor(() => expect(gate.started).toBe(3))
    controls.requestCancel('save-partial')
    gate.releaseOne()
    const session = await run

    expect(session.status).toBe('cancelled')
    expect(session.partial).toBe(true)
    expect(session.progress.candidatesTested).toBe(session.candidates.length)
    expect(session.progress.totalCandidates).toBe(10)
    expect(
      session.progress.candidatesAccepted + session.progress.candidatesRejected,
    ).toBe(session.progress.candidatesTested)
    if (session.bestCandidateId) {
      const best = session.candidates.find((c) => c.id === session.bestCandidateId)
      expect(best).toBeDefined()
      expect(session.progress.bestScore).toBe(best!.score)
      expect(session.progress.bestTradeCount).toBe(best!.report.summary.totalTrades)
    }
  })

  it('tracks paused time separately from active elapsed time during a pause', async () => {
    const gate = installGatedPipeline()
    const controls = createRandomSearchRunControls()
    let pausedProgress: RandomSearchProgress | null = null

    const run = runRandomSearch({
      candles: buildCandles(30),
      controls,
      yieldFn: async () => undefined,
      cooperativeBatchSize: 1,
      onProgress: (p) => {
        if (p.status === 'PAUSED') pausedProgress = { ...p }
      },
      config: {
        iterations: 4,
        parameterRanges: DEFAULT_MA_CROSS_RANGES,
        objective: 'profitFactor',
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 30,
        initialCapital: 10_000,
        seed: 6,
      },
    })

    await vi.waitFor(() => expect(gate.started).toBe(1))
    controls.requestPause()
    gate.releaseOne()
    await vi.waitFor(() => expect(pausedProgress).not.toBeNull())

    await new Promise((resolve) => setTimeout(resolve, 40))
    controls.resume()
    for (let n = gate.started + 1; n <= 4; n++) {
      await vi.waitFor(() => expect(gate.started).toBeGreaterThanOrEqual(n))
      gate.releaseOne()
    }
    const session = await run

    expect(session.progress.pausedMs).toBeGreaterThan(0)
    expect(session.progress.wallElapsedMs).toBeGreaterThanOrEqual(session.progress.elapsedMs)
    expect(session.progress.elapsedMs).toBeLessThanOrEqual(session.progress.wallElapsedMs)
  })
})

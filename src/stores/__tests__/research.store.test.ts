import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Candle } from '@/data/candles'
import {
  clearResearchSessionArchive,
  getResearchSession,
  listResearchSessionsBySavedAt,
} from '@/research/session-archive'
import { clearBacktestDetailArchive, getBacktestDetail } from '@/backtests/detail-archive'
import { DEFAULT_MA_CROSS_RANGES } from '@/core/research'
import type { BacktestReport } from '@/core/analytics/types'
import { defaultRiskConfig } from '@/core/risk/config'
import { appQueryClient } from '@/api/query-client'
import { researchSessionKeys } from '@/api/queries/research-sessions'

vi.mock('@/core/dashboard/run-backtest-pipeline', () => ({
  runBacktestPipeline: vi.fn(),
}))

import { runBacktestPipeline } from '@/core/dashboard/run-backtest-pipeline'
import { useResearchStore } from '@/stores/research.store'
import { useBacktestStore } from '@/stores/backtest.store'

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

function stubReport(pf: number): BacktestReport {
  return {
    summary: {
      totalTrades: 12,
      winRate: 0.55,
      netProfit: 120,
      profitFactor: pf,
      expectancy: 10,
      averageWin: 20,
      averageLoss: -8,
      maxDrawdown: 0.08,
      largestWinner: 40,
      largestLoser: -12,
      finalBalance: 10_120,
    },
    equityCurve: [
      { time: 1, equity: 10_000, cash: 10_000, drawdown: 0 },
      { time: 2, equity: 10_120, cash: 10_120, drawdown: 0 },
    ],
    drawdown: {
      currentDrawdown: 0,
      maxDrawdown: 0.08,
      maxDrawdownDurationMs: 0,
      maxDrawdownRecoveryMs: null,
    },
    monthlyReturns: { months: [], bestMonth: null, worstMonth: null },
    tradeAnalysis: {
      averageWin: 20,
      averageLoss: -8,
      largestWinner: 40,
      largestLoser: -12,
      profitFactor: pf,
      expectancy: 10,
      averageHoldingTimeMs: 1,
      longPerformance: { trades: 12, netProfit: 120, winRate: 0.55 },
      shortPerformance: { trades: 0, netProfit: 0, winRate: 0 },
    },
    topTrades: [],
    statistics: {
      totalTrades: 12,
      winningTrades: 7,
      losingTrades: 5,
      winRate: 0.55,
      netProfit: 120,
      grossProfit: 200,
      grossLoss: -80,
      maxDrawdown: 0.08,
      averageTrade: 10,
      finalBalance: 10_120,
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

describe('research store random search workflow', () => {
  beforeEach(() => {
    clearResearchSessionArchive()
    clearBacktestDetailArchive()
    appQueryClient.clear()
    useResearchStore.getState().reset()
    useResearchStore.setState({ appliedParameters: null })
    useBacktestStore.setState({ isRunning: false, error: null })
    vi.mocked(runBacktestPipeline).mockReset()
    vi.mocked(runBacktestPipeline).mockImplementation(async (params) => {
      const fast = params?.strategyParams?.fastPeriod ?? 20
      return {
        report: stubReport(1 + fast / 100),
        candles: params?.candles ?? [],
        context: {
          strategyName: 'Moving Average Cross',
          strategyVersion: 'rs',
          timeframe: '1H',
          candles: params?.candles ?? [],
        },
        backtestId: `bt-${fast}-${Date.now()}`,
        strategyParams: {
          fastPeriod: fast,
          slowPeriod: params?.strategyParams?.slowPeriod ?? 50,
          rsiPeriod: params?.strategyParams?.rsiPeriod ?? 14,
        },
      }
    })
  })

  it('starts with correct configuration and surfaces progress', async () => {
    // Stale empty list cache (as if user opened Research Sessions first).
    appQueryClient.setQueryData(researchSessionKeys.list(), [])

    const candles = buildCandles(40)
    const progressSnapshots: number[] = []
    const statuses: string[] = []
    const unsub = useResearchStore.subscribe((state) => {
      if (state.progress) {
        progressSnapshots.push(state.progress.candidatesTested)
        statuses.push(state.progress.status)
      }
    })

    const result = await useResearchStore.getState().startRandomSearch({
      candles,
      config: {
        iterations: 3,
        parameterRanges: DEFAULT_MA_CROSS_RANGES,
        objective: 'profitFactor',
        symbol: 'ETHUSDT',
        interval: '15m',
        limit: 40,
        initialCapital: 5_000,
        seed: 3,
      },
    })
    unsub()

    const state = useResearchStore.getState()
    expect(state.status).toBe('completed')
    expect(state.report?.iterationsRequested).toBe(3)
    expect(state.report?.config.symbol).toBe('ETHUSDT')
    expect(state.report?.topCandidates.length).toBeGreaterThan(0)
    expect(state.report?.bestCandidate).not.toBeNull()
    expect(progressSnapshots).toContain(1)
    expect(progressSnapshots).toContain(3)
    expect(statuses).toContain('INITIALIZING')
    expect(statuses).toContain('FINALIZING')
    expect(statuses.at(-1)).toBe('COMPLETED')
    expect(state.progress?.status).toBe('COMPLETED')
    expect(result?.persisted).toBe(true)
    expect(result?.session.id).toBe(state.report!.sessionId)
    expect(runBacktestPipeline).toHaveBeenCalledTimes(3)

    // Generated session must appear in the shared archive-backed query list.
    const archived = getResearchSession(state.report!.sessionId)
    expect(archived).not.toBeNull()
    expect(listResearchSessionsBySavedAt()).toHaveLength(1)
    const list = appQueryClient.getQueryData(researchSessionKeys.list()) as
      | { session: { id: string } }[]
      | undefined
    expect(list).toHaveLength(1)
    expect(list?.[0]?.session.id).toBe(state.report!.sessionId)
  })

  it('validates ranges before starting', async () => {
    await useResearchStore.getState().startRandomSearch({
      candles: buildCandles(20),
      config: {
        iterations: 5,
        parameterRanges: [{ name: 'fastPeriod', min: 50, max: 10, step: 1 }],
        objective: 'netProfit',
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 20,
        initialCapital: 10_000,
      },
    })

    const state = useResearchStore.getState()
    expect(state.status).toBe('failed')
    expect(state.validationErrors.length).toBeGreaterThan(0)
    expect(runBacktestPipeline).not.toHaveBeenCalled()
  })

  it('blocks duplicate concurrent runs', async () => {
    let resolveFirst!: () => void
    const gate = new Promise<void>((resolve) => {
      resolveFirst = resolve
    })

    vi.mocked(runBacktestPipeline).mockImplementation(async (params) => {
      await gate
      const fast = params?.strategyParams?.fastPeriod ?? 20
      return {
        report: stubReport(1.4),
        candles: params?.candles ?? [],
        context: {
          strategyName: 'Moving Average Cross',
          strategyVersion: 'rs',
          timeframe: '1H',
          candles: params?.candles ?? [],
        },
        backtestId: `bt-${fast}`,
        strategyParams: {
          fastPeriod: fast,
          slowPeriod: 50,
          rsiPeriod: 14,
        },
      }
    })

    const candles = buildCandles(30)
    const config = {
      iterations: 2,
      parameterRanges: DEFAULT_MA_CROSS_RANGES,
      objective: 'profitFactor' as const,
      symbol: 'BTCUSDT',
      interval: '1h',
      limit: 30,
      initialCapital: 10_000,
      seed: 9,
    }

    const first = useResearchStore.getState().startRandomSearch({ candles, config })
    await Promise.resolve()
    expect(useResearchStore.getState().status).toBe('running')

    await useResearchStore.getState().startRandomSearch({ candles, config })
    expect(useResearchStore.getState().error).toMatch(/already running/i)

    resolveFirst()
    await first
    expect(runBacktestPipeline).toHaveBeenCalledTimes(2)
  })

  it('Apply Parameters updates form state only and does not rerun', async () => {
    const runSpy = vi.spyOn(useBacktestStore.getState(), 'runBacktest')

    useResearchStore.getState().applyParameters({
      fastPeriod: 12,
      slowPeriod: 48,
      rsiPeriod: 9,
    })

    expect(useResearchStore.getState().appliedParameters).toEqual({
      fastPeriod: 12,
      slowPeriod: 48,
      rsiPeriod: 9,
    })
    expect(runSpy).not.toHaveBeenCalled()
    expect(useBacktestStore.getState().isRunning).toBe(false)
    runSpy.mockRestore()
  })

  it('archives session + candidate details for View Details / View Analysis', async () => {
    await useResearchStore.getState().startRandomSearch({
      candles: buildCandles(35),
      config: {
        iterations: 2,
        parameterRanges: DEFAULT_MA_CROSS_RANGES,
        objective: 'profitFactor',
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 35,
        initialCapital: 10_000,
        seed: 4,
      },
    })

    const state = useResearchStore.getState()
    expect(state.report).not.toBeNull()
    const archived = getResearchSession(state.report!.sessionId)
    expect(archived?.report.sessionId).toBe(state.report!.sessionId)
    expect(archived?.report.bestCandidate?.score).toBe(state.report!.bestCandidate?.score)

    const best = state.report!.bestCandidate!
    const detail = getBacktestDetail(best.backtestId)
    expect(detail).not.toBeNull()
    expect(detail?.report.summary.profitFactor).toBe(best.report.summary.profitFactor)
  })

  it('marks empty when no candidates pass constraints', async () => {
    vi.mocked(runBacktestPipeline).mockImplementation(async (params) => {
      const report = stubReport(0.5)
      report.summary.totalTrades = 1
      return {
        report,
        candles: params?.candles ?? [],
        context: {
          strategyName: 'Moving Average Cross',
          strategyVersion: 'rs',
          timeframe: '1H',
          candles: params?.candles ?? [],
        },
        backtestId: `bt-empty-${Date.now()}`,
        strategyParams: {
          fastPeriod: 10,
          slowPeriod: 40,
          rsiPeriod: 14,
        },
      }
    })

    await useResearchStore.getState().startRandomSearch({
      candles: buildCandles(30),
      config: {
        iterations: 2,
        parameterRanges: DEFAULT_MA_CROSS_RANGES,
        objective: 'profitFactor',
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 30,
        initialCapital: 10_000,
        seed: 2,
        constraints: { minimumTrades: 50, minimumProfitFactor: 5 },
      },
    })

    expect(useResearchStore.getState().status).toBe('empty')
    expect(useResearchStore.getState().report?.topCandidates).toEqual([])
  })

  it('opens cancel dialog without aborting until discard is confirmed', async () => {
    let resolveIter!: () => void
    const gate = new Promise<void>((resolve) => {
      resolveIter = resolve
    })

    vi.mocked(runBacktestPipeline).mockImplementation(async (params) => {
      await gate
      return {
        report: stubReport(1.3),
        candles: params?.candles ?? [],
        context: {
          strategyName: 'Moving Average Cross',
          strategyVersion: 'rs',
          timeframe: '1H',
          candles: params?.candles ?? [],
        },
        backtestId: `bt-cancel-${Date.now()}`,
        strategyParams: {
          fastPeriod: 10,
          slowPeriod: 40,
          rsiPeriod: 14,
        },
      }
    })

    const run = useResearchStore.getState().startRandomSearch({
      candles: buildCandles(25),
      config: {
        iterations: 4,
        parameterRanges: DEFAULT_MA_CROSS_RANGES,
        objective: 'profitFactor',
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 25,
        initialCapital: 10_000,
        seed: 11,
      },
    })

    await Promise.resolve()
    useResearchStore.getState().openCancelDialog()
    expect(useResearchStore.getState().cancelDialogOpen).toBe(true)
    expect(useResearchStore.getState().status).toBe('running')

    useResearchStore.getState().confirmDiscardProgress()
    expect(useResearchStore.getState().status).toBe('cancelling')
    expect(useResearchStore.getState().cancelDialogOpen).toBe(false)

    resolveIter()
    const result = await run

    expect(useResearchStore.getState().status).toBe('cancelled')
    expect(useResearchStore.getState().progress?.status).toBe('CANCELLED')
    expect(useResearchStore.getState().session?.partial).toBe(false)
    expect(result?.persisted).toBe(false)
    expect(listResearchSessionsBySavedAt()).toHaveLength(0)
    expect(useResearchStore.getState().abortController).toBeNull()
  })

  it('save partial result persists CANCELLED session and returns navigation id', async () => {
    let resolveIter!: () => void
    const gate = new Promise<void>((resolve) => {
      resolveIter = resolve
    })

    vi.mocked(runBacktestPipeline).mockImplementation(async (params) => {
      await gate
      return {
        report: stubReport(1.5),
        candles: params?.candles ?? [],
        context: {
          strategyName: 'Moving Average Cross',
          strategyVersion: 'rs',
          timeframe: '1H',
          candles: params?.candles ?? [],
        },
        backtestId: `bt-partial-${Date.now()}`,
        strategyParams: {
          fastPeriod: 12,
          slowPeriod: 40,
          rsiPeriod: 14,
        },
      }
    })

    const run = useResearchStore.getState().startRandomSearch({
      candles: buildCandles(25),
      config: {
        iterations: 5,
        parameterRanges: DEFAULT_MA_CROSS_RANGES,
        objective: 'profitFactor',
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 25,
        initialCapital: 10_000,
        seed: 12,
      },
    })

    await Promise.resolve()
    useResearchStore.getState().confirmSavePartialResult()
    expect(useResearchStore.getState().status).toBe('cancelling')
    resolveIter()
    const result = await run

    expect(result?.persisted).toBe(true)
    expect(result?.session.status).toBe('cancelled')
    expect(result?.session.partial).toBe(true)
    expect(result?.report.partial).toBe(true)
    expect(getResearchSession(result!.session.id)).not.toBeNull()
    expect(listResearchSessionsBySavedAt()).toHaveLength(1)
  })

  it('pause and resume update UI status and block duplicate starts', async () => {
    const pending: Array<() => void> = []
    let started = 0

    vi.mocked(runBacktestPipeline).mockImplementation(async (params) => {
      started += 1
      await new Promise<void>((resolve) => pending.push(resolve))
      return {
        report: stubReport(1.4),
        candles: params?.candles ?? [],
        context: {
          strategyName: 'Moving Average Cross',
          strategyVersion: 'rs',
          timeframe: '1H',
          candles: params?.candles ?? [],
        },
        backtestId: `bt-pause-${started}`,
        strategyParams: {
          fastPeriod: 10,
          slowPeriod: 40,
          rsiPeriod: 14,
        },
      }
    })

    const run = useResearchStore.getState().startRandomSearch({
      candles: buildCandles(25),
      config: {
        iterations: 3,
        parameterRanges: DEFAULT_MA_CROSS_RANGES,
        objective: 'profitFactor',
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 25,
        initialCapital: 10_000,
        seed: 13,
      },
    })

    await vi.waitFor(() => expect(started).toBe(1))
    expect(useResearchStore.getState().status).toBe('running')

    await useResearchStore.getState().startRandomSearch({
      candles: buildCandles(10),
      config: {
        iterations: 2,
        parameterRanges: DEFAULT_MA_CROSS_RANGES,
        objective: 'profitFactor',
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 10,
        initialCapital: 10_000,
        seed: 1,
      },
    })
    expect(useResearchStore.getState().error).toMatch(/already running/i)

    useResearchStore.getState().pauseRandomSearch()
    pending.shift()?.()
    await vi.waitFor(() => {
      expect(useResearchStore.getState().status).toBe('paused')
    })

    await useResearchStore.getState().startRandomSearch({
      candles: buildCandles(10),
      config: {
        iterations: 2,
        parameterRanges: DEFAULT_MA_CROSS_RANGES,
        objective: 'profitFactor',
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 10,
        initialCapital: 10_000,
        seed: 2,
      },
    })
    expect(useResearchStore.getState().error).toMatch(/already running/i)

    useResearchStore.getState().resumeRandomSearch()
    expect(useResearchStore.getState().status).toBe('running')

    for (let n = started + 1; n <= 3; n++) {
      await vi.waitFor(() => expect(started).toBeGreaterThanOrEqual(n))
      pending.shift()?.()
    }
    await run
    expect(useResearchStore.getState().status).toBe('completed')
  })

  it('supports Page Visibility warning flag', () => {
    useResearchStore.getState().setBackgroundWarningVisible(true)
    expect(useResearchStore.getState().backgroundWarningVisible).toBe(true)
    useResearchStore.getState().setBackgroundWarningVisible(false)
    expect(useResearchStore.getState().backgroundWarningVisible).toBe(false)
  })

  it('failure does not persist a session and leaves a FAILED progress state', async () => {
    vi.mocked(runBacktestPipeline).mockImplementation(async () => {
      throw new Error('pipeline exploded')
    })

    const result = await useResearchStore.getState().startRandomSearch({
      candles: buildCandles(20),
      config: {
        iterations: 2,
        parameterRanges: DEFAULT_MA_CROSS_RANGES,
        objective: 'profitFactor',
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 20,
        initialCapital: 10_000,
        seed: 5,
      },
    })

    const state = useResearchStore.getState()
    expect(state.status).toBe('failed')
    expect(state.error).toMatch(/pipeline exploded/i)
    expect(state.progress?.status).toBe('FAILED')
    expect(result?.persisted).toBe(false)
    expect(listResearchSessionsBySavedAt()).toHaveLength(0)
    expect(state.abortController).toBeNull()
  })

  it('returns the exact newly created session id for post-completion navigation', async () => {
    const result = await useResearchStore.getState().startRandomSearch({
      candles: buildCandles(30),
      config: {
        iterations: 2,
        parameterRanges: DEFAULT_MA_CROSS_RANGES,
        objective: 'profitFactor',
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 30,
        initialCapital: 10_000,
        seed: 8,
      },
    })

    expect(result?.persisted).toBe(true)
    expect(result?.session.id).toMatch(/^rs-/)
    expect(result?.session.id).toBe(result?.report.sessionId)
    expect(getResearchSession(result!.session.id)).not.toBeNull()
  })
})

import { describe, expect, it, beforeEach, vi } from 'vitest'
import { clearBacktestDetailArchive, saveBacktestDetail } from '@/backtests/detail-archive'
import { clearResearchSessionArchive, saveResearchSession } from '@/research/session-archive'
import { buildPersistedDetail } from '@/backtests/restore-dashboard'
import { defaultRiskConfig } from '@/core/risk/config'
import { TradeDirection } from '@/core/backtest/Trade'
import type { BacktestReport } from '@/core/analytics/types'
import { createEmptyDashboard } from '@/core/dashboard'
import type { ResearchSession } from '@/core/research'
import { buildResearchReport } from '@/core/research'

vi.mock('@/core/dashboard/run-backtest-pipeline', async () => {
  const actual = await vi.importActual<typeof import('@/core/dashboard/run-backtest-pipeline')>(
    '@/core/dashboard/run-backtest-pipeline',
  )
  return {
    ...actual,
    runBacktestPipeline: vi.fn(async () => {
      throw new Error('runBacktestPipeline should not be called during auto-restore')
    }),
  }
})

import { runBacktestPipeline } from '@/core/dashboard/run-backtest-pipeline'
import { useBacktestStore } from '@/stores/backtest.store'
import { useResearchStore } from '@/stores/research.store'
import { resolveActiveStrategyBacktestId } from '@/hooks/use-auto-restore-latest-session'
import { useAppStore } from '@/stores/app.store'
import { ensureStrategyDraft } from '@/strategies'

function sampleReport(symbol = 'BTCUSDT', netProfit = 25): BacktestReport {
  return {
    summary: {
      totalTrades: 1,
      winRate: 1,
      netProfit,
      profitFactor: 2,
      expectancy: netProfit,
      averageWin: netProfit,
      averageLoss: 0,
      maxDrawdown: 0.01,
      largestWinner: netProfit,
      largestLoser: 0,
      finalBalance: 10_000 + netProfit,
    },
    equityCurve: [
      { time: Date.parse('2024-02-01T00:00:00.000Z'), equity: 10_000, cash: 10_000, drawdown: 0 },
      {
        time: Date.parse('2024-02-02T00:00:00.000Z'),
        equity: 10_000 + netProfit,
        cash: 10_000 + netProfit,
        drawdown: 0,
      },
    ],
    drawdown: {
      currentDrawdown: 0,
      maxDrawdown: 0.01,
      maxDrawdownDurationMs: 0,
      maxDrawdownRecoveryMs: null,
    },
    monthlyReturns: { months: [], bestMonth: null, worstMonth: null },
    tradeAnalysis: {
      averageWin: netProfit,
      averageLoss: 0,
      largestWinner: netProfit,
      largestLoser: 0,
      profitFactor: 2,
      expectancy: netProfit,
      averageHoldingTimeMs: 3_600_000,
      longPerformance: { trades: 1, netProfit, winRate: 1 },
      shortPerformance: { trades: 0, netProfit: 0, winRate: 0 },
    },
    topTrades: [],
    statistics: {
      totalTrades: 1,
      winningTrades: 1,
      losingTrades: 0,
      winRate: 1,
      netProfit,
      grossProfit: netProfit,
      grossLoss: 0,
      maxDrawdown: 0.01,
      averageTrade: netProfit,
      finalBalance: 10_000 + netProfit,
    },
    trades: [
      {
        id: 't-live',
        symbol,
        entryTime: Date.parse('2024-02-01T01:00:00.000Z'),
        exitTime: Date.parse('2024-02-02T01:00:00.000Z'),
        entryPrice: 100,
        exitPrice: 125,
        quantity: 1,
        direction: TradeDirection.LONG,
        pnl: netProfit,
        commission: 0,
        duration: 3_600_000,
      },
    ],
    config: {
      initialCapital: 10_000,
      commissionPercent: 0.1,
      positionSizePercent: 100,
      symbol,
      riskConfig: defaultRiskConfig,
    },
  }
}

function resetStores() {
  clearBacktestDetailArchive()
  clearResearchSessionArchive()
  useAppStore.setState({ activeStrategyId: null })
  useBacktestStore.setState({
    dashboard: createEmptyDashboard(),
    report: null,
    isRunning: false,
    error: null,
    viewMode: 'live',
    restoredId: null,
    isRestoring: false,
    restoreError: null,
    liveSession: null,
    autoRestored: false,
    isHydratingSession: false,
    sessionHydrateError: null,
    hasAttemptedSessionHydrate: false,
  })
  useResearchStore.getState().reset()
  vi.mocked(runBacktestPipeline).mockClear()
}

describe('auto restore latest session', () => {
  beforeEach(() => {
    resetStores()
  })

  it('resolves active Strategy winning backtest over arbitrary latest', () => {
    expect(resolveActiveStrategyBacktestId(null)).toBeNull()

    const session: ResearchSession = {
      id: 'strat-active',
      status: 'completed',
      config: {
        iterations: 2,
        parameterRanges: [],
        objective: 'profitFactor',
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 100,
        initialCapital: 10_000,
      },
      candidates: [
        {
          id: 'cand-1',
          parameters: { fastPeriod: 10, slowPeriod: 30, rsiPeriod: 14 },
          score: 1.5,
          passedConstraints: true,
          report: sampleReport('BTCUSDT', 40),
          backtestId: 'bt-winner',
        },
      ],
      bestCandidateId: 'cand-1',
      recommendedCandidateId: 'cand-1',
      error: null,
      createdAt: 1,
      completedAt: 2,
      progress: {
        totalCandidates: 2,
        candidatesTested: 2,
        candidatesAccepted: 1,
        candidatesRejected: 1,
        currentCandidateScore: 1.5,
        bestScore: 1.5,
        bestTradeCount: 1,
        bestCandidateParameters: { fastPeriod: 10, slowPeriod: 30, rsiPeriod: 14 },
        improvementsCount: 1,
        candidatesSinceLastImprovement: 0,
        elapsedMs: 0,
        wallElapsedMs: 0,
        pausedMs: 0,
        estimatedRemainingMs: 0,
        status: 'COMPLETED',
      },
    }
    const report = buildResearchReport(session)
    saveResearchSession({ session, report, savedAt: Date.now() })
    ensureStrategyDraft({
      id: 'strat-active',
      market: 'BTCUSDT',
      timeframe: '1H',
    })
    useAppStore.setState({ activeStrategyId: 'strat-active' })

    expect(resolveActiveStrategyBacktestId('strat-active')).toBe('bt-winner')
  })

  it('refresh restores latest session into active dashboard without rerunning', () => {
    const older = buildPersistedDetail({
      id: 'bt-old',
      report: sampleReport('BTCUSDT', 10),
      context: {
        strategyName: 'Moving Average Cross',
        strategyVersion: 'v1.0.0',
        timeframe: '1H',
      },
    })
    older.savedAt = 1_000

    const newest = buildPersistedDetail({
      id: 'bt-latest',
      report: sampleReport('ETHUSDT', 77),
      context: {
        strategyName: 'Moving Average Cross',
        strategyVersion: 'v1.0.0',
        timeframe: '15M',
      },
    })
    newest.savedAt = 2_000

    saveBacktestDetail(older)
    saveBacktestDetail(newest)

    useBacktestStore.getState().applyStartupSession(newest)

    const state = useBacktestStore.getState()
    expect(state.dashboard.hasBacktest).toBe(true)
    expect(state.autoRestored).toBe(true)
    expect(state.viewMode).toBe('live')
    expect(state.report?.summary.netProfit).toBe(77)
    expect(state.report?.config.symbol).toBe('ETHUSDT')
    expect(state.dashboard.activeStrategy.name).toBe('Moving Average Cross')
    expect(state.dashboard.recentBacktests[0]?.id).toBe('bt-latest')
    expect(state.liveSession?.report?.summary.netProfit).toBe(77)
    expect(runBacktestPipeline).not.toHaveBeenCalled()
  })

  it('no latest session leaves empty state', () => {
    expect(useBacktestStore.getState().dashboard.hasBacktest).toBe(false)
    useBacktestStore.getState().markSessionHydrateEmpty()
    const state = useBacktestStore.getState()
    expect(state.dashboard.hasBacktest).toBe(false)
    expect(state.autoRestored).toBe(false)
    expect(state.isHydratingSession).toBe(false)
    expect(runBacktestPipeline).not.toHaveBeenCalled()
  })

  it('restore failure surfaces retryable error without fabricating dashboard data', () => {
    useBacktestStore.getState().markSessionHydrateFailed('Archive unavailable')
    const state = useBacktestStore.getState()
    expect(state.sessionHydrateError).toBe('Archive unavailable')
    expect(state.dashboard.hasBacktest).toBe(false)
    expect(state.dashboard.equityCurve).toEqual([])
    expect(state.report).toBeNull()
    expect(runBacktestPipeline).not.toHaveBeenCalled()
  })

  it('dashboard state matches persisted report fields', () => {
    const detail = buildPersistedDetail({
      id: 'bt-match',
      report: sampleReport('SOLUSDT', 123),
      context: {
        strategyName: 'Moving Average Cross',
        strategyVersion: 'v9',
        timeframe: '4H',
      },
    })
    saveBacktestDetail(detail)
    useBacktestStore.getState().applyStartupSession(detail)

    const state = useBacktestStore.getState()
    expect(state.report).toBe(detail.report)
    expect(state.dashboard.hasBacktest).toBe(true)
    expect(state.report?.summary.profitFactor).toBe(detail.report.summary.profitFactor)
    expect(state.report?.summary.maxDrawdown).toBe(detail.report.summary.maxDrawdown)
    expect(state.report?.trades).toHaveLength(1)
    expect(state.dashboard.activeStrategy.version).toBe('v9')
    expect(runBacktestPipeline).not.toHaveBeenCalled()
  })

  it('hydrates research report when available', () => {
    const detail = buildPersistedDetail({
      id: 'bt-rs',
      report: sampleReport('BTCUSDT', 40),
      context: {
        strategyName: 'Moving Average Cross',
        strategyVersion: 'rs',
        timeframe: '1H',
      },
    })
    saveBacktestDetail(detail)
    useBacktestStore.getState().applyStartupSession(detail)

    const session: ResearchSession = {
      id: 'rs-1',
      status: 'completed',
      config: {
        iterations: 2,
        parameterRanges: [],
        objective: 'profitFactor',
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 100,
        initialCapital: 10_000,
      },
      candidates: [],
      bestCandidateId: null,
      error: null,
      createdAt: 1,
      completedAt: 2,
      progress: {
        totalCandidates: 2,
        candidatesTested: 2,
        candidatesAccepted: 0,
        candidatesRejected: 2,
        currentCandidateScore: null,
        bestScore: null,
        bestTradeCount: null,
        bestCandidateParameters: null,
        improvementsCount: 0,
        candidatesSinceLastImprovement: null,
        elapsedMs: 0,
        wallElapsedMs: 0,
        pausedMs: 0,
        estimatedRemainingMs: 0,
        status: 'COMPLETED',
      },
    }
    const report = buildResearchReport(session)
    saveResearchSession({ session, report, savedAt: Date.now() })
    useResearchStore.getState().hydrateFromPersistedSession({ session, report, savedAt: Date.now() })

    expect(useResearchStore.getState().report?.sessionId).toBe('rs-1')
    expect(useBacktestStore.getState().autoRestored).toBe(true)
    expect(runBacktestPipeline).not.toHaveBeenCalled()
  })

  it('View Details still works after auto-restore', async () => {
    const live = buildPersistedDetail({
      id: 'bt-live',
      report: sampleReport('BTCUSDT', 10),
      context: {
        strategyName: 'Moving Average Cross',
        strategyVersion: 'v1',
        timeframe: '1H',
      },
    })
    const historical = buildPersistedDetail({
      id: 'bt-hist',
      report: sampleReport('ETHUSDT', 99),
      context: {
        strategyName: 'Moving Average Cross',
        strategyVersion: 'v2',
        timeframe: '15M',
      },
    })
    saveBacktestDetail(live)
    saveBacktestDetail(historical)

    useBacktestStore.getState().applyStartupSession(live)
    await useBacktestStore.getState().restoreBacktest('bt-hist')

    const state = useBacktestStore.getState()
    expect(state.viewMode).toBe('restored')
    expect(state.restoredId).toBe('bt-hist')
    expect(state.report?.config.symbol).toBe('ETHUSDT')
    expect(runBacktestPipeline).not.toHaveBeenCalled()

    useBacktestStore.getState().clearRestoredResult()
    expect(useBacktestStore.getState().viewMode).toBe('live')
    expect(useBacktestStore.getState().report?.config.symbol).toBe('BTCUSDT')
  })
})

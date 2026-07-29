import { describe, expect, it, beforeEach, vi } from 'vitest'
import { clearBacktestDetailArchive, saveBacktestDetail } from '@/backtests/detail-archive'
import { buildPersistedDetail } from '@/backtests/restore-dashboard'
import { defaultRiskConfig } from '@/core/risk/config'
import { TradeDirection } from '@/core/backtest/Trade'
import type { BacktestReport } from '@/core/analytics/types'

vi.mock('@/core/dashboard/run-backtest-pipeline', async () => {
  const actual = await vi.importActual<typeof import('@/core/dashboard/run-backtest-pipeline')>(
    '@/core/dashboard/run-backtest-pipeline',
  )
  return {
    ...actual,
    runBacktestPipeline: vi.fn(async () => {
      throw new Error('runBacktestPipeline should not be called during restore')
    }),
  }
})

import { useBacktestStore } from '@/stores/backtest.store'
import { createEmptyDashboard } from '@/core/dashboard'

function sampleReport(): BacktestReport {
  return {
    summary: {
      totalTrades: 1,
      winRate: 1,
      netProfit: 25,
      profitFactor: 2,
      expectancy: 25,
      averageWin: 25,
      averageLoss: 0,
      maxDrawdown: 0.01,
      largestWinner: 25,
      largestLoser: 0,
      finalBalance: 10_025,
    },
    equityCurve: [
      { time: Date.parse('2024-02-01T00:00:00.000Z'), equity: 10_000, cash: 10_000, drawdown: 0 },
      { time: Date.parse('2024-02-02T00:00:00.000Z'), equity: 10_025, cash: 10_025, drawdown: 0 },
    ],
    drawdown: {
      currentDrawdown: 0,
      maxDrawdown: 0.01,
      maxDrawdownDurationMs: 0,
      maxDrawdownRecoveryMs: null,
    },
    monthlyReturns: { months: [], bestMonth: null, worstMonth: null },
    tradeAnalysis: {
      averageWin: 25,
      averageLoss: 0,
      largestWinner: 25,
      largestLoser: 0,
      profitFactor: 2,
      expectancy: 25,
      averageHoldingTimeMs: 3_600_000,
      longPerformance: { trades: 1, netProfit: 25, winRate: 1 },
      shortPerformance: { trades: 0, netProfit: 0, winRate: 0 },
    },
    topTrades: [],
    statistics: {
      totalTrades: 1,
      winningTrades: 1,
      losingTrades: 0,
      winRate: 1,
      netProfit: 25,
      grossProfit: 25,
      grossLoss: 0,
      maxDrawdown: 0.01,
      averageTrade: 25,
      finalBalance: 10_025,
    },
    trades: [
      {
        id: 't-live',
        symbol: 'BTCUSDT',
        entryTime: Date.parse('2024-02-01T01:00:00.000Z'),
        exitTime: Date.parse('2024-02-01T02:00:00.000Z'),
        entryPrice: 100,
        exitPrice: 125,
        quantity: 1,
        direction: TradeDirection.LONG,
        pnl: 25,
        commission: 0,
        duration: 3_600_000,
      },
    ],
    config: {
      initialCapital: 10_000,
      commissionPercent: 0.1,
      positionSizePercent: 100,
      symbol: 'BTCUSDT',
      riskConfig: defaultRiskConfig,
    },
  }
}

describe('backtest store restore session', () => {
  beforeEach(() => {
    clearBacktestDetailArchive()
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
  })

  it('restores a historical detail into the viewed session without rerunning', async () => {
    const liveReport = sampleReport()
    const historical = buildPersistedDetail({
      id: 'bt-hist',
      report: {
        ...sampleReport(),
        config: {
          ...sampleReport().config,
          symbol: 'ETHUSDT',
        },
        summary: {
          ...sampleReport().summary,
          netProfit: 99,
        },
      },
      context: {
        strategyName: 'Moving Average Cross',
        strategyVersion: 'v9.9.9',
        timeframe: '1D',
      },
    })
    saveBacktestDetail(historical)

    const liveDashboard = {
      ...createEmptyDashboard(),
      hasBacktest: true,
      recentBacktests: [historical.summary],
      activeStrategy: {
        name: 'Moving Average Cross',
        version: 'v1.0.0',
        status: 'active' as const,
      },
    }

    useBacktestStore.setState({
      dashboard: liveDashboard,
      report: liveReport,
      liveSession: {
        dashboard: liveDashboard,
        report: liveReport,
        lastParams: useBacktestStore.getState().lastParams,
      },
      viewMode: 'live',
    })

    await useBacktestStore.getState().restoreBacktest('bt-hist')

    const state = useBacktestStore.getState()
    expect(state.viewMode).toBe('restored')
    expect(state.restoredId).toBe('bt-hist')
    expect(state.report?.config.symbol).toBe('ETHUSDT')
    expect(state.dashboard.activeStrategy.version).toBe('v9.9.9')
    expect(state.dashboard.timeframeDistribution[0]?.name).toBe('1D')
    expect(state.dashboard.recentBacktests).toHaveLength(1)
    expect(state.dashboard.recentBacktests[0]?.market).toBe(historical.summary.market)
  })

  it('surfaces missing detail honestly and can clear restore errors', async () => {
    await useBacktestStore.getState().restoreBacktest('does-not-exist')
    expect(useBacktestStore.getState().restoreError).toMatch(/No saved report/)
    expect(useBacktestStore.getState().viewMode).toBe('live')

    useBacktestStore.getState().clearRestoreError()
    expect(useBacktestStore.getState().restoreError).toBeNull()
  })

  it('returns to the latest live session when cleared', async () => {
    const liveReport = sampleReport()
    const historical = buildPersistedDetail({
      id: 'bt-hist-2',
      report: {
        ...sampleReport(),
        config: { ...sampleReport().config, symbol: 'SOLUSDT' },
      },
      context: {
        strategyName: 'Moving Average Cross',
        strategyVersion: 'v3.0.0',
        timeframe: '5M',
      },
    })
    saveBacktestDetail(historical)

    const liveDashboard = {
      ...createEmptyDashboard(),
      hasBacktest: true,
      recentBacktests: [historical.summary],
      activeStrategy: {
        name: 'Moving Average Cross',
        version: 'v1.0.0',
        status: 'active' as const,
      },
    }

    useBacktestStore.setState({
      dashboard: liveDashboard,
      report: liveReport,
      liveSession: {
        dashboard: liveDashboard,
        report: liveReport,
        lastParams: useBacktestStore.getState().lastParams,
      },
    })

    await useBacktestStore.getState().restoreBacktest('bt-hist-2')
    expect(useBacktestStore.getState().report?.config.symbol).toBe('SOLUSDT')

    useBacktestStore.getState().clearRestoredResult()
    expect(useBacktestStore.getState().viewMode).toBe('live')
    expect(useBacktestStore.getState().restoredId).toBeNull()
    expect(useBacktestStore.getState().report?.config.symbol).toBe('BTCUSDT')
  })
})

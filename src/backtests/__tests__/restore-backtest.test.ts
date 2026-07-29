import { describe, expect, it, beforeEach, vi } from 'vitest'
import type { BacktestSummary } from '@trading-os/shared'
import type { BacktestReport } from '@/core/analytics/types'
import { defaultRiskConfig } from '@/core/risk/config'
import { TradeDirection } from '@/core/backtest/Trade'
import {
  clearBacktestDetailArchive,
  fetchBacktestDetail,
  getBacktestDetail,
  saveBacktestDetail,
  BacktestDetailNotFoundError,
} from '../detail-archive'
import {
  buildPersistedDetail,
  formatRestoredDateRange,
  restoreDashboardFromDetail,
} from '../restore-dashboard'

function buildReport(symbol = 'ETHUSDT'): BacktestReport {
  return {
    summary: {
      totalTrades: 2,
      winRate: 0.5,
      netProfit: 100,
      profitFactor: 1.5,
      expectancy: 50,
      averageWin: 120,
      averageLoss: -20,
      maxDrawdown: 0.05,
      largestWinner: 120,
      largestLoser: -20,
      finalBalance: 10_100,
    },
    equityCurve: [
      { time: Date.parse('2024-01-01T00:00:00.000Z'), equity: 10_000, cash: 10_000, drawdown: 0 },
      { time: Date.parse('2024-01-10T00:00:00.000Z'), equity: 10_100, cash: 10_100, drawdown: 0 },
    ],
    drawdown: {
      currentDrawdown: 0,
      maxDrawdown: 0.05,
      maxDrawdownDurationMs: 0,
      maxDrawdownRecoveryMs: null,
    },
    monthlyReturns: { months: [], bestMonth: null, worstMonth: null },
    tradeAnalysis: {
      averageWin: 120,
      averageLoss: -20,
      largestWinner: 120,
      largestLoser: -20,
      profitFactor: 1.5,
      expectancy: 50,
      averageHoldingTimeMs: 86_400_000,
      longPerformance: { trades: 2, netProfit: 100, winRate: 0.5 },
      shortPerformance: { trades: 0, netProfit: 0, winRate: 0 },
    },
    topTrades: [],
    statistics: {
      totalTrades: 2,
      winningTrades: 1,
      losingTrades: 1,
      winRate: 0.5,
      netProfit: 100,
      grossProfit: 120,
      grossLoss: -20,
      maxDrawdown: 0.05,
      averageTrade: 50,
      finalBalance: 10_100,
    },
    trades: [
      {
        id: 't1',
        symbol,
        entryTime: Date.parse('2024-01-02T00:00:00.000Z'),
        exitTime: Date.parse('2024-01-03T00:00:00.000Z'),
        entryPrice: 100,
        exitPrice: 110,
        quantity: 1,
        direction: TradeDirection.LONG,
        pnl: 10,
        commission: 0.1,
        duration: 86_400_000,
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

describe('backtest detail archive', () => {
  beforeEach(() => {
    clearBacktestDetailArchive()
  })

  it('saves and loads a detail without duplicating on upsert', () => {
    const report = buildReport('BTCUSDT')
    const detail = buildPersistedDetail({
      id: 'bt-1',
      report,
      context: {
        strategyName: 'Moving Average Cross',
        strategyVersion: 'v1.0.0',
        timeframe: '1H',
      },
    })

    saveBacktestDetail(detail)
    saveBacktestDetail({ ...detail, savedAt: detail.savedAt + 1 })

    expect(getBacktestDetail('bt-1')?.report.config.symbol).toBe('BTCUSDT')
    expect(getBacktestDetail('bt-1')?.summary.market).toBe('BTCUSDT')
    expect(getBacktestDetail('bt-1')?.summary.version).toBe('v1.0.0')
    expect(getBacktestDetail('bt-1')?.summary.timeframe).toBe('1H')
  })

  it('throws an honest missing-detail error', async () => {
    await expect(fetchBacktestDetail('missing')).rejects.toBeInstanceOf(BacktestDetailNotFoundError)
  })
})

describe('restoreDashboardFromDetail', () => {
  it('restores KPIs and metadata from the persisted report without rerunning', () => {
    const report = buildReport('SOLUSDT')
    const detail = buildPersistedDetail({
      id: 'bt-restore',
      report,
      context: {
        strategyName: 'Moving Average Cross',
        strategyVersion: 'v2.1.0',
        timeframe: '4H',
      },
    })

    const history: BacktestSummary[] = [
      detail.summary,
      {
        id: 'bt-other',
        version: 'v1.0.0',
        date: '2024-01-01',
        market: 'BTCUSDT',
        timeframe: '1H',
        trades: 1,
        winRate: 50,
        profitFactor: 1,
        maxDrawdown: -5,
        netProfit: 10,
        status: 'completed',
      },
    ]

    const pipelineSpy = vi.fn()
    const dashboard = restoreDashboardFromDetail(detail, history)

    expect(pipelineSpy).not.toHaveBeenCalled()
    expect(dashboard.hasBacktest).toBe(true)
    expect(dashboard.activeStrategy.name).toBe('Moving Average Cross')
    expect(dashboard.activeStrategy.version).toBe('v2.1.0')
    expect(dashboard.watchlist[0]?.symbol).toBe('SOLUSDT')
    expect(dashboard.timeframeDistribution[0]?.name).toBe('4H')
    expect(dashboard.recentBacktests).toEqual(history)
    expect(dashboard.recentBacktests).toHaveLength(2)
    expect(formatRestoredDateRange(report)).toContain('2024')
  })

  it('does not append a new history entry when restoring', () => {
    const detail = buildPersistedDetail({
      id: 'bt-a',
      report: buildReport(),
      context: {
        strategyName: 'Moving Average Cross',
        strategyVersion: 'v1.0.0',
        timeframe: '15M',
      },
    })

    const history = [detail.summary]
    const first = restoreDashboardFromDetail(detail, history)
    const second = restoreDashboardFromDetail(detail, first.recentBacktests)

    expect(second.recentBacktests).toHaveLength(1)
    expect(second.recentBacktests[0]?.id).toBe('bt-a')
    expect(second.recentBacktests[0]?.timeframe).toBe('15M')
  })
})

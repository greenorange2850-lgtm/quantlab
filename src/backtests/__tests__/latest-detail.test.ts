import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import type { BacktestReport } from '@/core/analytics/types'
import { defaultRiskConfig } from '@/core/risk/config'
import { TradeDirection } from '@/core/backtest/Trade'
import {
  clearBacktestDetailArchive,
  getLatestBacktestDetail,
  listBacktestDetailsBySavedAt,
  saveBacktestDetail,
} from '../detail-archive'
import { buildPersistedDetail } from '../restore-dashboard'

function buildReport(symbol: string, netProfit: number): BacktestReport {
  return {
    summary: {
      totalTrades: 2,
      winRate: 0.5,
      netProfit,
      profitFactor: 1.5,
      expectancy: 50,
      averageWin: 120,
      averageLoss: -20,
      maxDrawdown: 0.05,
      largestWinner: 120,
      largestLoser: -20,
      finalBalance: 10_000 + netProfit,
    },
    equityCurve: [
      { time: Date.parse('2024-01-01T00:00:00.000Z'), equity: 10_000, cash: 10_000, drawdown: 0 },
      { time: Date.parse('2024-01-10T00:00:00.000Z'), equity: 10_000 + netProfit, cash: 10_000 + netProfit, drawdown: 0 },
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
      longPerformance: { trades: 2, netProfit, winRate: 0.5 },
      shortPerformance: { trades: 0, netProfit: 0, winRate: 0 },
    },
    topTrades: [],
    statistics: {
      totalTrades: 2,
      winningTrades: 1,
      losingTrades: 1,
      winRate: 0.5,
      netProfit,
      grossProfit: 120,
      grossLoss: -20,
      maxDrawdown: 0.05,
      averageTrade: 50,
      finalBalance: 10_000 + netProfit,
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

describe('latest backtest detail archive', () => {
  beforeEach(() => {
    clearBacktestDetailArchive()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns null when archive is empty', () => {
    expect(getLatestBacktestDetail()).toBeNull()
    expect(listBacktestDetailsBySavedAt()).toEqual([])
  })

  it('selects the newest savedAt detail as latest', () => {
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'))
    saveBacktestDetail(
      buildPersistedDetail({
        id: 'bt-old',
        report: buildReport('BTCUSDT', 50),
        context: {
          strategyName: 'Moving Average Cross',
          strategyVersion: 'v1',
          timeframe: '1H',
        },
      }),
    )

    vi.setSystemTime(new Date('2024-01-02T00:00:00.000Z'))
    saveBacktestDetail(
      buildPersistedDetail({
        id: 'bt-new',
        report: buildReport('ETHUSDT', 200),
        context: {
          strategyName: 'Moving Average Cross',
          strategyVersion: 'v1',
          timeframe: '15M',
        },
      }),
    )

    const latest = getLatestBacktestDetail()
    expect(latest?.id).toBe('bt-new')
    expect(latest?.report.config.symbol).toBe('ETHUSDT')
    expect(listBacktestDetailsBySavedAt().map((item) => item.id)).toEqual(['bt-new', 'bt-old'])
  })
})

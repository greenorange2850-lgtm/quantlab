import { describe, expect, it } from 'vitest'
import { passesConstraints, scoreFromReport } from '../scoring.js'
import type { BacktestReport } from '../../analytics/types.js'
import { defaultRiskConfig } from '../../risk/config.js'
import { TradeDirection } from '../../backtest/Trade.js'

function sampleReport(overrides: Partial<BacktestReport['summary']> = {}): BacktestReport {
  return {
    summary: {
      totalTrades: 12,
      winRate: 0.5,
      netProfit: 100,
      profitFactor: 1.5,
      expectancy: 8,
      averageWin: 20,
      averageLoss: -10,
      maxDrawdown: 0.1,
      largestWinner: 40,
      largestLoser: -15,
      finalBalance: 10_100,
      ...overrides,
    },
    equityCurve: [],
    drawdown: {
      currentDrawdown: 0,
      maxDrawdown: 0.1,
      maxDrawdownDurationMs: 0,
      maxDrawdownRecoveryMs: null,
    },
    monthlyReturns: { months: [], bestMonth: null, worstMonth: null },
    tradeAnalysis: {
      averageWin: 20,
      averageLoss: -10,
      largestWinner: 40,
      largestLoser: -15,
      profitFactor: 1.5,
      expectancy: 8,
      averageHoldingTimeMs: 3_600_000,
      longPerformance: { trades: 12, netProfit: 100, winRate: 0.5 },
      shortPerformance: { trades: 0, netProfit: 0, winRate: 0 },
    },
    topTrades: [],
    statistics: {
      totalTrades: 12,
      winningTrades: 6,
      losingTrades: 6,
      winRate: 0.5,
      netProfit: 100,
      grossProfit: 150,
      grossLoss: -50,
      maxDrawdown: 0.1,
      averageTrade: 8,
      finalBalance: 10_100,
    },
    trades: [
      {
        id: 't1',
        symbol: 'BTCUSDT',
        entryTime: 1,
        exitTime: 2,
        entryPrice: 100,
        exitPrice: 110,
        quantity: 1,
        direction: TradeDirection.LONG,
        pnl: 10,
        commission: 0,
        duration: 1,
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

describe('scoreFromReport', () => {
  it('reads existing summary fields only', () => {
    const report = sampleReport()
    expect(scoreFromReport(report, 'profitFactor')).toBe(1.5)
    expect(scoreFromReport(report, 'netProfit')).toBe(100)
    expect(scoreFromReport(report, 'winRate')).toBe(0.5)
    expect(scoreFromReport(report, 'expectancy')).toBe(8)
  })
})

describe('passesConstraints', () => {
  it('passes when no constraints are set', () => {
    expect(passesConstraints(sampleReport(), undefined)).toBe(true)
  })

  it('enforces max drawdown, min trades, and min profit factor', () => {
    const report = sampleReport({ maxDrawdown: 0.25, totalTrades: 5, profitFactor: 1.1 })
    expect(
      passesConstraints(report, {
        maxDrawdown: 0.2,
        minimumTrades: 10,
        minimumProfitFactor: 1.2,
      }),
    ).toBe(false)

    expect(
      passesConstraints(sampleReport({ maxDrawdown: 0.05, totalTrades: 12, profitFactor: 1.5 }), {
        maxDrawdown: 0.2,
        minimumTrades: 10,
        minimumProfitFactor: 1.2,
      }),
    ).toBe(true)
  })
})

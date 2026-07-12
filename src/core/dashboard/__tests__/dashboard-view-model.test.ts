import { describe, expect, it } from 'vitest'
import { buildBacktestReport } from '../../analytics/report-builder.js'
import type { BacktestResult } from '../../backtest/BacktestResult.js'
import { buildDashboardViewModel } from '../../dashboard/dashboard-view-model.js'

const sampleResult: BacktestResult = {
  trades: [
    {
      id: 'trade-1',
      symbol: 'BTCUSDT',
      entryTime: Date.parse('2024-01-02T00:00:00.000Z'),
      exitTime: Date.parse('2024-01-03T00:00:00.000Z'),
      entryPrice: 100,
      exitPrice: 110,
      quantity: 1,
      direction: 'LONG',
      pnl: 10,
      commission: 0.1,
      duration: 86_400_000,
    },
    {
      id: 'trade-2',
      symbol: 'BTCUSDT',
      entryTime: Date.parse('2024-01-04T00:00:00.000Z'),
      exitTime: Date.parse('2024-01-05T00:00:00.000Z'),
      entryPrice: 110,
      exitPrice: 105,
      quantity: 1,
      direction: 'LONG',
      pnl: -5,
      commission: 0.1,
      duration: 86_400_000,
    },
  ],
  equityCurve: [
    {
      time: Date.parse('2024-01-01T00:00:00.000Z'),
      equity: 10_000,
      cash: 10_000,
    },
    {
      time: Date.parse('2024-01-03T00:00:00.000Z'),
      equity: 10_010,
      cash: 10_010,
    },
    {
      time: Date.parse('2024-01-05T00:00:00.000Z'),
      equity: 10_005,
      cash: 10_005,
    },
  ],
  statistics: {
    totalTrades: 2,
    winningTrades: 1,
    losingTrades: 1,
    winRate: 0.5,
    netProfit: 5,
    grossProfit: 10,
    grossLoss: 5,
    maxDrawdown: 0.0005,
    averageTrade: 2.5,
    finalBalance: 10_005,
  },
  config: {
    initialCapital: 10_000,
    commissionPercent: 0.1,
    positionSizePercent: 100,
    symbol: 'BTCUSDT',
  },
}

describe('buildDashboardViewModel', () => {
  it('maps analytics output into dashboard presentation data', () => {
    const report = buildBacktestReport(sampleResult)
    const dashboard = buildDashboardViewModel(report, {
      strategyName: 'Moving Average Cross',
      strategyVersion: 'v1.0.0',
      timeframe: '1H',
      candles: [
        { time: sampleResult.equityCurve[0].time, open: 100, high: 101, low: 99, close: 100, volume: 1 },
        { time: sampleResult.equityCurve[1].time, open: 110, high: 111, low: 109, close: 110, volume: 1 },
        { time: sampleResult.equityCurve[2].time, open: 105, high: 106, low: 104, close: 105, volume: 1 },
      ],
    })

    expect(dashboard.hasBacktest).toBe(true)
    expect(dashboard.kpis.find((metric) => metric.id === 'win-rate')?.value).toBe(50)
    expect(dashboard.kpis.find((metric) => metric.id === 'total-trades')?.value).toBe(2)
    expect(dashboard.kpis.find((metric) => metric.id === 'avg-rr')?.value).toBe(2)
    expect(dashboard.equityCurve.length).toBeGreaterThan(0)
    expect(dashboard.tradeHistory).toHaveLength(2)
    expect(dashboard.tradeHistory[0]?.symbol).toBe('BTCUSDT')
    expect(dashboard.portfolio.equity).toBeGreaterThan(0)
    expect(dashboard.portfolio.realizedPnL).toBe(5)
  })
})

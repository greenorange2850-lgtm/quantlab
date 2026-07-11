import { describe, expect, it } from 'vitest'
import type { Trade } from '../Trade.js'
import { computeMaxDrawdown, computeStatistics } from '../statistics.js'

describe('statistics', () => {
  const trades: Trade[] = [
    {
      id: 'trade-1',
      symbol: 'BTCUSDT',
      entryTime: 1,
      exitTime: 2,
      entryPrice: 100,
      exitPrice: 110,
      quantity: 1,
      direction: 'LONG',
      pnl: 10,
      commission: 0.2,
      duration: 1,
    },
    {
      id: 'trade-2',
      symbol: 'BTCUSDT',
      entryTime: 3,
      exitTime: 4,
      entryPrice: 110,
      exitPrice: 105,
      quantity: 1,
      direction: 'LONG',
      pnl: -5,
      commission: 0.2,
      duration: 1,
    },
  ]

  it('computes aggregate trade statistics', () => {
    const stats = computeStatistics(
      trades,
      [
        { time: 1, equity: 10_000, cash: 10_000 },
        { time: 2, equity: 10_010, cash: 10_010 },
        { time: 3, equity: 10_010, cash: 10_010 },
        { time: 4, equity: 10_005, cash: 10_005 },
      ],
      10_000,
    )

    expect(stats.totalTrades).toBe(2)
    expect(stats.winningTrades).toBe(1)
    expect(stats.losingTrades).toBe(1)
    expect(stats.winRate).toBe(0.5)
    expect(stats.netProfit).toBe(5)
    expect(stats.grossProfit).toBe(10)
    expect(stats.grossLoss).toBe(5)
    expect(stats.averageTrade).toBe(2.5)
    expect(stats.finalBalance).toBe(10_005)
  })

  it('computes max drawdown from equity curve', () => {
    const drawdown = computeMaxDrawdown([
      { time: 1, equity: 10_000, cash: 10_000 },
      { time: 2, equity: 11_000, cash: 11_000 },
      { time: 3, equity: 9_900, cash: 9_900 },
    ])

    expect(drawdown).toBeCloseTo(0.1, 5)
  })
})

import { describe, expect, it } from 'vitest'
import type { Trade } from '../../backtest/Trade.js'
import { analyzeTrades, getTopTrades } from '../trade-analyzer.js'

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
  {
    id: 'trade-3',
    symbol: 'BTCUSDT',
    entryTime: 5,
    exitTime: 6,
    entryPrice: 120,
    exitPrice: 110,
    quantity: 1,
    direction: 'SHORT',
    pnl: 10,
    commission: 0.2,
    duration: 1,
  },
]

describe('trade-analyzer', () => {
  it('computes trade analytics', () => {
    const analysis = analyzeTrades(trades)

    expect(analysis.averageWin).toBe(10)
    expect(analysis.averageLoss).toBe(-5)
    expect(analysis.largestWinner).toBe(10)
    expect(analysis.largestLoser).toBe(-5)
    expect(analysis.profitFactor).toBe(4)
    expect(analysis.expectancy).toBeCloseTo(5, 5)
    expect(analysis.averageHoldingTimeMs).toBe(1)
    expect(analysis.longPerformance.trades).toBe(2)
    expect(analysis.shortPerformance.netProfit).toBe(10)
  })

  it('returns top trades by pnl', () => {
    expect(getTopTrades(trades, 2).map((trade) => trade.id)).toEqual(['trade-1', 'trade-3'])
  })

  it('handles empty trade list', () => {
    const analysis = analyzeTrades([])

    expect(analysis.averageWin).toBe(0)
    expect(analysis.profitFactor).toBe(0)
    expect(analysis.longPerformance.trades).toBe(0)
    expect(getTopTrades([])).toEqual([])
  })
})

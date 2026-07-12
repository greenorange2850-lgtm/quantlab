import { describe, expect, it } from 'vitest'
import type { Trade } from '../../backtest/Trade.js'
import {
  analyzeTrades,
  computeAverageRiskReward,
  computeTradeStreaks,
  getTopTrades,
} from '../trade-analyzer.js'

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

describe('analyzeTrades', () => {
  it('computes trade analysis metrics', () => {
    const analysis = analyzeTrades(trades)

    expect(analysis.averageWin).toBe(10)
    expect(analysis.averageLoss).toBe(-5)
    expect(analysis.profitFactor).toBe(2)
  })
})

describe('getTopTrades', () => {
  it('returns highest pnl trades first', () => {
    expect(getTopTrades(trades, 1)[0]?.id).toBe('trade-1')
  })
})

describe('computeTradeStreaks', () => {
  it('computes ending and maximum streaks', () => {
    const streakTrades: Trade[] = [
      { ...trades[0], id: 'w1', pnl: 10, exitTime: 1 },
      { ...trades[0], id: 'w2', pnl: 8, exitTime: 2 },
      { ...trades[1], id: 'l1', pnl: -4, exitTime: 3 },
      { ...trades[1], id: 'l2', pnl: -6, exitTime: 4 },
      { ...trades[0], id: 'w3', pnl: 5, exitTime: 5 },
    ]

    const streaks = computeTradeStreaks(streakTrades)

    expect(streaks.maxWinStreak).toBe(2)
    expect(streaks.maxLossStreak).toBe(2)
    expect(streaks.consecutiveWins).toBe(1)
    expect(streaks.consecutiveLosses).toBe(0)
  })
})

describe('computeAverageRiskReward', () => {
  it('derives average risk-reward from win and loss magnitudes', () => {
    expect(computeAverageRiskReward(20, -10)).toBe(2)
    expect(computeAverageRiskReward(10, 0)).toBe(Number.POSITIVE_INFINITY)
  })
})

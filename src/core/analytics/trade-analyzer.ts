import type { Trade } from '../backtest/Trade.js'
import { TradeDirection } from '../backtest/Trade.js'
import type { DirectionPerformance, TradeAnalysis } from './types.js'

function average(values: number[]): number {
  if (values.length === 0) {
    return 0
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function analyzeDirection(trades: Trade[]): DirectionPerformance {
  if (trades.length === 0) {
    return { trades: 0, netProfit: 0, winRate: 0 }
  }

  const winners = trades.filter((trade) => trade.pnl > 0).length
  const netProfit = trades.reduce((sum, trade) => sum + trade.pnl, 0)

  return {
    trades: trades.length,
    netProfit,
    winRate: winners / trades.length,
  }
}

export function analyzeTrades(trades: Trade[]): TradeAnalysis {
  const wins = trades.filter((trade) => trade.pnl > 0)
  const losses = trades.filter((trade) => trade.pnl < 0)
  const grossProfit = wins.reduce((sum, trade) => sum + trade.pnl, 0)
  const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.pnl, 0))
  const averageWin = average(wins.map((trade) => trade.pnl))
  const averageLoss = average(losses.map((trade) => trade.pnl))
  const winRate = trades.length > 0 ? wins.length / trades.length : 0
  const lossRate = trades.length > 0 ? losses.length / trades.length : 0
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Number.POSITIVE_INFINITY : 0
  const expectancy = winRate * averageWin + lossRate * averageLoss

  return {
    averageWin,
    averageLoss,
    largestWinner: wins.length > 0 ? Math.max(...wins.map((trade) => trade.pnl)) : 0,
    largestLoser: losses.length > 0 ? Math.min(...losses.map((trade) => trade.pnl)) : 0,
    profitFactor,
    expectancy,
    averageHoldingTimeMs: average(trades.map((trade) => trade.duration)),
    longPerformance: analyzeDirection(trades.filter((trade) => trade.direction === TradeDirection.LONG)),
    shortPerformance: analyzeDirection(trades.filter((trade) => trade.direction === TradeDirection.SHORT)),
  }
}

export function getTopTrades(trades: Trade[], limit = 5): Trade[] {
  return [...trades].sort((left, right) => right.pnl - left.pnl).slice(0, limit)
}

export interface TradeStreaks {
  consecutiveWins: number
  consecutiveLosses: number
  maxWinStreak: number
  maxLossStreak: number
}

/**
 * Computes ending and maximum win/loss streaks from closed trades.
 */
export function computeTradeStreaks(trades: Trade[]): TradeStreaks {
  const ordered = [...trades].sort((left, right) => left.exitTime - right.exitTime)

  let consecutiveWins = 0
  let consecutiveLosses = 0
  let maxWinStreak = 0
  let maxLossStreak = 0
  let currentWinStreak = 0
  let currentLossStreak = 0

  for (const trade of ordered) {
    if (trade.pnl > 0) {
      currentWinStreak += 1
      currentLossStreak = 0
      maxWinStreak = Math.max(maxWinStreak, currentWinStreak)
    } else if (trade.pnl < 0) {
      currentLossStreak += 1
      currentWinStreak = 0
      maxLossStreak = Math.max(maxLossStreak, currentLossStreak)
    } else {
      currentWinStreak = 0
      currentLossStreak = 0
    }
  }

  for (let index = ordered.length - 1; index >= 0; index--) {
    const trade = ordered[index]
    if (trade.pnl > 0) {
      if (consecutiveLosses > 0) break
      consecutiveWins += 1
    } else if (trade.pnl < 0) {
      if (consecutiveWins > 0) break
      consecutiveLosses += 1
    } else {
      break
    }
  }

  return {
    consecutiveWins,
    consecutiveLosses,
    maxWinStreak,
    maxLossStreak,
  }
}

/**
 * Proxy risk-reward from average win and average loss magnitudes.
 */
export function computeAverageRiskReward(averageWin: number, averageLoss: number): number {
  if (averageLoss === 0) {
    return averageWin > 0 ? Number.POSITIVE_INFINITY : 0
  }
  return averageWin / Math.abs(averageLoss)
}

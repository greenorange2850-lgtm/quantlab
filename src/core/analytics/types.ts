import type { EquityPoint } from '../backtest/BacktestResult.js'

export interface EnrichedEquityPoint extends EquityPoint {
  drawdown: number
}

export interface MonthlyReturn {
  month: string
  startEquity: number
  endEquity: number
  monthlyReturn: number
  cumulativeReturn: number
}

export interface MonthlyReturnsAnalysis {
  months: MonthlyReturn[]
  bestMonth: MonthlyReturn | null
  worstMonth: MonthlyReturn | null
}

export interface DirectionPerformance {
  trades: number
  netProfit: number
  winRate: number
}

export interface TradeAnalysis {
  averageWin: number
  averageLoss: number
  largestWinner: number
  largestLoser: number
  profitFactor: number
  expectancy: number
  averageHoldingTimeMs: number
  longPerformance: DirectionPerformance
  shortPerformance: DirectionPerformance
}

export interface DrawdownAnalysis {
  currentDrawdown: number
  maxDrawdown: number
  maxDrawdownDurationMs: number
  maxDrawdownRecoveryMs: number | null
}

import type { BacktestConfig } from '../backtest/BacktestConfig.js'
import type { BacktestStatistics } from '../backtest/BacktestResult.js'
import type { Trade } from '../backtest/Trade.js'

export interface BacktestReport {
  summary: {
    totalTrades: number
    winRate: number
    netProfit: number
    profitFactor: number
    expectancy: number
    averageWin: number
    averageLoss: number
    maxDrawdown: number
    largestWinner: number
    largestLoser: number
    finalBalance: number
  }
  equityCurve: EnrichedEquityPoint[]
  drawdown: DrawdownAnalysis
  monthlyReturns: MonthlyReturnsAnalysis
  tradeAnalysis: TradeAnalysis
  topTrades: Trade[]
  statistics: BacktestStatistics
  trades: Trade[]
  config: BacktestConfig
}

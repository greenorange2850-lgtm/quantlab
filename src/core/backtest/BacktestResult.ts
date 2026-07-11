import type { BacktestConfig } from './BacktestConfig.js'
import type { Trade } from './Trade.js'

export interface BacktestStatistics {
  totalTrades: number
  winningTrades: number
  losingTrades: number
  winRate: number
  netProfit: number
  grossProfit: number
  grossLoss: number
  maxDrawdown: number
  averageTrade: number
  finalBalance: number
}

export interface EquityPoint {
  time: number
  equity: number
  cash: number
}

export interface BacktestResult {
  trades: Trade[]
  equityCurve: EquityPoint[]
  statistics: BacktestStatistics
  config: BacktestConfig
}

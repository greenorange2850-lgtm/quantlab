import type { Trade } from './Trade.js'
import type { BacktestStatistics, EquityPoint } from './BacktestResult.js'

export function computeStatistics(
  trades: Trade[],
  equityCurve: EquityPoint[],
  initialCapital: number,
): BacktestStatistics {
  const totalTrades = trades.length
  const winningTrades = trades.filter((trade) => trade.pnl > 0).length
  const losingTrades = trades.filter((trade) => trade.pnl < 0).length
  const netProfit = trades.reduce((sum, trade) => sum + trade.pnl, 0)
  const grossProfit = trades.filter((trade) => trade.pnl > 0).reduce((sum, trade) => sum + trade.pnl, 0)
  const grossLoss = Math.abs(
    trades.filter((trade) => trade.pnl < 0).reduce((sum, trade) => sum + trade.pnl, 0),
  )
  const finalBalance = equityCurve.at(-1)?.equity ?? initialCapital
  const winRate = totalTrades > 0 ? winningTrades / totalTrades : 0
  const averageTrade = totalTrades > 0 ? netProfit / totalTrades : 0
  const maxDrawdown = computeMaxDrawdown(equityCurve)

  return {
    totalTrades,
    winningTrades,
    losingTrades,
    winRate,
    netProfit,
    grossProfit,
    grossLoss,
    maxDrawdown,
    averageTrade,
    finalBalance,
  }
}

export function computeMaxDrawdown(equityCurve: EquityPoint[]): number {
  if (equityCurve.length === 0) {
    return 0
  }

  let peak = equityCurve[0].equity
  let maxDrawdown = 0

  for (const point of equityCurve) {
    peak = Math.max(peak, point.equity)
    if (peak > 0) {
      const drawdown = (peak - point.equity) / peak
      maxDrawdown = Math.max(maxDrawdown, drawdown)
    }
  }

  return maxDrawdown
}

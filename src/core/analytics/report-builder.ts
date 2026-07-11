import type { BacktestResult } from '../backtest/BacktestResult.js'
import type { BacktestReport } from './types.js'
import { buildEquityCurve } from './equity-curve.js'
import { analyzeDrawdown } from './drawdown.js'
import { analyzeMonthlyReturns } from './monthly-returns.js'
import { analyzeTrades, getTopTrades } from './trade-analyzer.js'

export function buildBacktestReport(result: BacktestResult): BacktestReport {
  const equityCurve = buildEquityCurve(result.equityCurve)
  const drawdown = analyzeDrawdown(equityCurve)
  const monthlyReturns = analyzeMonthlyReturns(equityCurve, result.config.initialCapital)
  const tradeAnalysis = analyzeTrades(result.trades)
  const topTrades = getTopTrades(result.trades)

  return {
    summary: {
      totalTrades: result.statistics.totalTrades,
      winRate: result.statistics.winRate,
      netProfit: result.statistics.netProfit,
      profitFactor: tradeAnalysis.profitFactor,
      expectancy: tradeAnalysis.expectancy,
      averageWin: tradeAnalysis.averageWin,
      averageLoss: tradeAnalysis.averageLoss,
      maxDrawdown: drawdown.maxDrawdown,
      largestWinner: tradeAnalysis.largestWinner,
      largestLoser: tradeAnalysis.largestLoser,
      finalBalance: result.statistics.finalBalance,
    },
    equityCurve,
    drawdown,
    monthlyReturns,
    tradeAnalysis,
    topTrades,
    statistics: result.statistics,
    trades: result.trades,
    config: result.config,
  }
}

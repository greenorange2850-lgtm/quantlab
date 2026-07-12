export type {
  EnrichedEquityPoint,
  MonthlyReturn,
  MonthlyReturnsAnalysis,
  DirectionPerformance,
  TradeAnalysis,
  DrawdownAnalysis,
  BacktestReport,
} from './types.js'

export { buildEquityCurve, computeMaxDrawdownFromCurve } from './equity-curve.js'
export { analyzeDrawdown } from './drawdown.js'
export { analyzeMonthlyReturns } from './monthly-returns.js'
export { analyzeTrades, getTopTrades, computeTradeStreaks, computeAverageRiskReward } from './trade-analyzer.js'
export type { TradeStreaks } from './trade-analyzer.js'
export { buildBacktestReport } from './report-builder.js'
export {
  exportTradesCsv,
  exportEquityCsv,
  exportStatisticsCsv,
  exportReportStatisticsCsv,
} from './export-csv.js'
export { exportBacktestResultJson, exportBacktestReportJson } from './export-json.js'

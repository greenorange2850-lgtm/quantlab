export { TradeDirection, type Trade } from './Trade.js'
export type { Position } from './Position.js'
export { validateBacktestConfig, type BacktestConfig } from './BacktestConfig.js'
export type {
  BacktestResult,
  BacktestStatistics,
  EquityPoint,
} from './BacktestResult.js'
export {
  calculateCommission,
  calculateLongPnL,
  calculateShortPnL,
  calculateTradeDuration,
  calculatePositionQuantity,
  calculatePnL,
} from './trade-math.js'
export { computeStatistics, computeMaxDrawdown } from './statistics.js'
export { Portfolio } from './Portfolio.js'
export { BacktestEngine } from './BacktestEngine.js'
export { buildOrderRequestFromSignal } from './order-sizing.js'
export type { HistoricalLoadParams } from '../market/historical-feed.js'

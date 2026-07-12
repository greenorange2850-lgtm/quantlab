/**
 * Risk management configuration for position sizing and exposure limits.
 */
export interface RiskConfig {
  /** Percentage of account equity risked per trade (e.g. `1` = 1%). */
  riskPercent: number
  /** Maximum position size as a percentage of account equity. */
  maxPositionSize: number
  /** Maximum number of concurrently open positions. */
  maxOpenPositions: number
  /** Maximum daily loss as a percentage of account equity. */
  maxDailyLossPercent: number
  /** Maximum portfolio drawdown before trading halts. */
  maxDrawdownPercent: number
  /** Whether short positions are permitted. */
  allowShort: boolean
  /** Whether long positions are permitted. */
  allowLong: boolean
}

/**
 * Conservative default risk configuration suitable for initial deployment.
 */
export const defaultRiskConfig: RiskConfig = {
  riskPercent: 1,
  maxPositionSize: 100,
  maxOpenPositions: 1,
  maxDailyLossPercent: 5,
  maxDrawdownPercent: 20,
  allowShort: true,
  allowLong: true,
}

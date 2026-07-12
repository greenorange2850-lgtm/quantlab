/**
 * Input parameters for fixed-fractional position sizing.
 */
export interface PositionSizeInput {
  /** Total account equity used for risk calculation. */
  accountEquity: number
  /** Percentage of equity to risk on the trade (e.g. `1` = 1%). */
  riskPercent: number
  /** Planned entry price. */
  entryPrice: number
  /** Stop-loss price defining maximum adverse move. */
  stopLossPrice: number
  /**
   * Contract multiplier for derivatives (e.g. `100` for standard futures).
   * Defaults to `1` for spot instruments.
   */
  contractMultiplier?: number
  /**
   * Dollar value per minimum price increment.
   * Defaults to `1`; used by broker adapters for non-spot asset classes.
   */
  tickValue?: number
}

/**
 * Result of a position size calculation.
 */
export interface PositionSizeResult {
  /** Position size in base asset units. */
  quantity: number
  /** Dollar amount at risk if stop is hit. */
  riskAmount: number
  /** Absolute distance between entry and stop-loss. */
  stopDistance: number
  /** Notional position value at entry (`quantity × entryPrice`). */
  positionValue: number
  /** Realized risk as a percentage of account equity. */
  effectiveRiskPercent: number
}

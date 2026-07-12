import type { MarkedPosition } from './portfolio.js'

/**
 * Account model used by the portfolio engine for buying-power rules.
 */
export const PortfolioAccountType = {
  CASH: 'CASH',
  MARGIN: 'MARGIN',
} as const

export type PortfolioAccountType =
  (typeof PortfolioAccountType)[keyof typeof PortfolioAccountType]

export interface BuyingPowerInput {
  cash: number
  equity: number
  marginUsed: number
  accountType: PortfolioAccountType
  marginMultiplier?: number
}

/**
 * Calculates available buying power for cash and margin accounts.
 */
export function calculateBuyingPower(input: BuyingPowerInput): number {
  if (!Number.isFinite(input.cash) || !Number.isFinite(input.equity)) {
    throw new Error('cash and equity must be finite numbers')
  }

  if (input.accountType === PortfolioAccountType.CASH) {
    return Math.max(0, input.cash)
  }

  const multiplier = input.marginMultiplier ?? 2
  return Math.max(0, input.equity * multiplier - input.marginUsed)
}

/**
 * Simplified margin utilization from gross market value of open positions.
 */
export function calculateMarginUsed(positions: readonly MarkedPosition[]): number {
  return positions.reduce((total, position) => {
    return total + Math.abs(position.quantity * position.markPrice)
  }, 0)
}

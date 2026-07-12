import { PositionSide, type PositionSide as PositionSideValue } from '../models/position.js'
import {
  calculateBuyingPower,
  calculateMarginUsed,
  PortfolioAccountType,
  type PortfolioAccountType as PortfolioAccountTypeValue,
} from './account.js'
import { calculateAllocation } from './allocation.js'
import { calculateExposure } from './exposure.js'
import { calculatePortfolioPnL } from './performance.js'

export interface MarkedPosition {
  symbol: string
  quantity: number
  side: PositionSideValue
  entryPrice: number
  markPrice: number
  realizedPnL?: number
}

export interface PortfolioInput {
  cash: number
  positions: readonly MarkedPosition[]
  accountType?: PortfolioAccountTypeValue
  marginMultiplier?: number
}

export interface PositionSummary {
  symbol: string
  quantity: number
  marketValue: number
  costBasis: number
  unrealizedPnL: number
  realizedPnL: number
  weight: number
}

export interface Portfolio {
  cash: number
  equity: number
  buyingPower: number
  positions: PositionSummary[]
  realizedPnL: number
  unrealizedPnL: number
  totalExposure: number
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Mark-to-market portfolio equity from cash and open positions.
 */
export function calculatePortfolioValue(input: PortfolioInput): number {
  if (!Number.isFinite(input.cash)) {
    throw new Error('cash must be a finite number')
  }

  let equity = input.cash

  for (const position of input.positions) {
    if (position.quantity < 0) {
      throw new Error('position quantity must be non-negative')
    }

    const marketValue = position.quantity * position.markPrice

    if (position.side === PositionSide.LONG) {
      equity += marketValue
      continue
    }

    equity -= marketValue
  }

  return roundCurrency(equity)
}

/**
 * Composes a full portfolio snapshot from balances and marked positions.
 */
export function buildPortfolio(input: PortfolioInput): Portfolio {
  const equity = calculatePortfolioValue(input)
  const { realizedPnL, unrealizedPnL } = calculatePortfolioPnL(input.positions)
  const totalExposure = calculateExposure(input.positions)
  const marginUsed = calculateMarginUsed(input.positions)
  const accountType = input.accountType ?? PortfolioAccountType.CASH
  const buyingPower = calculateBuyingPower({
    cash: input.cash,
    equity,
    marginUsed,
    accountType,
    marginMultiplier: input.marginMultiplier,
  })

  return {
    cash: roundCurrency(input.cash),
    equity,
    buyingPower: roundCurrency(buyingPower),
    positions: calculateAllocation(input.positions, equity),
    realizedPnL,
    unrealizedPnL,
    totalExposure: roundCurrency(totalExposure),
  }
}

export interface BacktestPortfolioSnapshotInput {
  cash: number
  equity: number
  realizedPnL: number
  positions?: readonly MarkedPosition[]
  accountType?: PortfolioAccountTypeValue
}

/**
 * Builds a portfolio snapshot from backtest balances and optional open positions.
 * Uses equity-curve cash as the source of truth and layers open positions when provided.
 */
export function buildPortfolioFromBacktestBalances(
  input: BacktestPortfolioSnapshotInput,
): Portfolio {
  const portfolio = buildPortfolio({
    cash: input.cash,
    positions: input.positions ?? [],
    accountType: input.accountType,
  })

  const closedBookPortfolio: Portfolio = {
    ...portfolio,
    equity: roundCurrency(input.equity),
    realizedPnL: roundCurrency(input.realizedPnL),
    unrealizedPnL:
      input.positions && input.positions.length > 0
        ? portfolio.unrealizedPnL
        : roundCurrency(input.equity - input.cash),
    positions:
      input.positions && input.positions.length > 0
        ? calculateAllocation(input.positions, input.equity)
        : [],
    totalExposure:
      input.positions && input.positions.length > 0
        ? portfolio.totalExposure
        : 0,
    buyingPower: roundCurrency(
      calculateBuyingPower({
        cash: input.cash,
        equity: input.equity,
        marginUsed: calculateMarginUsed(input.positions ?? []),
        accountType: input.accountType ?? PortfolioAccountType.CASH,
      }),
    ),
  }

  return closedBookPortfolio
}

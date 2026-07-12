import type { MarkedPosition } from './portfolio.js'
import { PositionSide } from '../models/position.js'

export interface PortfolioPnL {
  realizedPnL: number
  unrealizedPnL: number
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Unrealized PnL for a single marked position.
 */
export function calculatePositionUnrealizedPnL(position: MarkedPosition): number {
  if (position.quantity < 0) {
    throw new Error('quantity must be non-negative')
  }

  if (position.side === PositionSide.LONG) {
    return (position.markPrice - position.entryPrice) * position.quantity
  }

  return (position.entryPrice - position.markPrice) * position.quantity
}

/**
 * Aggregates realized and unrealized PnL across all positions.
 */
export function calculatePortfolioPnL(positions: readonly MarkedPosition[]): PortfolioPnL {
  let realizedPnL = 0
  let unrealizedPnL = 0

  for (const position of positions) {
    realizedPnL += position.realizedPnL ?? 0
    unrealizedPnL += calculatePositionUnrealizedPnL(position)
  }

  return {
    realizedPnL: roundCurrency(realizedPnL),
    unrealizedPnL: roundCurrency(unrealizedPnL),
  }
}

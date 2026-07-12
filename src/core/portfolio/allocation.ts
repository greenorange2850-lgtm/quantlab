import type { MarkedPosition, PositionSummary } from './portfolio.js'
import { calculatePositionUnrealizedPnL } from './performance.js'

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100
}

function roundWeight(value: number): number {
  return Math.round(value * 1000) / 1000
}

/**
 * Builds position summaries with portfolio weights.
 */
export function calculateAllocation(
  positions: readonly MarkedPosition[],
  equity: number,
): PositionSummary[] {
  const equityMagnitude = Math.abs(equity)

  return positions.map((position) => {
    const marketValue = Math.abs(position.quantity * position.markPrice)
    const costBasis = Math.abs(position.quantity * position.entryPrice)
    const unrealizedPnL = calculatePositionUnrealizedPnL(position)
    const realizedPnL = position.realizedPnL ?? 0
    const weight =
      equityMagnitude > 0 ? roundWeight((marketValue / equityMagnitude) * 100) : 0

    return {
      symbol: position.symbol,
      quantity: position.quantity,
      marketValue: roundCurrency(marketValue),
      costBasis: roundCurrency(costBasis),
      unrealizedPnL: roundCurrency(unrealizedPnL),
      realizedPnL: roundCurrency(realizedPnL),
      weight,
    }
  })
}

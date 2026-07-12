import type { MarkedPosition } from './portfolio.js'

/**
 * Gross portfolio exposure as the sum of absolute position market values.
 */
export function calculateExposure(positions: readonly MarkedPosition[]): number {
  return positions.reduce((total, position) => {
    return total + Math.abs(position.quantity * position.markPrice)
  }, 0)
}

/**
 * Net directional exposure per symbol (positive = net long, negative = net short).
 */
export function calculateNetExposureBySymbol(
  positions: readonly MarkedPosition[],
): ReadonlyMap<string, number> {
  const exposureBySymbol = new Map<string, number>()

  for (const position of positions) {
    const signedValue =
      position.side === 'LONG'
        ? position.quantity * position.markPrice
        : -position.quantity * position.markPrice
    exposureBySymbol.set(
      position.symbol,
      (exposureBySymbol.get(position.symbol) ?? 0) + signedValue,
    )
  }

  return exposureBySymbol
}

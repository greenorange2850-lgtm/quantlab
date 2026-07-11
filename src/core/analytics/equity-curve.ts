import type { EquityPoint } from '../backtest/BacktestResult.js'
import type { EnrichedEquityPoint } from './types.js'

export function buildEquityCurve(points: EquityPoint[]): EnrichedEquityPoint[] {
  if (points.length === 0) {
    return []
  }

  let peak = points[0].equity

  return points.map((point) => {
    peak = Math.max(peak, point.equity)
    const drawdown = peak > 0 ? (peak - point.equity) / peak : 0

    return {
      time: point.time,
      equity: point.equity,
      cash: point.cash,
      drawdown,
    }
  })
}

export function computeMaxDrawdownFromCurve(curve: EnrichedEquityPoint[]): number {
  if (curve.length === 0) {
    return 0
  }

  return curve.reduce((max, point) => Math.max(max, point.drawdown), 0)
}

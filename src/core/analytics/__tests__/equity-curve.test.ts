import { describe, expect, it } from 'vitest'
import { buildEquityCurve, computeMaxDrawdownFromCurve } from '../equity-curve.js'
import type { EquityPoint } from '../../backtest/BacktestResult.js'

const baseCurve: EquityPoint[] = [
  { time: 1, equity: 10_000, cash: 10_000 },
  { time: 2, equity: 11_000, cash: 10_500 },
  { time: 3, equity: 9_900, cash: 9_900 },
  { time: 4, equity: 10_500, cash: 10_200 },
]

describe('equity-curve', () => {
  it('enriches equity points with drawdown', () => {
    const curve = buildEquityCurve(baseCurve)

    expect(curve[0].drawdown).toBe(0)
    expect(curve[1].drawdown).toBe(0)
    expect(curve[2].drawdown).toBeCloseTo(0.1, 5)
    expect(curve[3].drawdown).toBeCloseTo(0.0455, 4)
    expect(curve[2].cash).toBe(9_900)
  })

  it('returns max drawdown from enriched curve', () => {
    const curve = buildEquityCurve(baseCurve)
    expect(computeMaxDrawdownFromCurve(curve)).toBeCloseTo(0.1, 5)
  })

  it('returns empty curve for empty input', () => {
    expect(buildEquityCurve([])).toEqual([])
  })
})

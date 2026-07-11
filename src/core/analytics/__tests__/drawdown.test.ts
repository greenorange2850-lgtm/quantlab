import { describe, expect, it } from 'vitest'
import { buildEquityCurve } from '../equity-curve.js'
import { analyzeDrawdown } from '../drawdown.js'
import type { EquityPoint } from '../../backtest/BacktestResult.js'

describe('drawdown', () => {
  it('analyzes current and maximum drawdown', () => {
    const points: EquityPoint[] = [
      { time: 1_000, equity: 10_000, cash: 10_000 },
      { time: 2_000, equity: 12_000, cash: 12_000 },
      { time: 3_000, equity: 9_000, cash: 9_000 },
      { time: 4_000, equity: 12_000, cash: 12_000 },
    ]

    const analysis = analyzeDrawdown(buildEquityCurve(points))

    expect(analysis.maxDrawdown).toBeCloseTo(0.25, 5)
    expect(analysis.currentDrawdown).toBe(0)
    expect(analysis.maxDrawdownDurationMs).toBe(2_000)
    expect(analysis.maxDrawdownRecoveryMs).toBe(1_000)
  })

  it('handles unrecovered drawdown at end of curve', () => {
    const points: EquityPoint[] = [
      { time: 1_000, equity: 10_000, cash: 10_000 },
      { time: 2_000, equity: 12_000, cash: 12_000 },
      { time: 3_000, equity: 9_000, cash: 9_000 },
    ]

    const analysis = analyzeDrawdown(buildEquityCurve(points))

    expect(analysis.maxDrawdownRecoveryMs).toBeNull()
    expect(analysis.maxDrawdownDurationMs).toBe(1_000)
  })

  it('returns zeros for empty curve', () => {
    expect(analyzeDrawdown([])).toEqual({
      currentDrawdown: 0,
      maxDrawdown: 0,
      maxDrawdownDurationMs: 0,
      maxDrawdownRecoveryMs: null,
    })
  })
})

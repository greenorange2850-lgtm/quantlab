import { describe, expect, it } from 'vitest'
import { buildEquityCurve } from '../equity-curve.js'
import { analyzeMonthlyReturns } from '../monthly-returns.js'
import type { EquityPoint } from '../../backtest/BacktestResult.js'

describe('monthly-returns', () => {
  it('groups equity curve into monthly returns', () => {
    const points: EquityPoint[] = [
      { time: Date.parse('2024-01-10T00:00:00Z'), equity: 10_000, cash: 10_000 },
      { time: Date.parse('2024-01-20T00:00:00Z'), equity: 10_500, cash: 10_500 },
      { time: Date.parse('2024-02-05T00:00:00Z'), equity: 10_200, cash: 10_200 },
      { time: Date.parse('2024-02-25T00:00:00Z'), equity: 10_800, cash: 10_800 },
    ]

    const analysis = analyzeMonthlyReturns(buildEquityCurve(points), 10_000)

    expect(analysis.months).toHaveLength(2)
    expect(analysis.months[0].month).toBe('2024-01')
    expect(analysis.months[0].monthlyReturn).toBeCloseTo(0.05, 5)
    expect(analysis.months[1].month).toBe('2024-02')
    expect(analysis.bestMonth?.month).toBe('2024-02')
    expect(analysis.worstMonth?.month).toBe('2024-01')
  })

  it('returns empty analysis for empty curve', () => {
    const analysis = analyzeMonthlyReturns([], 10_000)
    expect(analysis.months).toEqual([])
    expect(analysis.bestMonth).toBeNull()
    expect(analysis.worstMonth).toBeNull()
  })
})

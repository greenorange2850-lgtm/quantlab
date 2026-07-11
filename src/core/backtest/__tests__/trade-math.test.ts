import { describe, expect, it } from 'vitest'
import {
  calculateCommission,
  calculateLongPnL,
  calculatePositionQuantity,
  calculateShortPnL,
  calculateTradeDuration,
} from '../trade-math.js'

describe('trade-math', () => {
  it('calculates commission from notional', () => {
    expect(calculateCommission(10_000, 0.1)).toBe(10)
  })

  it('calculates LONG pnl after commissions', () => {
    const pnl = calculateLongPnL(100, 110, 10, 1, 1.1)
    expect(pnl).toBeCloseTo(97.9, 5)
  })

  it('calculates SHORT pnl after commissions', () => {
    const pnl = calculateShortPnL(100, 90, 10, 1, 0.9)
    expect(pnl).toBeCloseTo(98.1, 5)
  })

  it('calculates trade duration', () => {
    expect(calculateTradeDuration(1_000, 4_600)).toBe(3_600)
  })

  it('calculates position quantity from equity and sizing percent', () => {
    expect(calculatePositionQuantity(10_000, 100, 50)).toBe(50)
  })
})

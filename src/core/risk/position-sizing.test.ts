import { describe, expect, it } from 'vitest'
import { calculatePositionSize } from './position-sizing.js'

describe('calculatePositionSize', () => {
  it('sizes a long position from equity risk and stop distance', () => {
    const result = calculatePositionSize({
      accountEquity: 10_000,
      riskPercent: 1,
      entryPrice: 100,
      stopLossPrice: 95,
    })

    expect(result.riskAmount).toBe(100)
    expect(result.stopDistance).toBe(5)
    expect(result.quantity).toBe(20)
    expect(result.positionValue).toBe(2_000)
    expect(result.effectiveRiskPercent).toBe(1)
  })

  it('sizes a short position using absolute stop distance', () => {
    const result = calculatePositionSize({
      accountEquity: 20_000,
      riskPercent: 2,
      entryPrice: 100,
      stopLossPrice: 110,
    })

    expect(result.riskAmount).toBe(400)
    expect(result.stopDistance).toBe(10)
    expect(result.quantity).toBe(40)
  })

  it('returns zero quantity when risk percent is zero', () => {
    const result = calculatePositionSize({
      accountEquity: 10_000,
      riskPercent: 0,
      entryPrice: 50,
      stopLossPrice: 45,
    })

    expect(result.riskAmount).toBe(0)
    expect(result.quantity).toBe(0)
  })

  it('throws when account equity is zero', () => {
    expect(() =>
      calculatePositionSize({
        accountEquity: 0,
        riskPercent: 1,
        entryPrice: 100,
        stopLossPrice: 95,
      }),
    ).toThrow('accountEquity must be greater than 0')
  })

  it('throws when account equity is negative', () => {
    expect(() =>
      calculatePositionSize({
        accountEquity: -1_000,
        riskPercent: 1,
        entryPrice: 100,
        stopLossPrice: 95,
      }),
    ).toThrow('accountEquity must be greater than 0')
  })

  it('throws when entry price is invalid', () => {
    expect(() =>
      calculatePositionSize({
        accountEquity: 10_000,
        riskPercent: 1,
        entryPrice: 0,
        stopLossPrice: 95,
      }),
    ).toThrow('entryPrice and stopLossPrice must be greater than 0')
  })

  it('throws when stop-loss price is invalid', () => {
    expect(() =>
      calculatePositionSize({
        accountEquity: 10_000,
        riskPercent: 1,
        entryPrice: 100,
        stopLossPrice: -5,
      }),
    ).toThrow('entryPrice and stopLossPrice must be greater than 0')
  })

  it('throws when stop-loss equals entry price', () => {
    expect(() =>
      calculatePositionSize({
        accountEquity: 10_000,
        riskPercent: 1,
        entryPrice: 100,
        stopLossPrice: 100,
      }),
    ).toThrow('stopLossPrice must not equal entryPrice')
  })

  it('throws when risk percent is negative', () => {
    expect(() =>
      calculatePositionSize({
        accountEquity: 10_000,
        riskPercent: -1,
        entryPrice: 100,
        stopLossPrice: 95,
      }),
    ).toThrow('riskPercent cannot be negative')
  })

  it('handles fractional prices and small stop distances', () => {
    const result = calculatePositionSize({
      accountEquity: 5_000,
      riskPercent: 0.5,
      entryPrice: 64_325.23,
      stopLossPrice: 64_100.5,
    })

    expect(result.stopDistance).toBeCloseTo(224.73, 2)
    expect(result.riskAmount).toBe(25)
    expect(result.quantity).toBeCloseTo(0.1112, 4)
    expect(result.positionValue).toBeCloseTo(result.quantity * 64_325.23, 2)
    expect(result.effectiveRiskPercent).toBe(0.5)
  })

  it('throws when account equity is NaN', () => {
    expect(() =>
      calculatePositionSize({
        accountEquity: Number.NaN,
        riskPercent: 1,
        entryPrice: 100,
        stopLossPrice: 95,
      }),
    ).toThrow('accountEquity must be a finite number')
  })

  it('throws when entry price is Infinity', () => {
    expect(() =>
      calculatePositionSize({
        accountEquity: 10_000,
        riskPercent: 1,
        entryPrice: Number.POSITIVE_INFINITY,
        stopLossPrice: 95,
      }),
    ).toThrow('entryPrice must be a finite number')
  })

  it('handles very small prices without rounding', () => {
    const result = calculatePositionSize({
      accountEquity: 10_000,
      riskPercent: 1,
      entryPrice: 0.0001,
      stopLossPrice: 0.00009,
    })

    expect(result.stopDistance).toBeCloseTo(0.00001, 10)
    expect(result.quantity).toBe(10_000_000)
    expect(result.positionValue).toBe(1_000)
    expect(result.effectiveRiskPercent).toBe(1)
  })

  it('handles very large equity without rounding', () => {
    const result = calculatePositionSize({
      accountEquity: 1_000_000_000,
      riskPercent: 0.5,
      entryPrice: 50_000,
      stopLossPrice: 49_000,
    })

    expect(result.riskAmount).toBe(5_000_000)
    expect(result.quantity).toBe(5_000)
    expect(result.positionValue).toBe(250_000_000)
    expect(result.effectiveRiskPercent).toBe(0.5)
  })

  it('handles tiny risk percent without rounding', () => {
    const result = calculatePositionSize({
      accountEquity: 100_000,
      riskPercent: 0.0001,
      entryPrice: 200,
      stopLossPrice: 198,
    })

    expect(result.riskAmount).toBe(0.1)
    expect(result.quantity).toBe(0.05)
    expect(result.effectiveRiskPercent).toBeCloseTo(0.0001, 10)
  })

  it('uses default multipliers when optional fields are omitted', () => {
    const withoutOptional = calculatePositionSize({
      accountEquity: 10_000,
      riskPercent: 1,
      entryPrice: 100,
      stopLossPrice: 95,
    })

    const withDefaults = calculatePositionSize({
      accountEquity: 10_000,
      riskPercent: 1,
      entryPrice: 100,
      stopLossPrice: 95,
      contractMultiplier: 1,
      tickValue: 1,
    })

    expect(withDefaults.quantity).toBe(withoutOptional.quantity)
  })

  it('scales quantity by contract multiplier when provided', () => {
    const result = calculatePositionSize({
      accountEquity: 10_000,
      riskPercent: 1,
      entryPrice: 100,
      stopLossPrice: 95,
      contractMultiplier: 100,
    })

    expect(result.quantity).toBe(0.2)
    expect(result.riskAmount).toBe(100)
  })
})

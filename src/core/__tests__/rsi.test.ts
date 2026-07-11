import { describe, expect, it } from 'vitest'
import { calculateRSI } from '../indicators/rsi.js'

describe('calculateRSI', () => {
  it('defaults period to 14', () => {
    const values = Array.from({ length: 16 }, (_, i) => i + 1)
    const explicit = calculateRSI(values, 14)
    const defaulted = calculateRSI(values)

    expect(defaulted).toEqual(explicit)
  })

  it('returns high RSI for a sustained increasing trend', () => {
    const values = Array.from({ length: 20 }, (_, i) => i + 1)
    const result = calculateRSI(values, 5)

    expect(result[5]).toBeGreaterThan(90)
    expect(result[19]).toBeGreaterThan(90)
  })

  it('returns low RSI for a sustained decreasing trend', () => {
    const values = Array.from({ length: 20 }, (_, i) => 20 - i)
    const result = calculateRSI(values, 5)

    expect(result[5]).toBeLessThan(10)
    expect(result[19]).toBeLessThan(10)
  })

  it('returns neutral RSI for flat prices', () => {
    const values = Array.from({ length: 20 }, () => 100)
    const result = calculateRSI(values, 5)

    expect(result[5]).toBe(50)
    expect(result[19]).toBe(50)
  })

  it('returns same-length array with leading NaN values', () => {
    const values = [44, 44.34, 44.09, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08]
    const result = calculateRSI(values, 5)

    expect(result).toHaveLength(values.length)
    expect(result.slice(0, 5).every(Number.isNaN)).toBe(true)
    expect(result[5]).not.toBeNaN()
  })

  it('computes RSI with a short period', () => {
    const result = calculateRSI([1, 2, 3, 4, 5, 6], 3)

    expect(result[3]).toBeCloseTo(100, 5)
    expect(result[5]).toBeCloseTo(100, 5)
  })

  it('throws when period is 0', () => {
    expect(() => calculateRSI([1, 2, 3], 0)).toThrow('period must be greater than 0')
  })

  it('throws when period is negative', () => {
    expect(() => calculateRSI([1, 2, 3], -1)).toThrow('period must be greater than 0')
  })

  it('throws when period exceeds values length', () => {
    expect(() => calculateRSI([1, 2, 3], 4)).toThrow('period cannot exceed values length')
  })

  it('returns all NaN when values length equals period', () => {
    const result = calculateRSI([1, 2, 3, 4, 5], 5)

    expect(result).toHaveLength(5)
    expect(result.every(Number.isNaN)).toBe(true)
  })
})

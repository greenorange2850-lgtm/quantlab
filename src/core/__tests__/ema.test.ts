import { describe, expect, it } from 'vitest'
import { calculateEMA } from '../indicators/ema.js'

describe('calculateEMA', () => {
  it('computes EMA with period 3 using SMA seed', () => {
    const result = calculateEMA([1, 2, 3, 4, 5], 3)

    expect(result).toHaveLength(5)
    expect(result[0]).toBeNaN()
    expect(result[1]).toBeNaN()
    expect(result[2]).toBe(2)
    expect(result[3]).toBe(3)
    expect(result[4]).toBe(4)
  })

  it('returns input unchanged when period is 1', () => {
    const input = [1, 2, 3, 4, 5]
    expect(calculateEMA(input, 1)).toEqual(input)
  })

  it('returns same-length array with leading NaN values', () => {
    const input = [10, 20, 30, 40, 50, 60]
    const result = calculateEMA(input, 4)

    expect(result).toHaveLength(input.length)
    expect(result.slice(0, 3).every(Number.isNaN)).toBe(true)
    expect(result[3]).not.toBeNaN()
  })

  it('computes EMA when period equals values length', () => {
    const input = [2, 4, 6, 8]
    const result = calculateEMA(input, input.length)

    expect(result).toHaveLength(input.length)
    expect(result.slice(0, input.length - 1).every(Number.isNaN)).toBe(true)
    expect(result[input.length - 1]).toBe(5)
  })

  it('throws when period is 0', () => {
    expect(() => calculateEMA([1, 2, 3], 0)).toThrow('period must be greater than 0')
  })

  it('throws when period is negative', () => {
    expect(() => calculateEMA([1, 2, 3], -1)).toThrow('period must be greater than 0')
  })

  it('throws when period exceeds values length', () => {
    expect(() => calculateEMA([1, 2, 3], 4)).toThrow('period cannot exceed values length')
  })

  it('throws when input is empty and period is positive', () => {
    expect(() => calculateEMA([], 1)).toThrow('period cannot exceed values length')
  })
})

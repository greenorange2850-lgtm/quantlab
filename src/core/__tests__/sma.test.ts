import { describe, expect, it } from 'vitest'
import { calculateSMA } from '../indicators/sma.js'

describe('calculateSMA', () => {
  it('computes SMA with period 3', () => {
    const result = calculateSMA([1, 2, 3, 4, 5], 3)

    expect(result).toHaveLength(5)
    expect(result[0]).toBeNaN()
    expect(result[1]).toBeNaN()
    expect(result.slice(2)).toEqual([2, 3, 4])
  })

  it('returns input unchanged when period is 1', () => {
    const input = [1, 2, 3, 4, 5]
    expect(calculateSMA(input, 1)).toEqual(input)
  })

  it('computes SMA when period equals values length', () => {
    const input = [1, 2, 3, 4, 5]
    const result = calculateSMA(input, input.length)

    expect(result).toHaveLength(input.length)
    expect(result[0]).toBeNaN()
    expect(result[1]).toBeNaN()
    expect(result[2]).toBeNaN()
    expect(result[3]).toBeNaN()
    expect(result[4]).toBe(3)
  })

  it('throws when period is 0', () => {
    expect(() => calculateSMA([1, 2, 3], 0)).toThrow('period must be greater than 0')
  })

  it('throws when period is negative', () => {
    expect(() => calculateSMA([1, 2, 3], -1)).toThrow('period must be greater than 0')
  })

  it('throws when period exceeds values length', () => {
    expect(() => calculateSMA([1, 2, 3], 4)).toThrow('period cannot exceed values length')
  })

  it('throws when input is empty and period is positive', () => {
    expect(() => calculateSMA([], 1)).toThrow('period cannot exceed values length')
  })
})

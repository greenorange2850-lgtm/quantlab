import { describe, expect, it } from 'vitest'
import {
  sampleStrategyParams,
  validateParameterRanges,
  validateRandomSearchConfig,
} from '../sampling.js'
import { DEFAULT_MA_CROSS_RANGES } from '../index.js'

describe('validateParameterRanges', () => {
  it('rejects empty ranges', () => {
    const issues = validateParameterRanges([])
    expect(issues).toHaveLength(1)
    expect(issues[0]?.field).toBe('parameterRanges')
  })

  it('rejects max < min and non-positive step', () => {
    const issues = validateParameterRanges([
      { name: 'fastPeriod', min: 30, max: 10, step: 0 },
    ])
    expect(issues.some((issue) => issue.message.includes('step must be > 0'))).toBe(true)
    expect(issues.some((issue) => issue.message.includes('max must be'))).toBe(true)
  })

  it('accepts default MA cross ranges', () => {
    expect(validateParameterRanges(DEFAULT_MA_CROSS_RANGES)).toEqual([])
  })
})

describe('validateRandomSearchConfig', () => {
  it('rejects invalid iteration counts', () => {
    expect(
      validateRandomSearchConfig({ iterations: 0, parameterRanges: DEFAULT_MA_CROSS_RANGES }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'iterations' }),
      ]),
    )
    expect(
      validateRandomSearchConfig({ iterations: 501, parameterRanges: DEFAULT_MA_CROSS_RANGES }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'iterations' }),
      ]),
    )
  })

  it('accepts a valid configuration', () => {
    expect(
      validateRandomSearchConfig({ iterations: 20, parameterRanges: DEFAULT_MA_CROSS_RANGES }),
    ).toEqual([])
  })
})

describe('sampleStrategyParams', () => {
  it('samples within ranges and keeps fast < slow', () => {
    for (let seed = 0; seed < 40; seed++) {
      const params = sampleStrategyParams(DEFAULT_MA_CROSS_RANGES, seed)
      expect(params.fastPeriod).toBeGreaterThanOrEqual(5)
      expect(params.fastPeriod).toBeLessThanOrEqual(30)
      expect(params.slowPeriod).toBeGreaterThanOrEqual(20)
      expect(params.slowPeriod).toBeLessThanOrEqual(100)
      expect(params.rsiPeriod).toBeGreaterThanOrEqual(7)
      expect(params.rsiPeriod).toBeLessThanOrEqual(21)
      expect(params.fastPeriod).toBeLessThan(params.slowPeriod)
    }
  })

  it('is deterministic for a fixed seed', () => {
    expect(sampleStrategyParams(DEFAULT_MA_CROSS_RANGES, 42)).toEqual(
      sampleStrategyParams(DEFAULT_MA_CROSS_RANGES, 42),
    )
  })
})

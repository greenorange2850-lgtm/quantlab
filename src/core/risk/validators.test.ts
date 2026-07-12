import { describe, expect, it } from 'vitest'
import { defaultRiskConfig } from './config.js'
import { validateRiskConfig } from './validators.js'

describe('validateRiskConfig', () => {
  it('accepts the default risk configuration', () => {
    expect(() => validateRiskConfig(defaultRiskConfig)).not.toThrow()
  })

  it('accepts valid custom configuration', () => {
    expect(() =>
      validateRiskConfig({
        riskPercent: 2.5,
        maxPositionSize: 50,
        maxOpenPositions: 3,
        maxDailyLossPercent: 10,
        maxDrawdownPercent: 15,
        allowShort: false,
        allowLong: true,
      }),
    ).not.toThrow()
  })

  it('throws when riskPercent is zero', () => {
    expect(() =>
      validateRiskConfig({ ...defaultRiskConfig, riskPercent: 0 }),
    ).toThrow('riskPercent must be greater than 0')
  })

  it('throws when riskPercent exceeds 100', () => {
    expect(() =>
      validateRiskConfig({ ...defaultRiskConfig, riskPercent: 101 }),
    ).toThrow('riskPercent must be less than or equal to 100')
  })

  it('throws when maxPositionSize is not positive', () => {
    expect(() =>
      validateRiskConfig({ ...defaultRiskConfig, maxPositionSize: 0 }),
    ).toThrow('maxPositionSize must be greater than 0')
  })

  it('throws when maxOpenPositions is less than 1', () => {
    expect(() =>
      validateRiskConfig({ ...defaultRiskConfig, maxOpenPositions: 0 }),
    ).toThrow('maxOpenPositions must be greater than or equal to 1')
  })

  it('throws when maxDailyLossPercent is negative', () => {
    expect(() =>
      validateRiskConfig({ ...defaultRiskConfig, maxDailyLossPercent: -1 }),
    ).toThrow('maxDailyLossPercent cannot be negative')
  })

  it('throws when maxDrawdownPercent is negative', () => {
    expect(() =>
      validateRiskConfig({ ...defaultRiskConfig, maxDrawdownPercent: -0.1 }),
    ).toThrow('maxDrawdownPercent cannot be negative')
  })

  it('throws when a numeric field is NaN', () => {
    expect(() =>
      validateRiskConfig({ ...defaultRiskConfig, riskPercent: Number.NaN }),
    ).toThrow('riskPercent must be a finite number')
  })

  it('throws when a numeric field is Infinity', () => {
    expect(() =>
      validateRiskConfig({ ...defaultRiskConfig, maxPositionSize: Number.POSITIVE_INFINITY }),
    ).toThrow('maxPositionSize must be a finite number')
  })
})

describe('defaultRiskConfig', () => {
  it('enables both long and short trading by default', () => {
    expect(defaultRiskConfig.allowLong).toBe(true)
    expect(defaultRiskConfig.allowShort).toBe(true)
  })
})

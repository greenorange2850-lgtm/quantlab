import { describe, expect, it } from 'vitest'
import {
  drawdownQuality,
  expectancyQuality,
  profitFactorQuality,
  qualityToTone,
  recoveryFactorQuality,
  researchScoreQuality,
} from '../metric-semantics'
import {
  formatCurrency,
  formatCurrencyAbsolute,
  formatNumber,
  formatPercent,
  formatPercentUnsigned,
  formatRatio,
} from '../utils'

describe('metric-semantics', () => {
  it('classifies profit factor quality', () => {
    expect(profitFactorQuality(1.8)).toBe('excellent')
    expect(profitFactorQuality(1.1)).toBe('average')
    expect(profitFactorQuality(0.7)).toBe('poor')
    expect(qualityToTone(profitFactorQuality(1.8))).toBe('positive')
    expect(qualityToTone(profitFactorQuality(1.1))).toBe('warning')
    expect(qualityToTone(profitFactorQuality(0.7))).toBe('negative')
  })

  it('classifies drawdown from fraction or percent', () => {
    expect(drawdownQuality(0.05)).toBe('excellent')
    expect(drawdownQuality(0.15)).toBe('average')
    expect(drawdownQuality(0.35)).toBe('poor')
    expect(drawdownQuality(-12)).toBe('average')
  })

  it('classifies expectancy, recovery, and research score', () => {
    expect(expectancyQuality(2)).toBe('excellent')
    expect(expectancyQuality(0)).toBe('average')
    expect(expectancyQuality(-1)).toBe('poor')
    expect(recoveryFactorQuality(2.5)).toBe('excellent')
    expect(recoveryFactorQuality(1.2)).toBe('average')
    expect(recoveryFactorQuality(0.4)).toBe('poor')
    expect(researchScoreQuality(80)).toBe('excellent')
    expect(researchScoreQuality(44)).toBe('average')
    expect(researchScoreQuality(20)).toBe('poor')
  })
})

describe('number formatting', () => {
  it('formats currency with two decimals', () => {
    expect(formatCurrency(1234.5)).toBe('+$1,234.50')
    expect(formatCurrency(-1234.5)).toBe('-$1,234.50')
    expect(formatCurrencyAbsolute(1234.5)).toBe('$1,234.50')
    expect(formatCurrencyAbsolute(-50)).toBe('-$50.00')
  })

  it('formats percents and ratios with two decimals by default', () => {
    expect(formatPercent(12.345)).toBe('+12.35%')
    expect(formatPercent(-8.1)).toBe('-8.10%')
    expect(formatPercentUnsigned(55.1)).toBe('55.10%')
    expect(formatRatio(1.23456)).toBe('1.23')
    expect(formatNumber(1000.5)).toBe('1,000.50')
  })
})

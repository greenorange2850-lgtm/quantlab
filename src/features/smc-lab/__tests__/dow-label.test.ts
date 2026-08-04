import { describe, expect, it } from 'vitest'
import {
  formatSwingChartLabel,
  structureSwingShortLabel,
  swingLabelChipWidth,
} from '../dow-label'

describe('Dow Theory chart labels', () => {
  it('combines structure + Dow without overlapping', () => {
    expect(formatSwingChartLabel('EXTERNAL_SWING_HIGH', 'HH', true)).toBe('eSH·HH')
    expect(formatSwingChartLabel('EXTERNAL_SWING_LOW', 'HL', true)).toBe('eSL·HL')
    expect(formatSwingChartLabel('INTERNAL_SWING_HIGH', 'LH', true)).toBe('iSH·LH')
    expect(formatSwingChartLabel('INTERNAL_SWING_LOW', 'LL', true)).toBe('iSL·LL')
  })

  it('keeps structure-only when toggle off or seed label', () => {
    expect(formatSwingChartLabel('EXTERNAL_SWING_HIGH', 'HH', false)).toBe('eSH')
    expect(formatSwingChartLabel('EXTERNAL_SWING_HIGH', null, true)).toBe('eSH')
    expect(structureSwingShortLabel('EXTERNAL_SWING_LOW')).toBe('eSL')
  })

  it('widens chip for combined labels', () => {
    expect(swingLabelChipWidth('eSH·HH')).toBeGreaterThan(swingLabelChipWidth('eSH'))
  })
})

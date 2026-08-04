import { describe, expect, it } from 'vitest'
import {
  formatSwingChartLabel,
  resolveDowSwingLabel,
  structureSwingShortLabel,
  swingLabelChipWidth,
} from '../dow-label'

describe('Dow Theory chart labels', () => {
  it('combines structure + Dow with a space (no overlap)', () => {
    expect(formatSwingChartLabel('EXTERNAL_SWING_HIGH', 'HH', true)).toBe('eSH HH')
    expect(formatSwingChartLabel('EXTERNAL_SWING_LOW', 'HL', true)).toBe('eSL HL')
    expect(formatSwingChartLabel('INTERNAL_SWING_HIGH', 'LH', true)).toBe('iSH LH')
    expect(formatSwingChartLabel('INTERNAL_SWING_LOW', 'LL', true)).toBe('iSL LL')
  })

  it('keeps structure-only when toggle off or seed label', () => {
    expect(formatSwingChartLabel('EXTERNAL_SWING_HIGH', 'HH', false)).toBe('eSH')
    expect(formatSwingChartLabel('EXTERNAL_SWING_HIGH', null, true)).toBe('eSH')
    expect(structureSwingShortLabel('EXTERNAL_SWING_LOW')).toBe('eSL')
  })

  it('resolves labels from swingClassification by classified id', () => {
    const swing = {
      id: 'e-sh-10-1',
      originalSwingId: 'sh-10-1',
      classification: 'EXTERNAL' as const,
    }
    const map = { 'e-sh-10-1': 'HH' as const, 'e-sl-20-1': 'HL' as const }
    expect(resolveDowSwingLabel(swing, map)).toBe('HH')
  })

  it('resolves labels via bySwingId when classification map lookup misses', () => {
    const swing = {
      id: 'i-sl-5-1',
      originalSwingId: 'sl-5-1',
      classification: 'INTERNAL' as const,
    }
    expect(
      resolveDowSwingLabel(swing, {}, {
        'i-sl-5-1': {
          swingId: 'i-sl-5-1',
          label: 'LL',
          candleIndex: 5,
          confirmedAtIndex: 7,
          classification: 'INTERNAL',
          kind: 'LOW',
          price: 100,
          reason: 'test',
        },
      }),
    ).toBe('LL')
  })

  it('widens chip for combined labels', () => {
    expect(swingLabelChipWidth('eSH HH')).toBeGreaterThan(swingLabelChipWidth('eSH'))
  })
})

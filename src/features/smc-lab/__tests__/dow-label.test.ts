import { describe, expect, it } from 'vitest'
import {
  classificationLookupKeys,
  diagnoseDowChartJoin,
  DOW_LABEL_SEPARATOR,
  formatSwingChartLabel,
  projectSwingChartMarker,
  resolveDowSwingLabel,
  structureSwingShortLabel,
  swingLabelChipWidth,
} from '../dow-label'
import type { SmcDowSwingMeta } from '@/core/smc'

function meta(
  swingId: string,
  label: SmcDowSwingMeta['label'],
  extras: Partial<SmcDowSwingMeta> = {},
): SmcDowSwingMeta {
  return {
    swingId,
    label,
    candleIndex: 10,
    confirmedAtIndex: 12,
    classification: swingId.startsWith('i-') ? 'INTERNAL' : 'EXTERNAL',
    kind: swingId.includes('sl') || swingId.includes('l-') ? 'LOW' : 'HIGH',
    price: 100,
    reason: 'test',
    ...extras,
  }
}

describe('Dow Theory chart labels', () => {
  it('combines structure + Dow with middle-dot (no overlap)', () => {
    expect(DOW_LABEL_SEPARATOR).toBe('·')
    expect(formatSwingChartLabel('EXTERNAL_SWING_HIGH', 'HH', true)).toBe('eSH·HH')
    expect(formatSwingChartLabel('EXTERNAL_SWING_LOW', 'HL', true)).toBe('eSL·HL')
    expect(formatSwingChartLabel('INTERNAL_SWING_HIGH', 'LH', true)).toBe('iSH·LH')
    expect(formatSwingChartLabel('INTERNAL_SWING_LOW', 'LL', true)).toBe('iSL·LL')
  })

  it('keeps structure-only when toggle off or seed/missing classification', () => {
    expect(formatSwingChartLabel('EXTERNAL_SWING_HIGH', 'HH', false)).toBe('eSH')
    expect(formatSwingChartLabel('EXTERNAL_SWING_HIGH', null, true)).toBe('eSH')
    expect(formatSwingChartLabel('EXTERNAL_SWING_HIGH', undefined, true)).toBe('eSH')
    expect(structureSwingShortLabel('EXTERNAL_SWING_LOW')).toBe('eSL')
  })

  it('1) external swing id directly matches classification map', () => {
    const swing = {
      id: 'e-sh-10-1',
      originalSwingId: 'sh-10-1',
      classification: 'EXTERNAL' as const,
      kind: 'EXTERNAL_SWING_HIGH',
    }
    const map = { 'e-sh-10-1': 'HH' as const }
    expect(resolveDowSwingLabel(swing, map)).toBe('HH')
    expect(projectSwingChartMarker(swing, map, undefined, true).text).toBe('eSH·HH')
  })

  it('2) classified swing resolves through originalSwingId', () => {
    const swing = {
      id: 'chart-wrapper-e-sh-10-1',
      originalSwingId: 'sh-10-1',
      classification: 'EXTERNAL' as const,
      kind: 'EXTERNAL_SWING_HIGH',
    }
    // Map keyed by classified id derived from originalSwingId (identity wrapper case).
    const map = { 'e-sh-10-1': 'HH' as const }
    expect(classificationLookupKeys(swing)).toContain('e-sh-10-1')
    expect(resolveDowSwingLabel(swing, map)).toBe('HH')
    expect(projectSwingChartMarker(swing, map, undefined, true).text).toBe('eSH·HH')
  })

  it('3) internal swing resolves through sourceSwingId', () => {
    const swing = {
      id: 'wrapped-internal-1',
      originalSwingId: '',
      sourceSwingId: 'sl-5-1',
      classification: 'INTERNAL' as const,
      kind: 'INTERNAL_SWING_LOW',
    }
    const map = { 'i-sl-5-1': 'LL' as const }
    expect(resolveDowSwingLabel(swing, map)).toBe('LL')
    expect(projectSwingChartMarker(swing, map, undefined, true).text).toBe('iSL·LL')
  })

  it('4) missing classification preserves eSH/eSL/iSH/iSL', () => {
    const swing = {
      id: 'e-sh-99-1',
      originalSwingId: 'sh-99-1',
      classification: 'EXTERNAL' as const,
      kind: 'EXTERNAL_SWING_HIGH',
    }
    expect(resolveDowSwingLabel(swing, {})).toBeUndefined()
    expect(projectSwingChartMarker(swing, {}, undefined, true).text).toBe('eSH')
  })

  it('5) toggle off hides suffix', () => {
    const swing = {
      id: 'e-sh-10-1',
      originalSwingId: 'sh-10-1',
      classification: 'EXTERNAL' as const,
      kind: 'EXTERNAL_SWING_HIGH',
    }
    const map = { 'e-sh-10-1': 'HH' as const }
    expect(projectSwingChartMarker(swing, map, undefined, false).text).toBe('eSH')
  })

  it('6) toggle on renders eSH·HH / eSL·HL / iSH·LH / iSL·LL', () => {
    const cases = [
      {
        swing: {
          id: 'e-sh-1',
          originalSwingId: 'sh-1',
          classification: 'EXTERNAL' as const,
          kind: 'EXTERNAL_SWING_HIGH',
        },
        label: 'HH' as const,
        expected: 'eSH·HH',
      },
      {
        swing: {
          id: 'e-sl-1',
          originalSwingId: 'sl-1',
          classification: 'EXTERNAL' as const,
          kind: 'EXTERNAL_SWING_LOW',
        },
        label: 'HL' as const,
        expected: 'eSL·HL',
      },
      {
        swing: {
          id: 'i-sh-1',
          originalSwingId: 'sh-1',
          classification: 'INTERNAL' as const,
          kind: 'INTERNAL_SWING_HIGH',
        },
        label: 'LH' as const,
        expected: 'iSH·LH',
      },
      {
        swing: {
          id: 'i-sl-1',
          originalSwingId: 'sl-1',
          classification: 'INTERNAL' as const,
          kind: 'INTERNAL_SWING_LOW',
        },
        label: 'LL' as const,
        expected: 'iSL·LL',
      },
    ]
    for (const c of cases) {
      const map = { [c.swing.id]: c.label }
      expect(projectSwingChartMarker(c.swing, map, undefined, true).text).toBe(c.expected)
    }
  })

  it('8) density/collision formatting retains the combined label', () => {
    const swing = {
      id: 'e-sh-10-1',
      originalSwingId: 'sh-10-1',
      classification: 'EXTERNAL' as const,
      kind: 'EXTERNAL_SWING_HIGH',
    }
    const marker = projectSwingChartMarker(swing, { 'e-sh-10-1': 'HH' }, undefined, true)
    // Collision logic must keep marker.text intact — width sized for full combined label.
    expect(marker.text).toBe('eSH·HH')
    expect(marker.width).toBe(swingLabelChipWidth('eSH·HH'))
    expect(marker.width).toBeGreaterThan(swingLabelChipWidth('eSH'))
  })

  it('exposes selected-swing diagnostics shape', () => {
    const swing = {
      id: 'e-sh-10-1',
      originalSwingId: 'sh-10-1',
      sourceSwingId: 'sh-10-1',
      classification: 'EXTERNAL' as const,
      kind: 'EXTERNAL_SWING_HIGH',
    }
    const diag = diagnoseDowChartJoin(
      swing,
      { 'e-sh-10-1': 'HH' },
      { 'e-sh-10-1': meta('e-sh-10-1', 'HH') },
      true,
      swing.kind,
    )
    expect(diag).toEqual(
      expect.objectContaining({
        chartEventId: 'e-sh-10-1',
        originalSwingId: 'sh-10-1',
        classificationLookupKeysTried: expect.arrayContaining(['e-sh-10-1', 'sh-10-1']),
        matchedClassification: 'HH',
        finalLabel: 'eSH·HH',
      }),
    )
  })

  it('seed null stops lookup (does not fall through to another key)', () => {
    const swing = {
      id: 'e-sl-1',
      originalSwingId: 'sl-1',
      classification: 'EXTERNAL' as const,
      kind: 'EXTERNAL_SWING_LOW',
    }
    // Exact id is seed null; a misleading base key must not win.
    const map = { 'e-sl-1': null, 'sl-1': 'HL' as const }
    expect(resolveDowSwingLabel(swing, map)).toBeNull()
    expect(projectSwingChartMarker(swing, map, undefined, true).text).toBe('eSL')
  })

  it('resolves via bySwingId when classification map lookup misses', () => {
    const swing = {
      id: 'i-sl-5-1',
      originalSwingId: 'sl-5-1',
      classification: 'INTERNAL' as const,
      kind: 'INTERNAL_SWING_LOW',
    }
    expect(
      resolveDowSwingLabel(swing, {}, { 'i-sl-5-1': meta('i-sl-5-1', 'LL') }),
    ).toBe('LL')
  })
})

import type { DowSwingLabel } from '@/core/smc'

/** Short structure marker for classified / base swings. */
export function structureSwingShortLabel(kind: string): string {
  switch (kind) {
    case 'EXTERNAL_SWING_HIGH':
      return 'eSH'
    case 'EXTERNAL_SWING_LOW':
      return 'eSL'
    case 'INTERNAL_SWING_HIGH':
      return 'iSH'
    case 'INTERNAL_SWING_LOW':
      return 'iSL'
    case 'SWING_HIGH':
      return 'SH'
    case 'SWING_LOW':
      return 'SL'
    default:
      return kind.slice(0, 3)
  }
}

/**
 * Combine structure marker with Dow HH/HL/LH/LL without overlapping text.
 * Example: eSH·HH, iSL·HL. Seed swings (null label) keep structure-only text.
 */
export function formatSwingChartLabel(
  kind: string,
  dowLabel: DowSwingLabel | null | undefined,
  showDowTheoryLabels: boolean,
): string {
  const structure = structureSwingShortLabel(kind)
  if (!showDowTheoryLabels || dowLabel == null) return structure
  return `${structure}·${dowLabel}`
}

/** Approximate label chip width for the combined text. */
export function swingLabelChipWidth(text: string): number {
  if (text.includes('·')) return Math.max(40, 8 + text.length * 6)
  return text.length >= 4 ? 36 : 28
}

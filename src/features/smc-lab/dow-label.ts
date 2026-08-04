import type { DowSwingLabel, SmcClassifiedSwingEvent, SmcDowSwingMeta } from '@/core/smc'

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
 * Resolve Dow HH/HL/LH/LL for a classified swing from the projection maps.
 * Prefers swing.id (e-/i- prefixed), then bySwingId, then originalSwingId variants.
 */
export function resolveDowSwingLabel(
  swing: Pick<SmcClassifiedSwingEvent, 'id' | 'originalSwingId' | 'classification'>,
  swingClassification?: Record<string, DowSwingLabel | null>,
  bySwingId?: Record<string, SmcDowSwingMeta>,
): DowSwingLabel | null | undefined {
  if (bySwingId?.[swing.id]) {
    return bySwingId[swing.id]!.label
  }
  if (swingClassification && Object.prototype.hasOwnProperty.call(swingClassification, swing.id)) {
    return swingClassification[swing.id]
  }
  const prefixed =
    swing.classification === 'EXTERNAL'
      ? `e-${swing.originalSwingId}`
      : `i-${swing.originalSwingId}`
  if (bySwingId?.[prefixed]) return bySwingId[prefixed]!.label
  if (swingClassification && Object.prototype.hasOwnProperty.call(swingClassification, prefixed)) {
    return swingClassification[prefixed]
  }
  if (swing.originalSwingId) {
    if (bySwingId?.[swing.originalSwingId]) return bySwingId[swing.originalSwingId]!.label
    if (
      swingClassification &&
      Object.prototype.hasOwnProperty.call(swingClassification, swing.originalSwingId)
    ) {
      return swingClassification[swing.originalSwingId]
    }
  }
  return undefined
}

/**
 * Combine structure marker with Dow HH/HL/LH/LL without overlapping text.
 * Example: "eSH HH", "iSL HL". Seed swings (null label) keep structure-only text.
 */
export function formatSwingChartLabel(
  kind: string,
  dowLabel: DowSwingLabel | null | undefined,
  showDowTheoryLabels: boolean,
): string {
  const structure = structureSwingShortLabel(kind)
  if (!showDowTheoryLabels) return structure
  if (dowLabel == null) return structure
  return `${structure} ${dowLabel}`
}

/** Approximate label chip width for the combined text. */
export function swingLabelChipWidth(text: string): number {
  // Generous width so "eSH HH" / "iSL LL" never clips in the SVG chip.
  return Math.max(36, 12 + text.length * 7)
}

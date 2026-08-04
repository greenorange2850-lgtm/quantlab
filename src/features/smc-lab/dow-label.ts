import type { DowSwingLabel, SmcClassifiedSwingEvent, SmcDowSwingMeta } from '@/core/smc'

/** Product separator between structure marker and Dow class. */
export const DOW_LABEL_SEPARATOR = '·'

/** Swing identity fields used for Dow classification lookup. */
export type DowLookupSwing = Pick<
  SmcClassifiedSwingEvent,
  'id' | 'originalSwingId' | 'classification'
> & {
  /** Optional alias some wrappers may expose for the base/detector swing id. */
  sourceSwingId?: string | null
}

/**
 * Deterministic lookup key chain for chart event → Dow classification.
 * Prefer exact chart/event id, then classified wrappers, then base/source ids.
 * Never uses timestamp/price matching.
 */
export function classificationLookupKeys(swing: DowLookupSwing): string[] {
  const keys: string[] = []
  const push = (key: string | null | undefined) => {
    if (!key) return
    if (!keys.includes(key)) keys.push(key)
  }

  push(swing.id)

  const baseId = swing.originalSwingId || swing.sourceSwingId || null
  if (baseId) {
    // Classified wrapper keys used by Dow Theory (e-{base} / i-{base}).
    push(`e-${baseId}`)
    push(`i-${baseId}`)
    push(baseId)
  }

  // If the chart event itself is an unprefixed base id, try classified wrappers.
  const alreadyClassified = /^(e|i)-/.test(swing.id)
  if (!alreadyClassified) {
    if (swing.classification === 'EXTERNAL') push(`e-${swing.id}`)
    else if (swing.classification === 'INTERNAL') push(`i-${swing.id}`)
  }

  if (swing.sourceSwingId && swing.sourceSwingId !== swing.originalSwingId) {
    push(`e-${swing.sourceSwingId}`)
    push(`i-${swing.sourceSwingId}`)
    push(swing.sourceSwingId)
  }

  return keys
}

function lookupInMaps(
  key: string,
  swingClassification?: Record<string, DowSwingLabel | null>,
  bySwingId?: Record<string, SmcDowSwingMeta>,
): { found: boolean; label: DowSwingLabel | null | undefined } {
  if (bySwingId && Object.prototype.hasOwnProperty.call(bySwingId, key)) {
    return { found: true, label: bySwingId[key]!.label }
  }
  if (
    swingClassification &&
    Object.prototype.hasOwnProperty.call(swingClassification, key)
  ) {
    return { found: true, label: swingClassification[key] }
  }
  return { found: false, label: undefined }
}

/**
 * Resolve Dow HH/HL/LH/LL for a chart swing from the projection maps.
 * Prefers exact event id, then originalSwingId/sourceSwingId wrapper keys.
 * First hit wins — including seed `null` (do not fall through to another key).
 */
export function resolveDowSwingLabel(
  swing: DowLookupSwing,
  swingClassification?: Record<string, DowSwingLabel | null>,
  bySwingId?: Record<string, SmcDowSwingMeta>,
): DowSwingLabel | null | undefined {
  for (const key of classificationLookupKeys(swing)) {
    const hit = lookupInMaps(key, swingClassification, bySwingId)
    if (hit.found) return hit.label
  }
  return undefined
}

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
 * Toggle OFF always returns the structure marker only.
 */
export function formatSwingChartLabel(
  kind: string,
  dowLabel: DowSwingLabel | null | undefined,
  showDowTheoryLabels: boolean,
): string {
  const structure = structureSwingShortLabel(kind)
  if (!showDowTheoryLabels) return structure
  if (dowLabel == null) return structure
  return `${structure}${DOW_LABEL_SEPARATOR}${dowLabel}`
}

/** Approximate label chip width for the combined text (never clips Dow suffix). */
export function swingLabelChipWidth(text: string): number {
  // Middle-dot combined labels need generous width so HH/HL/LH/LL stay visible.
  if (text.includes(DOW_LABEL_SEPARATOR)) {
    return Math.max(48, 14 + text.length * 7)
  }
  return Math.max(36, 12 + text.length * 7)
}

/** Development diagnostics for a selected / visible chart swing join. */
export interface DowChartJoinDiagnostics {
  chartEventId: string
  originalSwingId: string | null
  sourceSwingId: string | null
  classificationLookupKeysTried: string[]
  matchedClassification: DowSwingLabel | null
  matchedLookupKey: string | null
  finalLabel: string
  showDowTheoryLabels: boolean
}

/**
 * Trace one swing through the chart←Dow identity join.
 * Safe for inspector / debug dumps; does not affect detector algorithms.
 */
export function diagnoseDowChartJoin(
  swing: DowLookupSwing & { kind?: string },
  swingClassification: Record<string, DowSwingLabel | null> | undefined,
  bySwingId: Record<string, SmcDowSwingMeta> | undefined,
  showDowTheoryLabels: boolean,
  kind?: string,
): DowChartJoinDiagnostics {
  const keys = classificationLookupKeys(swing)
  let matchedClassification: DowSwingLabel | null = null
  let matchedLookupKey: string | null = null
  let resolved: DowSwingLabel | null | undefined

  for (const key of keys) {
    const hit = lookupInMaps(key, swingClassification, bySwingId)
    if (!hit.found) continue
    matchedLookupKey = key
    resolved = hit.label
    matchedClassification = hit.label ?? null
    break
  }

  const swingKind = kind ?? ('kind' in swing && typeof swing.kind === 'string' ? swing.kind : '')
  const finalLabel = formatSwingChartLabel(swingKind, resolved, showDowTheoryLabels)

  return {
    chartEventId: swing.id,
    originalSwingId: swing.originalSwingId ?? null,
    sourceSwingId: swing.sourceSwingId ?? null,
    classificationLookupKeysTried: keys,
    matchedClassification,
    matchedLookupKey,
    finalLabel,
    showDowTheoryLabels,
  }
}

/** Rendered chart marker projection for one classified swing (testable). */
export interface SwingChartMarkerProjection {
  id: string
  text: string
  width: number
  dowLabel: DowSwingLabel | null | undefined
  diagnostics: DowChartJoinDiagnostics
}

/**
 * Project a single classified swing to its chart marker label.
 * Ranking/density/collision must consume this full `text` — never strip only the Dow suffix.
 */
export function projectSwingChartMarker(
  swing: DowLookupSwing & { kind: string },
  swingClassification: Record<string, DowSwingLabel | null> | undefined,
  bySwingId: Record<string, SmcDowSwingMeta> | undefined,
  showDowTheoryLabels: boolean,
): SwingChartMarkerProjection {
  const diagnostics = diagnoseDowChartJoin(
    swing,
    swingClassification,
    bySwingId,
    showDowTheoryLabels,
    swing.kind,
  )
  // Use resolve path (same keys) so seed null vs missing stay consistent with formatter.
  const dowLabel = resolveDowSwingLabel(swing, swingClassification, bySwingId)
  const text = formatSwingChartLabel(swing.kind, dowLabel, showDowTheoryLabels)
  return {
    id: swing.id,
    text,
    width: swingLabelChipWidth(text),
    dowLabel,
    diagnostics: { ...diagnostics, finalLabel: text },
  }
}

/**
 * Project all classified swings to chart markers (pre-density collapse).
 * Collision/density layers must keep `text` intact for survivors.
 */
export function projectSwingChartMarkers(
  swings: readonly (DowLookupSwing & { kind: string })[],
  swingClassification: Record<string, DowSwingLabel | null> | undefined,
  bySwingId: Record<string, SmcDowSwingMeta> | undefined,
  showDowTheoryLabels: boolean,
): SwingChartMarkerProjection[] {
  return swings.map((swing) =>
    projectSwingChartMarker(swing, swingClassification, bySwingId, showDowTheoryLabels),
  )
}

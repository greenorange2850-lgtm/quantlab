import type { SmcDetectionKind, SmcDetectorConfig, SmcGoldenDataset } from '@/core/smc'
import { SMC_DETECTOR_VERSION } from '@/core/smc'

export const SMC_LAB_PREFS_STORAGE_KEY = 'quantlab.smc-lab.prefs.v2'
export const SMC_LAB_CONFIGS_STORAGE_KEY = 'quantlab.smc-lab.configs.v2'
export const SMC_LAB_DB = {
  name: 'quantlab-smc-lab',
  version: 2,
  reviews: 'smcReviews',
  annotations: 'smcAnnotations',
  goldenDatasets: 'smcGoldenDatasets',
} as const

export type SmcReviewVerdict = 'correct' | 'wrong' | 'unsure' | 'unreviewed'

export type SmcSwingWrongTag =
  | 'wrong_pivot'
  | 'equal_handling'
  | 'confirmed_too_early'
  | 'missed_stronger'
  | 'noise'

export type SmcBosWrongTag =
  | 'wrong_swing'
  | 'wick_only'
  | 'break_too_small'
  | 'repeated_break'
  | 'structure_differs'
  | 'other'

export type SmcPhase2WrongTag =
  | 'wrong_classification'
  | 'wrong_choch'
  | 'false_displacement'
  | 'bad_fvg_geometry'
  | 'false_sweep'
  | 'bad_order_block'
  | 'dependency_wrong'
  | 'other'

export type SmcWrongTag = SmcSwingWrongTag | SmcBosWrongTag | SmcPhase2WrongTag

export interface SmcEventFingerprint {
  eventId: string
  kind: SmcDetectionKind
  candleIndex: number
  timestamp: number
  price: number
  /** Extra identity for BOS/CHoCH. */
  brokenSwingId?: string
  profileId?: string
}

export interface SmcReviewRecord {
  id: string
  fingerprint: SmcEventFingerprint
  detectorVersion: string
  configSnapshot: SmcDetectorConfig
  configHash: string
  profileId?: string
  module?: string
  verdict: Exclude<SmcReviewVerdict, 'unreviewed'>
  reasonTags: SmcWrongTag[]
  note: string
  reviewedAt: number
  datasetKey: string
}

export type SmcManualAnnotationKind =
  | 'MANUAL_SWING_HIGH'
  | 'MANUAL_SWING_LOW'
  | 'MANUAL_BULLISH_BOS'
  | 'MANUAL_BEARISH_BOS'
  | 'MANUAL_BULLISH_CHOCH'
  | 'MANUAL_BEARISH_CHOCH'
  | 'NOTE'

export interface SmcManualAnnotation {
  id: string
  kind: SmcManualAnnotationKind
  datasetKey: string
  sourceKind: 'binance' | 'local'
  symbol: string
  timeframe: string
  timestamp: number
  price: number
  note: string
  createdAt: number
  updatedAt: number
}

export interface SmcSavedLabConfig {
  id: string
  name: string
  config: SmcDetectorConfig
  profileId?: string
  createdAt: number
  updatedAt: number
  builtin?: boolean
}

export type SmcDensityPreset = 'minimal' | 'structure' | 'liquidity' | 'full-debug'

/** Intelligence visibility mode — filters display only; never deletes detector events. */
export type SmcVisibilityModePref = 'focus' | 'balanced' | 'debug'

/** Smart chart zone visibility (orthogonal to ranking Focus/Balanced/Debug). */
export type SmcSmartVisibilityPresetPref =
  | 'active-only'
  | 'setup-focus'
  | 'balanced'
  | 'history'
  | 'debug'

export interface SmcLabPreferences {
  schemaVersion: 2
  activeConfigId: string | null
  activeProfileId: string
  detectorConfig: SmcDetectorConfig
  layerToggles: {
    externalSwings: boolean
    internalSwings: boolean
    bosLabels: boolean
    chochLabels: boolean
    /** When false, only external (or unclassified) BOS/CHoCH markers render. */
    internalBreaks: boolean
    bosLines: boolean
    activeFvg: boolean
    mitigatedFvg: boolean
    activeOrderBlocks: boolean
    invalidatedOrderBlocks: boolean
    equalLevels: boolean
    liquiditySweeps: boolean
    displacement: boolean
    manualMarks: boolean
    validationMarks: boolean
    connectorLines: boolean
    diagnosticsLabels: boolean
    /** Show HH/HL/LH/LL beside eSH/eSL/iSH/iSL on the chart. */
    dowTheoryLabels: boolean
  }
  densityPreset: SmcDensityPreset
  /** Ranking Focus / Balanced / Debug. */
  visibilityMode: SmcVisibilityModePref
  /** Zone lifecycle smart chart visibility. Default Balanced. */
  smartVisibilityPreset: SmcSmartVisibilityPresetPref
  zoneLifecycle: {
    showActive: boolean
    showTouched: boolean
    showMitigatedFilled: boolean
    showInvalidated: boolean
    extendActiveZonesRight: boolean
    fadeOldActiveZones: boolean
  }
  playSpeed: 0.5 | 1 | 2 | 5
  compareProfileId: string | null
}

export interface SmcLabExportPayload {
  /** Phase 1 exports used 1; Phase 2 writes 2; Phase 4 validation writes 3. */
  schemaVersion: 1 | 2 | 3
  exportedAt: number
  detectorVersion: string
  detectorConfig: SmcDetectorConfig
  profileId?: string
  reviews: SmcReviewRecord[]
  annotations: SmcManualAnnotation[]
  /** Optional golden datasets (schema v3+). */
  goldenDatasets?: SmcGoldenDataset[]
  dataset: {
    datasetKey: string
    sourceKind: 'binance' | 'local'
    symbol: string
    timeframe: string
    startMs: number | null
    endMs: number | null
    candleCount: number
  }
}

/** Stable hash for distinguishing review applicability across configs. */
export function hashSmcConfig(config: SmcDetectorConfig): string {
  return JSON.stringify(config)
}

export function buildEventFingerprint(input: {
  eventId: string
  kind: SmcDetectionKind
  candleIndex: number
  timestamp: number
  price: number
  brokenSwingId?: string
  profileId?: string
}): SmcEventFingerprint {
  return {
    eventId: input.eventId,
    kind: input.kind,
    candleIndex: input.candleIndex,
    timestamp: input.timestamp,
    price: input.price,
    brokenSwingId: input.brokenSwingId,
    profileId: input.profileId,
  }
}

export function fingerprintsMatch(
  a: SmcEventFingerprint,
  b: SmcEventFingerprint,
): boolean {
  return (
    a.eventId === b.eventId &&
    a.kind === b.kind &&
    a.candleIndex === b.candleIndex &&
    a.timestamp === b.timestamp &&
    a.price === b.price &&
    (a.brokenSwingId ?? null) === (b.brokenSwingId ?? null)
  )
}

export function buildDatasetKey(input: {
  sourceKind: 'binance' | 'local'
  symbol: string
  timeframe: string
  datasetId?: string | null
}): string {
  if (input.sourceKind === 'local') {
    return `local:${input.datasetId ?? 'unknown'}:${input.symbol}:${input.timeframe}`
  }
  return `binance:${input.symbol}:${input.timeframe}`
}

export function createReviewId(fingerprint: SmcEventFingerprint, configHash: string): string {
  return `rev-${fingerprint.eventId}-${configHash.slice(0, 24)}`
}

export { SMC_DETECTOR_VERSION }

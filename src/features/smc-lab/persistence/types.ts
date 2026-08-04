import type { SmcDetectionKind, SmcDetectorConfig } from '@/core/smc'
import { SMC_DETECTOR_VERSION } from '@/core/smc'

export const SMC_LAB_PREFS_STORAGE_KEY = 'quantlab.smc-lab.prefs.v2'
export const SMC_LAB_CONFIGS_STORAGE_KEY = 'quantlab.smc-lab.configs.v2'
export const SMC_LAB_DB = {
  name: 'quantlab-smc-lab',
  version: 1,
  reviews: 'smcReviews',
  annotations: 'smcAnnotations',
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
  }
  densityPreset: SmcDensityPreset
  playSpeed: 0.5 | 1 | 2 | 5
  compareProfileId: string | null
}

export interface SmcLabExportPayload {
  /** Phase 1 exports used 1; Phase 2 writes 2. Import accepts both. */
  schemaVersion: 1 | 2
  exportedAt: number
  detectorVersion: string
  detectorConfig: SmcDetectorConfig
  profileId?: string
  reviews: SmcReviewRecord[]
  annotations: SmcManualAnnotation[]
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

import type { SmcDetectionKind, SmcDetectorConfig } from '../types'

/** Validation modules (human-facing). */
export type SmcValidationModule =
  | 'Swing'
  | 'BOS'
  | 'CHoCH'
  | 'Displacement'
  | 'FVG'
  | 'Liquidity Sweep'
  | 'Order Block'

export type SmcModuleAcceptanceStatus =
  | 'Experimental'
  | 'Needs Tuning'
  | 'Usable'
  | 'Verified'

/** Expected event label in a golden dataset (human ground truth). */
export interface SmcGoldenLabel {
  id: string
  kind: SmcDetectionKind
  module: SmcValidationModule
  candleIndex: number
  timestamp: number
  price: number
  /** Broken swing / source structure id when relevant (BOS/CHoCH/OB/sweep). */
  sourceStructureId?: string | null
  note?: string
  reasonTags?: string[]
  createdAt: number
}

export interface SmcGoldenDatasetScope {
  sourceKind: 'binance' | 'local'
  symbol: string
  timeframe: string
  datasetKey: string
  startMs: number | null
  endMs: number | null
  detectorVersion: string
  /** Config fingerprint — typically JSON.stringify(config). */
  configFingerprint: string
  profileId?: string
}

export interface SmcGoldenDataset extends SmcGoldenDatasetScope {
  id: string
  name: string
  labels: SmcGoldenLabel[]
  createdAt: number
  updatedAt: number
}

/** Deterministic matching tolerances. */
export interface SmcEventMatchTolerance {
  /** Absolute timestamp delta allowed (ms). */
  timestampToleranceMs: number
  /** Relative price tolerance as percent of reference price (e.g. 0.05 = 0.05%). */
  priceTolerancePercent: number
  /** Absolute candle index delta allowed. */
  candleIndexTolerance: number
  /**
   * When both expected and detected provide sourceStructureId, require equality.
   * When only one side has it, the field is ignored.
   */
  requireSourceStructureIdWhenPresent: boolean
}

export const DEFAULT_SMC_MATCH_TOLERANCE: SmcEventMatchTolerance = {
  timestampToleranceMs: 0,
  priceTolerancePercent: 0.05,
  candleIndexTolerance: 0,
  requireSourceStructureIdWhenPresent: true,
}

export interface SmcDetectedEventProbe {
  id: string
  kind: SmcDetectionKind
  candleIndex: number
  timestamp: number
  price: number
  sourceStructureId?: string | null
  /** When the event becomes knowable (progressive). */
  knowableAtIndex: number
}

export interface SmcEventMatch {
  expectedId: string
  detectedId: string
  kind: SmcDetectionKind
  module: SmcValidationModule
  score: number
}

export interface SmcModuleValidationMetrics {
  module: SmcValidationModule
  truePositives: number
  falsePositives: number
  falseNegatives: number
  precision: number | null
  recall: number | null
  reviewedAgreement: number | null
  unsureCount: number
  reviewedSampleCount: number
  status: SmcModuleAcceptanceStatus
}

export interface SmcLookAheadViolation {
  eventId: string
  kind: SmcDetectionKind
  candleIndex: number
  knowableAtIndex: number
  appearedAtIndex: number
  detail: string
}

export interface SmcProgressiveConsistencyReport {
  ok: boolean
  fullHistoryEventCount: number
  progressiveFinalEventCount: number
  missingInProgressive: string[]
  extraInProgressive: string[]
  lookAheadViolations: SmcLookAheadViolation[]
}

export interface SmcWrongTagCount {
  tag: string
  count: number
}

export interface SmcValidationReport {
  datasetId: string
  datasetName: string
  detectorVersion: string
  configFingerprint: string
  profileId?: string
  reviewedSampleCount: number
  modules: SmcModuleValidationMetrics[]
  matched: SmcEventMatch[]
  missed: SmcGoldenLabel[]
  extra: SmcDetectedEventProbe[]
  wrongReasonTags: SmcWrongTagCount[]
  progressive: SmcProgressiveConsistencyReport | null
  invariantFailures: number
  worstModule: SmcValidationModule | null
  generatedAt: number
}

export interface SmcAcceptanceGate {
  module: SmcValidationModule
  usablePrecision: number
  verifiedPrecision: number
  verifiedRecall: number
  minSamplesForUsable: number
  minSamplesForVerified: number
}

export const SMC_ACCEPTANCE_GATES: Record<SmcValidationModule, SmcAcceptanceGate> = {
  Swing: {
    module: 'Swing',
    usablePrecision: 0.9,
    verifiedPrecision: 0.95,
    verifiedRecall: 0.9,
    minSamplesForUsable: 10,
    minSamplesForVerified: 30,
  },
  BOS: {
    module: 'BOS',
    usablePrecision: 0.9,
    verifiedPrecision: 0.95,
    verifiedRecall: 0.9,
    minSamplesForUsable: 10,
    minSamplesForVerified: 30,
  },
  CHoCH: {
    module: 'CHoCH',
    usablePrecision: 0.85,
    verifiedPrecision: 0.92,
    verifiedRecall: 0.85,
    minSamplesForUsable: 8,
    minSamplesForVerified: 25,
  },
  Displacement: {
    module: 'Displacement',
    usablePrecision: 0.85,
    verifiedPrecision: 0.92,
    verifiedRecall: 0.85,
    minSamplesForUsable: 8,
    minSamplesForVerified: 25,
  },
  FVG: {
    module: 'FVG',
    usablePrecision: 0.95,
    verifiedPrecision: 0.98,
    verifiedRecall: 0.9,
    minSamplesForUsable: 10,
    minSamplesForVerified: 30,
  },
  'Liquidity Sweep': {
    module: 'Liquidity Sweep',
    usablePrecision: 0.85,
    verifiedPrecision: 0.92,
    verifiedRecall: 0.85,
    minSamplesForUsable: 8,
    minSamplesForVerified: 25,
  },
  'Order Block': {
    module: 'Order Block',
    usablePrecision: 0.8,
    verifiedPrecision: 0.9,
    verifiedRecall: 0.8,
    minSamplesForUsable: 8,
    minSamplesForVerified: 25,
  },
}

export type { SmcDetectorConfig }

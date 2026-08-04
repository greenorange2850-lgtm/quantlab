/**
 * QuantLab Quasimodo Level (QML) v1 — immutable typed contracts.
 * Isolated from core SMC detectors; consumes their outputs only.
 */

export const SMC_QML_VERSION = '1.0.0-experimental'

export type QmlDirection = 'BULLISH' | 'BEARISH'

export type QmlStatus =
  | 'CANDIDATE'
  | 'CONFIRMED'
  | 'ZONE_ACTIVE'
  | 'RETESTED'
  | 'ENTRY_READY'
  | 'INVALIDATED'
  | 'EXPIRED'

export type QmlZoneMode =
  | 'STRUCTURE_LEVEL'
  | 'FULL_CANDLE'
  | 'BODY'
  | 'OPEN_TO_EXTREME'
  | 'LINKED_ORDER_BLOCK'

export type QmlRetestMode = 'TOUCH' | 'MIDPOINT' | 'DEEP_RETRACE'

export type QmlConfirmationMode = 'STRICT' | 'BALANCED' | 'EARLY'

export type QmlInvalidationMode =
  | 'CLOSE_BEYOND_ZONE'
  | 'WICK_BEYOND_EXTREME'
  | 'OPPOSING_EXTERNAL_BOS'

export type QmlStructureScope = 'INTERNAL' | 'EXTERNAL' | 'BOTH'

export type QmlSourceSelectionMethod =
  | 'DOW_CLASSIFIED_SWING'
  | 'CHOCH_BROKEN_SWING'
  | 'OPPOSITE_CANDLE_OF_LEG'
  | 'LINKED_ORDER_BLOCK'
  | 'STRUCTURE_LEVEL_FALLBACK'

export interface QmlCheck {
  id: string
  label: string
  passed: boolean
  required: boolean
  reason: string
  sourceEventIds: string[]
}

export interface QmlConfirmationRefs {
  rejectionEventId?: string
  displacementEventId?: string
  fvgEventId?: string
  sweepEventId?: string
  orderBlockId?: string
}

export interface QmlRetestDetails {
  firstRetestIndex: number
  firstRetestTimestamp: number
  penetrationPercent: number
  closeLocation: 'BELOW_ZONE' | 'INSIDE_ZONE' | 'ABOVE_ZONE' | 'AT_BOUNDARY'
  rejectionOccurred: boolean
  touchCount: number
  retestMode: QmlRetestMode
}

export interface QmlSourceSelection {
  method: QmlSourceSelectionMethod
  sourceSwingId: string
  sourceCandleIndex: number | null
  sourceCandleTime: number | null
  linkedOrderBlockId: string | null
  explanation: string[]
}

export interface QmlScoreBreakdown {
  total: number
  factors: Array<{ id: string; label: string; delta: number; reason: string }>
}

/** Immutable QML pattern — QuantLab QML v1. */
export interface QmlPattern {
  id: string
  direction: QmlDirection
  status: QmlStatus

  priorTrend: string
  trendStrength: number

  sourceSwingId: string
  extremeSwingId: string
  structureShiftEventId: string

  sourceCandleIndex?: number
  sourceCandleTime?: number

  zoneId: string
  zoneLow: number
  zoneHigh: number
  zoneMode: QmlZoneMode

  createdIndex: number
  confirmedIndex?: number
  zoneActiveIndex?: number
  retestIndex?: number
  entryReadyIndex?: number
  invalidatedIndex?: number
  expiredIndex?: number

  confirmationRefs: QmlConfirmationRefs
  requiredChecks: QmlCheck[]
  optionalChecks: QmlCheck[]
  missingChecks: string[]

  eventChain: string[]
  explanation: string[]

  /** Canonical identity for deduplication. */
  canonicalKey: string
  sourceSelection: QmlSourceSelection
  retestDetails?: QmlRetestDetails
  /** Setup strength 0–100 (relevance/quality, not win probability). */
  setupStrength: number
  scoreBreakdown: QmlScoreBreakdown
  structureScope: 'INTERNAL' | 'EXTERNAL'
  experimental: boolean
  confirmationMode: QmlConfirmationMode
  invalidationMode: QmlInvalidationMode
  /** Zone chart extent end (inclusive); clipped on invalidation/expiry. */
  zoneEndIndex: number
}

export interface QmlRejectionReason {
  reason: string
  count: number
}

export interface QmlDiagnostics {
  structuralCandidates: number
  confirmedBullish: number
  confirmedBearish: number
  activeZones: number
  retested: number
  entryReady: number
  invalidated: number
  expired: number
  duplicatePatternsSuppressed: number
  candidatesRejectedByReason: QmlRejectionReason[]
  averageStrength: number
  averageBarsFromChochToRetest: number | null
  internalSourceCount: number
  externalSourceCount: number
  durationMs: number
}

export interface QmlInvariantCounts {
  qmlWithoutPriorTrend: number
  sourceSwingAfterExtreme: number
  extremeAfterChoch: number
  sourceCandleAfterChoch: number
  retestBeforeZoneCreation: number
  entryReadyBeforeRetestClose: number
  invalidatedZoneStillActive: number
  duplicateCanonicalQml: number
  missingEventReference: number
  futureEventUsed: number
  progressiveFullMismatch: number
  ok: boolean
}

export interface SmcQmlLayer {
  version: string
  experimental: boolean
  enabled: boolean
  visibleThroughIndex: number
  patterns: QmlPattern[]
  diagnostics: QmlDiagnostics
  invariants: QmlInvariantCounts
  invariantDetails: string[]
  status: 'COMPLETE' | 'FAILED' | 'DISABLED' | 'SKIPPED'
  duplicateSuppression: Array<{
    canonicalKey: string
    keptId: string
    suppressedId: string
    reason: string
  }>
}

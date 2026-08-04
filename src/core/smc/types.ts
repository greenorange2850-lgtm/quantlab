import type { Candle } from '@/data/candles'
import type {
  SmcDowTheoryDiagnostics,
  SmcDowTheoryLayer,
} from './dow-theory/types'
import type { SmcIntelligenceLayer, SmcRankingDiagnostics } from './ranking/types'

/** Phase-2 detection kinds. */
export type SmcDetectionKind =
  | 'SWING_HIGH'
  | 'SWING_LOW'
  | 'INTERNAL_SWING_HIGH'
  | 'INTERNAL_SWING_LOW'
  | 'EXTERNAL_SWING_HIGH'
  | 'EXTERNAL_SWING_LOW'
  | 'BULLISH_BOS'
  | 'BEARISH_BOS'
  | 'BULLISH_CHOCH'
  | 'BEARISH_CHOCH'
  | 'BULLISH_DISPLACEMENT'
  | 'BEARISH_DISPLACEMENT'
  | 'BULLISH_FVG_CREATED'
  | 'BEARISH_FVG_CREATED'
  | 'FVG_TOUCHED'
  | 'FVG_HALF_FILLED'
  | 'FVG_FULLY_FILLED'
  | 'FVG_INVALIDATED'
  | 'EQUAL_HIGHS'
  | 'EQUAL_LOWS'
  | 'BUY_SIDE_LIQUIDITY_SWEEP'
  | 'SELL_SIDE_LIQUIDITY_SWEEP'
  | 'BULLISH_ORDER_BLOCK_CREATED'
  | 'BEARISH_ORDER_BLOCK_CREATED'
  | 'ORDER_BLOCK_TOUCHED'
  | 'ORDER_BLOCK_MITIGATED'
  | 'ORDER_BLOCK_INVALIDATED'

export const SMC_DETECTOR_VERSION = '2.0.0-phase2'

export type SmcStructureState =
  | 'BULLISH_STRUCTURE'
  | 'BEARISH_STRUCTURE'
  | 'UNDETERMINED_STRUCTURE'

export type SmcSwingClassification = 'INTERNAL' | 'EXTERNAL' | 'UNCLASSIFIED'

export type SmcStructureScope = 'INTERNAL' | 'EXTERNAL' | 'BOTH' | 'BASE'

export type SmcMitigationMode = 'TOUCH' | 'HALF_FILL' | 'FULL_FILL' | 'MIDPOINT'

export type SmcOrderBlockZoneMode = 'FULL_CANDLE' | 'BODY' | 'OPEN_TO_EXTREME'

export type SmcOrderBlockInvalidationMode = 'CLOSE_BEYOND' | 'WICK_BEYOND'

export type SmcOrderBlockSourceBreak = 'BOS' | 'CHOCH' | 'BOTH'

export type SmcFvgMitigationMode = 'TOUCH' | 'HALF_FILL' | 'FULL_FILL'

export type SmcZoneState = 'ACTIVE' | 'TOUCHED' | 'HALF_FILLED' | 'FULLY_FILLED' | 'MITIGATED' | 'INVALIDATED'

export interface SmcSwingConfig {
  enabled: boolean
  /** Bars to the left of the pivot that must be strictly dominated. */
  pivotLeft: number
  /** Future bars required before the swing is confirmed (no look-ahead). */
  pivotRight: number
  /**
   * Equal high/low tolerance as a percent of price.
   * Tie-breaking rule (documented):
   * - A candidate is a Swing High when its high is >= every surrounding high
   *   within equalTolerancePercent (i.e. neighbors may equal within tolerance,
   *   but none may exceed beyond tolerance).
   * - When multiple contiguous candles share an equal extreme within tolerance,
   *   the LEFTMOST (earliest) candle in that plateau is the pivot.
   * - Confirmation still waits for pivotRight closed bars after that pivot.
   */
  equalTolerancePercent: number
}

export interface SmcStructureConfig {
  enabled: boolean
  internalPivotLeft: number
  internalPivotRight: number
  externalPivotLeft: number
  externalPivotRight: number
  minimumExternalProminencePercent: number
  minimumExternalBarsApart: number
}

export interface SmcBosConfig {
  enabled: boolean
  /** Phase 1/2 default: close confirmation. */
  breakMode: 'CLOSE'
  /** Minimum break distance as percent of swing price. */
  minimumBreakPercent: number
  /** Only break the latest eligible confirmed swing of each type. */
  requireLatestConfirmedSwing: boolean
  /** When false, each swing is broken at most once. */
  allowRepeatedBreaksOfSameSwing: boolean
  /** Prefer external swings when structure classification is available. */
  preferExternalSwings: boolean
  structureScope: SmcStructureScope
}

export interface SmcChochConfig {
  enabled: boolean
  breakMode: 'CLOSE'
  minimumBreakPercent: number
  requireLatestConfirmedSwing: boolean
  preferExternalSwings: boolean
  structureScope: SmcStructureScope
  /** Displacement required for a stronger structural shift (profile-dependent). */
  requireDisplacement: boolean
}

export interface SmcDisplacementConfig {
  enabled: boolean
  atrPeriod: number
  minimumBodyAtrMultiple: number
  minimumBodyToRangeRatio: number
  maximumOppositeWickRatio: number
  requireStructureBreak: boolean
  requireFvgCreation: boolean
}

export interface SmcFvgConfig {
  enabled: boolean
  minimumGapPercent: number
  minimumGapAtrMultiple: number
  atrPeriod: number
  requireDisplacementMiddleCandle: boolean
  trackMitigation: boolean
  mitigationMode: SmcFvgMitigationMode
}

export interface SmcEqualLevelsConfig {
  enabled: boolean
  tolerancePercent: number
  minimumTouches: number
  minimumBarsApart: number
  useInternalSwings: boolean
  useExternalSwings: boolean
}

export interface SmcLiquiditySweepConfig {
  enabled: boolean
  structureScope: 'INTERNAL' | 'EXTERNAL' | 'BOTH'
  minimumPenetrationPercent: number
  maximumCloseDistancePercent: number
  requireSameCandleRejection: boolean
  requireDisplacementAfterSweep: boolean
  displacementConfirmationBars: number
  equalLevelTolerancePercent: number
  /** When false (default), a canonical level emits at most one successful sweep. */
  allowRepeatedSweepsOfSameLevel: boolean
}

export interface SmcOrderBlockConfig {
  enabled: boolean
  requireDisplacement: boolean
  requireFvg: boolean
  sourceBreak: SmcOrderBlockSourceBreak
  zoneMode: SmcOrderBlockZoneMode
  searchBackBars: number
  invalidationMode: SmcOrderBlockInvalidationMode
  trackMitigation: boolean
  mitigationMode: 'TOUCH' | 'MIDPOINT' | 'FULL_FILL'
}

export interface SmcDetectorConfig {
  swing: SmcSwingConfig
  structure: SmcStructureConfig
  bos: SmcBosConfig
  choch: SmcChochConfig
  displacement: SmcDisplacementConfig
  fvg: SmcFvgConfig
  equalLevels: SmcEqualLevelsConfig
  liquiditySweep: SmcLiquiditySweepConfig
  orderBlock: SmcOrderBlockConfig
}

/** Typed event reference for dependency chains. */
export interface SmcEventRef {
  id: string
  kind: SmcDetectionKind
}

export interface SmcSwingEvent {
  id: string
  kind: 'SWING_HIGH' | 'SWING_LOW'
  candleIndex: number
  timestamp: number
  price: number
  confirmedAtIndex: number
  confirmedAtTimestamp: number
  leftBars: number
  rightBars: number
  reason: string
  classification?: SmcSwingClassification
  prominence?: number
  surroundingRange?: { high: number; low: number }
  refs?: SmcEventRef[]
}

export interface SmcClassifiedSwingEvent {
  id: string
  kind:
    | 'INTERNAL_SWING_HIGH'
    | 'INTERNAL_SWING_LOW'
    | 'EXTERNAL_SWING_HIGH'
    | 'EXTERNAL_SWING_LOW'
  candleIndex: number
  timestamp: number
  price: number
  confirmedAtIndex: number
  confirmedAtTimestamp: number
  leftBars: number
  rightBars: number
  classification: 'INTERNAL' | 'EXTERNAL'
  originalSwingId: string
  prominence: number
  /** Next-best extreme in the classification window (excludes the pivot itself). */
  nextBestExtreme: number | null
  surroundingRange: { high: number; low: number }
  /** Deterministic external promotion / rejection notes. */
  promotionReason: string
  barsFromPreviousExternal: number | null
  replacedExternalSwingId: string | null
  reason: string
  refs: SmcEventRef[]
}

export interface SmcBosEvent {
  id: string
  kind: 'BULLISH_BOS' | 'BEARISH_BOS'
  /** Break candle index — never the swing index. */
  candleIndex: number
  /** Break candle timestamp — never the swing timestamp. */
  timestamp: number
  closePrice: number
  brokenSwingId: string
  brokenSwingPrice: number
  brokenSwingTimestamp: number
  brokenSwingCandleIndex: number
  brokenSwingConfirmedAtIndex: number
  brokenSwingClassification?: SmcSwingClassification
  structureScope?: SmcStructureScope
  previousStructureState?: SmcStructureState
  newStructureState?: SmcStructureState
  breakAmount: number
  breakPercent: number
  wickHigh: number
  wickLow: number
  wickOnlyIgnored: boolean
  reason: string
  refs: SmcEventRef[]
  ruleChecks?: Record<string, boolean>
}

export interface SmcChochEvent {
  id: string
  kind: 'BULLISH_CHOCH' | 'BEARISH_CHOCH'
  candleIndex: number
  timestamp: number
  closePrice: number
  brokenSwingId: string
  brokenSwingPrice: number
  brokenSwingTimestamp: number
  brokenSwingCandleIndex: number
  brokenSwingConfirmedAtIndex: number
  brokenSwingClassification: SmcSwingClassification
  structureScope: SmcStructureScope
  previousStructureState: SmcStructureState
  newProvisionalStructureState: SmcStructureState
  breakAmount: number
  breakPercent: number
  wickHigh: number
  wickLow: number
  reason: string
  refs: SmcEventRef[]
  ruleChecks: Record<string, boolean>
}

export interface SmcDisplacementEvent {
  id: string
  kind: 'BULLISH_DISPLACEMENT' | 'BEARISH_DISPLACEMENT'
  candleIndex: number
  timestamp: number
  /** Close of the displacement candle — for display; never fabricated. */
  closePrice: number
  bodySize: number
  fullRange: number
  atr: number
  bodyAtrMultiple: number
  bodyToRangeRatio: number
  upperWick: number
  lowerWick: number
  structureBreakId: string | null
  fvgId: string | null
  reason: string
  refs: SmcEventRef[]
}

export interface SmcFvgEvent {
  id: string
  kind:
    | 'BULLISH_FVG_CREATED'
    | 'BEARISH_FVG_CREATED'
    | 'FVG_TOUCHED'
    | 'FVG_HALF_FILLED'
    | 'FVG_FULLY_FILLED'
    | 'FVG_INVALIDATED'
  candleIndex: number
  timestamp: number
  fvgId: string
  direction: 'BULLISH' | 'BEARISH'
  candleIndices: [number, number, number]
  createdTimestamp: number
  upperBoundary: number
  lowerBoundary: number
  midpoint: number
  gapSize: number
  gapPercent: number
  gapAtrMultiple: number
  state: SmcZoneState
  firstMitigationTimestamp: number | null
  invalidationTimestamp: number | null
  displacementId: string | null
  reason: string
  refs: SmcEventRef[]
}

export interface SmcEqualLevelEvent {
  id: string
  kind: 'EQUAL_HIGHS' | 'EQUAL_LOWS'
  candleIndex: number
  timestamp: number
  level: number
  minMemberPrice: number
  maxMemberPrice: number
  firstTimestamp: number
  latestTimestamp: number
  touchCount: number
  memberSwingIds: string[]
  reason: string
  refs: SmcEventRef[]
}

export interface SmcLiquiditySweepEvent {
  id: string
  kind: 'BUY_SIDE_LIQUIDITY_SWEEP' | 'SELL_SIDE_LIQUIDITY_SWEEP'
  candleIndex: number
  timestamp: number
  sweptSwingIds: string[]
  /** Canonical liquidity group id after equal/nearby merge. */
  canonicalLevelId: string
  sweptLevel: number
  wickExtreme: number
  close: number
  penetration: number
  penetrationPercent: number
  closeBackDistance: number
  closeBackDistancePercent: number
  structuralScope: 'INTERNAL' | 'EXTERNAL' | 'BOTH'
  displacementId: string | null
  equalLevelId: string | null
  reason: string
  refs: SmcEventRef[]
  ruleChecks: Record<string, boolean>
}

export interface SmcLiquiditySweepDiagnostics {
  rawSweepCandidates: number
  canonicalLevelsConsidered: number
  duplicateSweepsSuppressed: number
  consumedLevelAttemptsIgnored: number
  validUniqueSweeps: number
}

export interface SmcOrderBlockEvent {
  id: string
  kind:
    | 'BULLISH_ORDER_BLOCK_CREATED'
    | 'BEARISH_ORDER_BLOCK_CREATED'
    | 'ORDER_BLOCK_TOUCHED'
    | 'ORDER_BLOCK_MITIGATED'
    | 'ORDER_BLOCK_INVALIDATED'
  candleIndex: number
  timestamp: number
  orderBlockId: string
  direction: 'BULLISH' | 'BEARISH'
  sourceCandleIndex: number
  sourceCandleTimestamp: number
  zoneHigh: number
  zoneLow: number
  midpoint: number
  createdTimestamp: number
  firstRetestTimestamp: number | null
  mitigationStatus: SmcZoneState
  invalidationStatus: boolean
  sourceBreakId: string
  sourceBreakKind: SmcDetectionKind
  sourceDisplacementId: string | null
  sourceFvgId: string | null
  reason: string
  refs: SmcEventRef[]
  eventChain: SmcEventRef[]
}

export interface SmcInvariantCounts {
  invalidBullishBosCount: number
  invalidBearishBosCount: number
  bosBeforeConfirmationCount: number
  repeatedSwingBreakCount: number
  invalidBullishChochCount: number
  invalidBearishChochCount: number
  chochWithoutPriorStructureCount: number
  /** BOS and CHoCH emitted for the same swing under one profile. */
  duplicateBreakOfSameSwingCount: number
  fvgInvalidGeometryCount: number
  sweepWithoutPenetrationCount: number
  sweepWithoutCloseReclaimCount: number
  repeatedConsumedLevelSweepCount: number
  orderBlockAfterSourceBreakCount: number
  orderBlockWithoutRequiredDisplacementCount: number
  orderBlockWithoutRequiredFvgCount: number
  dependencyReferenceMissingCount: number
  eventTimestampMismatchCount: number
  artificialZeroDisplayValueCount: number
}

export interface SmcStructureBreakCounts {
  internalBullishBos: number
  internalBearishBos: number
  externalBullishBos: number
  externalBearishBos: number
  unclassifiedBullishBos: number
  unclassifiedBearishBos: number
  internalBullishChoch: number
  internalBearishChoch: number
  externalBullishChoch: number
  externalBearishChoch: number
  unclassifiedBullishChoch: number
  unclassifiedBearishChoch: number
}

export interface SmcDiagnosticsSummary {
  candleCount: number
  uniqueReviewableEvents: number
  lifecycleUpdates: number
  visibleEvents: number
  totalEvents: number
  externalSwings: number
  internalSwings: number
  externalBos: number
  internalBos: number
  externalChoch: number
  internalChoch: number
  liquidityLevels: number
  rawSweepCandidates: number
  uniqueValidSweeps: number
  duplicateSweepsSuppressed: number
  consumedAttemptsIgnored: number
  invariantFailures: number
}

export interface SmcModuleTiming {
  module: string
  durationMs: number
  status: 'complete' | 'skipped' | 'failed'
}

export interface SmcDetectionDiagnostics {
  detectorVersion: string
  candleCount: number
  visibleThroughIndex: number | null
  swingCandidatesConsidered: number
  confirmedSwings: number
  internalSwings: number
  externalSwings: number
  wickOnlyBreakCandidatesIgnored: number
  validBosEvents: number
  validChochEvents: number
  displacementEvents: number
  /** Unique FVG zones created (not lifecycle updates). */
  fvgEvents: number
  equalLevelEvents: number
  /** Unique valid sweeps after canonical dedup. */
  liquiditySweepEvents: number
  /** Unique Order Block zones created (not lifecycle updates). */
  orderBlockEvents: number
  repeatedBreaksIgnored: number
  computationDurationMs: number
  moduleTimings: SmcModuleTiming[]
  maxBlockingDurationMs: number
  structureState: SmcStructureState
  detectionStatus: 'COMPLETE' | 'FAILED' | 'CANCELLED' | 'IDLE'
  structureBreakCounts: SmcStructureBreakCounts
  liquiditySweepDiagnostics: SmcLiquiditySweepDiagnostics
  eventCountBreakdown: {
    uniqueReviewableEvents: number
    lifecycleUpdates: number
    totalEvents: number
    primaryDetectionEvents: number
    fvgCreated: number
    fvgTouched: number
    fvgHalfFilled: number
    fvgFullyFilled: number
    fvgInvalidated: number
    uniqueFvgZones: number
    orderBlockCreated: number
    orderBlockTouched: number
    orderBlockMitigated: number
    orderBlockInvalidated: number
    uniqueOrderBlockZones: number
    explanation: string
  }
  summary: SmcDiagnosticsSummary
  /** Present after pipeline invariant audit. All must be 0 for a complete result. */
  invariants?: SmcInvariantCounts & { ok: boolean }
  invariantDetails?: string[]
  /** Intelligence ranking diagnostics (post-detector). */
  ranking?: SmcRankingDiagnostics
  /** Dow Theory derived diagnostics (post swing classification). */
  dowTheory?: SmcDowTheoryDiagnostics
}

export interface SmcDetectionResult {
  swings: SmcSwingEvent[]
  classifiedSwings: SmcClassifiedSwingEvent[]
  bosEvents: SmcBosEvent[]
  chochEvents: SmcChochEvent[]
  displacementEvents: SmcDisplacementEvent[]
  fvgEvents: SmcFvgEvent[]
  equalLevelEvents: SmcEqualLevelEvent[]
  liquiditySweepEvents: SmcLiquiditySweepEvent[]
  orderBlockEvents: SmcOrderBlockEvent[]
  structureState: SmcStructureState
  diagnostics: SmcDetectionDiagnostics
  /**
   * Post-detector intelligence layer. Never mutates detector algorithms —
   * scores and visibility only. Absent until ranking is applied.
   */
  intelligence?: SmcIntelligenceLayer
  /**
   * Dow Theory derived layer. Consumes classified swings only —
   * never mutates detector swing objects. Absent until pipeline runs Dow Theory.
   */
  dowTheory?: SmcDowTheoryLayer
}

export type SmcEvent =
  | SmcSwingEvent
  | SmcClassifiedSwingEvent
  | SmcBosEvent
  | SmcChochEvent
  | SmcDisplacementEvent
  | SmcFvgEvent
  | SmcEqualLevelEvent
  | SmcLiquiditySweepEvent
  | SmcOrderBlockEvent

export type { Candle }

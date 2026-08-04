/**
 * QuantLab Setup Engine v1 — typed contracts.
 * Pure consumer of detector / Dow / QML / lifecycle outputs.
 * Never detects structure.
 */

import type { Candle } from '@/data/candles'
import type { SmcDowTheoryLayer } from '@/core/smc/dow-theory/types'
import type { SmcZoneProjection } from '@/core/smc/lifecycle/types'
import type { QmlPattern, SmcQmlLayer } from '@/core/smc/qml/qml-types'
import type { SmcDetectionResult } from '@/core/smc/types'

export const SETUP_ENGINE_VERSION = '1.0.0-phase8'

/** v1 supported setup types (+ reserved future ids for extensibility). */
export type SetupType =
  | 'BULLISH_CONTINUATION'
  | 'BEARISH_CONTINUATION'
  | 'BULLISH_REVERSAL'
  | 'BEARISH_REVERSAL'
  | 'BULLISH_QML'
  | 'BEARISH_QML'
  // Future (reserved — not evaluated in v1)
  | 'BREAKER'
  | 'MITIGATION'
  | 'SMT'
  | 'TURTLE_SOUP'
  | 'LIQUIDITY_GRAB'

export type SetupDirection = 'BULLISH' | 'BEARISH'

export type SetupStatus =
  | 'WATCHING'
  | 'WAITING_RETEST'
  | 'READY'
  | 'INVALIDATED'
  | 'COMPLETED'
  | 'EXPIRED'

export type SetupCheckName =
  | 'Trend'
  | 'Dow Theory'
  | 'Structure'
  | 'BOS'
  | 'CHOCH'
  | 'Liquidity'
  | 'Sweep'
  | 'Displacement'
  | 'FVG'
  | 'OB'
  | 'Zone Lifecycle'
  | 'Retest'
  | 'QML'
  | 'Freshness'
  | 'Conflict'

export interface SetupCheck {
  name: SetupCheckName
  passed: boolean
  required: boolean
  reason: string
  sourceIds: string[]
}

export interface SetupScoreReason {
  id: string
  label: string
  delta: number
  reason: string
}

export interface SetupStrength {
  /** Quality score 0–100 (not probability). */
  score: number
  reasons: SetupScoreReason[]
}

export interface SetupEntryZone {
  low: number
  high: number
  sourceKind: 'ORDER_BLOCK' | 'FVG' | 'QML' | 'STRUCTURE'
  sourceId: string
}

export interface SetupStopReference {
  level: number
  reason: string
  sourceId: string | null
}

export interface SetupTargetCandidate {
  level: number
  label: string
  sourceId: string | null
}

export interface SetupEventRef {
  id: string
  kind: string
  role: string
}

export interface TradingSetup {
  id: string
  setupType: SetupType
  direction: SetupDirection
  status: SetupStatus
  strength: SetupStrength
  trendContext: string
  entryZone: SetupEntryZone | null
  stopReference: SetupStopReference | null
  targetCandidates: SetupTargetCandidate[]
  requiredChecks: SetupCheck[]
  optionalChecks: SetupCheck[]
  missingChecks: string[]
  eventChain: SetupEventRef[]
  warnings: string[]
  reason: string
  /** Candle index when the setup became knowable. */
  createdIndex: number
  /** Latest lifecycle transition index knowable at evaluation. */
  updatedIndex: number
  riskNotes: string[]
  /** Suggested primary target (first candidate), if any. */
  suggestedTarget: number | null
  conflictIds: string[]
}

export interface SetupConflict {
  id: string
  kind:
    | 'BULL_AND_BEAR'
    | 'TREND_MISMATCH'
    | 'EXPIRED_ZONE'
    | 'INVALID_OB'
    | 'MITIGATED_FVG'
  reason: string
  setupIds: string[]
  sourceIds: string[]
}

export type SetupSummaryStance = 'BUY READY' | 'SELL READY' | 'WAIT' | 'No Setup'

export interface SetupSummary {
  stance: SetupSummaryStance
  highestRanked: TradingSetup | null
  buyReadyCount: number
  sellReadyCount: number
  watchingCount: number
  waitingRetestCount: number
  invalidatedCount: number
  expiredCount: number
  completedCount: number
  strength: number | null
  reason: string
  missingConditions: string[]
  conflictCount: number
}

export interface SetupDiagnostics {
  created: number
  watching: number
  waitingRetest: number
  ready: number
  completed: number
  expired: number
  invalidated: number
  averageStrength: number
  conflictCount: number
  missingConditionCounts: Record<string, number>
  byType: Partial<Record<SetupType, number>>
  invariantFailures: number
  invariantDetails: string[]
  durationMs: number
  ok: boolean
}

export type SetupReviewVerdict = 'correct' | 'wrong' | 'unsure'

export interface SetupReviewRecord {
  setupId: string
  setupType: SetupType
  direction: SetupDirection
  statusAtReview: SetupStatus
  verdict: SetupReviewVerdict
  note: string
  reviewedAt: number
}

export interface SetupValidationMetrics {
  reviewedCount: number
  correctCount: number
  wrongCount: number
  unsureCount: number
  precision: number | null
  recall: number | null
  agreement: number | null
  falseReady: number
  falseReject: number
}

export interface SetupEngineConfig {
  /** Max age (candles) for a zone to count as fresh. */
  freshnessMaxAgeCandles: number
  /** Prefer external structure for continuation / reversal. */
  preferExternalStructure: boolean
  /** Emit QML setups when QML layer is available. */
  enableQmlSetups: boolean
  /** Emit continuation setups. */
  enableContinuation: boolean
  /** Emit CHOCH reversal setups. */
  enableReversal: boolean
  /** Max bars after BOS/CHOCH to still consider a setup. */
  setupMaxAgeCandles: number
  /** Require retest for READY status on continuation/reversal. */
  requireRetestForReady: boolean
}

export const DEFAULT_SETUP_ENGINE_CONFIG: SetupEngineConfig = {
  freshnessMaxAgeCandles: 80,
  preferExternalStructure: true,
  enableQmlSetups: true,
  enableContinuation: true,
  enableReversal: true,
  setupMaxAgeCandles: 120,
  requireRetestForReady: true,
}

export interface EvaluateSetupsInput {
  candles: readonly Candle[]
  detection: SmcDetectionResult
  visibleIndex: number
  dowTheory?: SmcDowTheoryLayer | null
  qml?: SmcQmlLayer | null
  lifecycleZones?: readonly SmcZoneProjection[]
  config?: Partial<SetupEngineConfig> | null
}

export interface SetupEngineResult {
  version: string
  visibleIndex: number
  setups: TradingSetup[]
  rankedSetupIds: string[]
  summary: SetupSummary
  diagnostics: SetupDiagnostics
  conflicts: SetupConflict[]
  /** QML patterns consumed (progressive / rewound). */
  qmlPatterns: QmlPattern[]
  durationMs: number
}

/** v1 evaluated types only. */
export const SETUP_TYPES_V1: readonly SetupType[] = [
  'BULLISH_CONTINUATION',
  'BEARISH_CONTINUATION',
  'BULLISH_REVERSAL',
  'BEARISH_REVERSAL',
  'BULLISH_QML',
  'BEARISH_QML',
] as const

export const FUTURE_SETUP_TYPES: readonly SetupType[] = [
  'BREAKER',
  'MITIGATION',
  'SMT',
  'TURTLE_SOUP',
  'LIQUIDITY_GRAB',
] as const

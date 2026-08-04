import type { Candle } from '../../data/candles.js'
import type { BacktestReport } from '../analytics/types.js'
import type { MovingAverageCrossParams } from '../strategy/MovingAverageCrossStrategy.js'
import type { RandomSearchPerfDiagnostics } from './cooperative-schedule.js'
import type { RandomSearchRunControls } from './run-controls.js'

export type ScoringObjective =
  | 'netProfit'
  | 'profitFactor'
  | 'winRate'
  | 'expectancy'

export interface ParameterRange {
  name: keyof MovingAverageCrossParams
  min: number
  max: number
  step: number
}

export interface RandomSearchConstraints {
  /** Maximum allowed max-drawdown ratio (e.g. 0.2 = 20%). */
  maxDrawdown?: number
  minimumTrades?: number
  minimumProfitFactor?: number
}

/** Stage budget ratios — must sum to 1. Isolated typed configuration. */
export interface AdaptiveStageBudget {
  explorationRatio: number
  refinementRatio: number
  stabilityRatio: number
}

export const DEFAULT_STAGE_BUDGET: AdaptiveStageBudget = {
  explorationRatio: 0.4,
  refinementRatio: 0.4,
  stabilityRatio: 0.2,
}

export type SearchPresetId = 'conservative' | 'balanced' | 'aggressive' | 'custom'

export interface RandomSearchConfig {
  iterations: number
  parameterRanges: ParameterRange[]
  objective: ScoringObjective
  constraints?: RandomSearchConstraints
  /** RNG seed for deterministic tests. */
  seed?: number
  symbol: string
  interval: string
  /**
   * Legacy candle-count hint / per-page size. Calendar research uses
   * startDate/endDate; limit must not silently truncate the period.
   */
  limit: number
  /** Inclusive research window start (ms). */
  startDate?: number
  /** Inclusive research window end (ms). */
  endDate?: number
  initialCapital: number
  commissionPercent?: number
  positionSizePercent?: number
  /**
   * Strategy Lab parameters used for the pre-search baseline backtest.
   * Defaults to DEFAULT_MA_CROSS_PARAMS when omitted.
   */
  baselineParameters?: MovingAverageCrossParams
  /** Multi-stage budget. Defaults to DEFAULT_STAGE_BUDGET. */
  stageBudget?: AdaptiveStageBudget
  /** Off by default — report plateau without early stop. */
  autoStopOnConverge?: boolean
  /** Candidates without meaningful improvement before plateau signal. */
  plateauUniqueWindow?: number
  /** Relative score epsilon for “meaningful” improvement (default 0.01 = 1%). */
  plateauEpsilon?: number
  searchPreset?: SearchPresetId
}

export type ResearchSessionStatus =
  | 'idle'
  | 'running'
  | 'completed'
  | 'cancelled'
  | 'failed'
  | 'partial'

/** Live optimizer statuses emitted via RandomSearchProgress. */
export type RandomSearchLiveStatus =
  | 'INITIALIZING'
  | 'BASELINE'
  | 'EXPLORING'
  | 'REFINING'
  | 'STABILITY_CHECK'
  | 'IMPROVING'
  | 'PLATEAUING'
  | 'CONVERGED'
  | 'FINALIZING'
  | 'COMPLETED'
  | 'PAUSING'
  | 'PAUSED'
  | 'CANCELLING'
  | 'CANCELLED'
  | 'FAILED'

export type OptimizationStageId =
  | 'baseline'
  | 'exploration'
  | 'refinement'
  | 'stability'

export type CandidateRejectionReason =
  | 'minimum_trades'
  | 'max_drawdown'
  | 'minimum_profit_factor'
  | 'invalid_parameter_ordering'
  | 'non_finite_analytics'
  | 'duplicate_candidate'
  | 'space_exhausted'

export interface RandomSearchCandidate {
  id: string
  parameters: MovingAverageCrossParams
  score: number
  passedConstraints: boolean
  report: BacktestReport
  backtestId: string
  /** Stage that generated this candidate. */
  stage?: OptimizationStageId
  /** Canonical fingerprint for uniqueness. */
  fingerprint?: string
  rejectionReasons?: CandidateRejectionReason[]
}

/**
 * Typed live progress payload for Random Search / Adaptive Search.
 * Ephemeral UI signal only — does not create or update Research Sessions.
 */
export interface RandomSearchProgress {
  totalCandidates: number
  candidatesTested: number
  candidatesAccepted: number
  candidatesRejected: number
  currentCandidateScore: number | null
  bestScore: number | null
  /** Trade count of the current best candidate (not a sum across candidates). */
  bestTradeCount: number | null
  bestCandidateParameters: MovingAverageCrossParams | null
  improvementsCount: number
  candidatesSinceLastImprovement: number | null
  /**
   * Active research time excluding paused duration.
   * Used for ETA so pauses do not inflate remaining estimates.
   */
  elapsedMs: number
  /** Wall-clock time since search start (includes pauses). */
  wallElapsedMs: number
  /** Cumulative time spent in PAUSED. */
  pausedMs: number
  estimatedRemainingMs: number | null
  status: RandomSearchLiveStatus
  /** Active optimization stage. */
  stage?: OptimizationStageId | null
  stageBudgets?: StageBudgetProgress
  uniqueCandidates?: number
  duplicatesSkipped?: number
  generatedCandidates?: number
  baselineScore?: number | null
  rawBestScore?: number | null
  recommendedScore?: number | null
  rejectionReasonCounts?: Partial<Record<CandidateRejectionReason, number>>
  plateauDetected?: boolean
  lastImprovementEvent?: ImprovementEvent | null
  newBestEvent?: NewBestEvent | null
}

export interface StageBudgetProgress {
  baseline: { completed: boolean }
  exploration: { done: number; total: number }
  refinement: { done: number; total: number }
  stability: { done: number; total: number }
}

export interface NewBestEvent {
  previousScore: number | null
  score: number
  previousProfitFactor: number | null
  profitFactor: number
  previousMaxDrawdown: number | null
  maxDrawdown: number
  previousTradeCount: number | null
  tradeCount: number
  stage: OptimizationStageId
  atMs: number
}

export interface ImprovementEvent {
  candidateIndex: number
  candidateId: string
  stage: OptimizationStageId
  score: number
  parameters: MovingAverageCrossParams
  netProfit: number
  profitFactor: number
  maxDrawdown: number
  winRate: number
  tradeCount: number
  elapsedMs: number
}

/** Baseline snapshot from the Strategy Lab parameters on the shared candle dataset. */
export interface OptimizationBaseline {
  parameters: MovingAverageCrossParams
  report: BacktestReport
  /** Objective score (same metric as candidates). */
  score: number
  researchRating: ResearchRating
  tradeCount: number
  netProfit: number
  profitFactor: number
  maxDrawdown: number
  winRate: number
  expectancy: number
  backtestId: string
}

export type StabilityLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT_EVIDENCE'

export interface ParameterStabilityDetail {
  name: keyof MovingAverageCrossParams
  label: string
  level: StabilityLevel
  neighborhoodCount: number
  valueRangeLabel: string | null
  reason: string
}

export interface StabilityResult {
  overall: StabilityLevel
  stableParameters: ParameterStabilityDetail[]
  sensitiveParameters: ParameterStabilityDetail[]
  neighborhoodSampleCount: number
  medianNearbyScore: number | null
  worstNearbyScore: number | null
  scoreDispersion: number | null
  nearbyPassRate: number | null
  summary: string
}

export type PlateauReason =
  | 'no_improvement_window'
  | 'epsilon_flat'
  | 'high_duplicate_rate'
  | 'space_exhausted'
  | 'none'

export interface PlateauResult {
  detected: boolean
  reason: PlateauReason
  detail: string
  continued: boolean
  uniqueSinceImprovement: number
}

export type OptimizationVerdict =
  | 'Meaningfully Improved'
  | 'Improved but Unstable'
  | 'No Meaningful Improvement'
  | 'Insufficient Evidence'
  | 'Constraints Not Met'

export interface MetricChange {
  key: string
  label: string
  before: number
  after: number
  /** Explicit direction used for “improved” wording. */
  direction: 'higher_better' | 'lower_better' | 'context'
  improved: boolean | null
  text: string
}

export interface ParameterChange {
  name: keyof MovingAverageCrossParams
  label: string
  before: number
  after: number
}

export interface RecommendationDecision {
  rawBestCandidateId: string | null
  recommendedCandidateId: string | null
  ruleId: 'raw_best' | 'stable_neighborhood' | 'larger_sample' | 'none_eligible'
  explanation: string
}

export interface OptimizationResultSummary {
  baseline: OptimizationBaseline | null
  rawBestCandidateId: string | null
  recommendedCandidateId: string | null
  recommendation: RecommendationDecision
  stability: StabilityResult | null
  plateau: PlateauResult | null
  verdict: OptimizationVerdict
  verdictDetail: string
  improvements: ImprovementEvent[]
  metricChanges: MetricChange[]
  parameterChanges: ParameterChange[]
  searchExplanation: {
    stagesCompleted: OptimizationStageId[]
    candidatesEvaluated: number
    uniqueCandidates: number
    duplicatesSkipped: number
    generatedCandidates: number
    duplicateRate: number
    improvementCount: number
    lastImprovement: ImprovementEvent | null
    plateauDetail: string | null
    stabilitySummary: string | null
    spaceExhausted: boolean
  }
  rejectionReasonCounts: Partial<Record<CandidateRejectionReason, number>>
  datasetCandleCount: number
  datasetStartMs: number | null
  datasetEndMs: number | null
  /** True when Stage C did not finish (partial / cancelled). */
  stabilityIncomplete: boolean
  schemaVersion: number
}

export const OPTIMIZATION_RESULT_SCHEMA_VERSION = 1

export interface ResearchSession {
  id: string
  status: ResearchSessionStatus
  config: RandomSearchConfig
  candidates: RandomSearchCandidate[]
  bestCandidateId: string | null
  error: string | null
  createdAt: number
  completedAt: number | null
  progress: RandomSearchProgress
  /** Pre-search baseline on the shared candle dataset. */
  baseline?: OptimizationBaseline | null
  improvementTimeline?: ImprovementEvent[]
  rawBestCandidateId?: string | null
  recommendedCandidateId?: string | null
  optimizationResult?: OptimizationResultSummary | null
  /** Seed actually used (resolved). */
  resolvedSeed?: number
  /**
   * True when this session was saved via "Save partial result" after Cancel.
   * Completed successful runs leave this undefined/false.
   */
  partial?: boolean
}

export interface ResearchReport {
  sessionId: string
  status: ResearchSessionStatus
  objective: ScoringObjective
  iterationsRequested: number
  iterationsCompleted: number
  candidatesEvaluated: number
  candidatesPassingConstraints: number
  bestCandidate: RandomSearchCandidate | null
  topCandidates: RandomSearchCandidate[]
  config: RandomSearchConfig
  error: string | null
  createdAt: number
  completedAt: number | null
  /**
   * Presentation narrative packaged from existing BacktestReport fields.
   * Not a separate analytics engine — no new metric formulas.
   */
  analysis: ResearchAnalysisNarrative
  /** Adaptive optimization explanation (absent on legacy sessions). */
  optimization?: OptimizationResultSummary | null
  /** Recommended candidate when distinct from raw best. */
  recommendedCandidate?: RandomSearchCandidate | null
  rawBestCandidate?: RandomSearchCandidate | null
  baseline?: OptimizationBaseline | null
  /** Mirrors session.partial for UI labeling. */
  partial?: boolean
}

export type ResearchRiskLevel = 'low' | 'moderate' | 'elevated' | 'high'
export type ResearchRating = 'poor' | 'mixed' | 'fair' | 'strong' | 'inconclusive'

export interface ResearchAnalysisNarrative {
  summary: string
  strengths: string[]
  weaknesses: string[]
  suggestions: string[]
  riskLevel: ResearchRiskLevel
  rating: ResearchRating
}

export interface PauseController {
  readonly paused: boolean
  pause: () => void
  resume: () => void
  /** Resolves when not paused (or immediately). */
  waitIfPaused: () => Promise<void>
}

export interface RunRandomSearchOptions {
  config: RandomSearchConfig
  candles: Candle[]
  onProgress?: (progress: RandomSearchProgress) => void
  signal?: AbortSignal
  /** Pause / resume / cancel gates (optional — tests may omit). */
  controls?: RandomSearchRunControls
  /** Legacy pause gate used by older tests; prefer `controls`. */
  pauseController?: PauseController
  /**
   * Injectable browser yield (tests). Defaults to `yieldToBrowser`
   * (`scheduler.yield` or `setTimeout(0)` — not microtask-only).
   */
  yieldFn?: () => Promise<void>
  /** Force a fixed candidate batch size between yields (disables adaptation). */
  cooperativeBatchSize?: number
  /** When true, emit/log perf diagnostics even outside DEV. */
  enablePerfDiagnostics?: boolean
  onPerfDiagnostics?: (diagnostics: RandomSearchPerfDiagnostics) => void
}

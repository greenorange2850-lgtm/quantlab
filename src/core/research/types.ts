import type { Candle } from '../../data/candles.js'
import type { BacktestReport } from '../analytics/types.js'
import type { MovingAverageCrossParams } from '../strategy/MovingAverageCrossStrategy.js'
import type { RandomSearchPerfDiagnostics } from './cooperative-schedule.js'

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
}

export type ResearchSessionStatus =
  | 'idle'
  | 'running'
  | 'completed'
  | 'cancelled'
  | 'failed'

/** Live optimizer statuses emitted via RandomSearchProgress (distinct from session status). */
export type RandomSearchLiveStatus =
  | 'INITIALIZING'
  | 'EXPLORING'
  | 'IMPROVING'
  | 'PLATEAUING'
  | 'FINALIZING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'

export interface RandomSearchCandidate {
  id: string
  parameters: MovingAverageCrossParams
  score: number
  passedConstraints: boolean
  report: BacktestReport
  backtestId: string
}

/**
 * Typed live progress payload for Random Search.
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
  elapsedMs: number
  estimatedRemainingMs: number | null
  status: RandomSearchLiveStatus
}

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

export interface RunRandomSearchOptions {
  config: RandomSearchConfig
  candles: Candle[]
  onProgress?: (progress: RandomSearchProgress) => void
  signal?: AbortSignal
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


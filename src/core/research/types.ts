import type { Candle } from '../../data/candles.js'
import type { BacktestReport } from '../analytics/types.js'
import type { MovingAverageCrossParams } from '../strategy/MovingAverageCrossStrategy.js'

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
  limit: number
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

export interface RandomSearchCandidate {
  id: string
  parameters: MovingAverageCrossParams
  score: number
  passedConstraints: boolean
  report: BacktestReport
  backtestId: string
}

export interface RandomSearchProgress {
  completed: number
  total: number
  bestScore: number | null
  status: ResearchSessionStatus
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
}

export interface RunRandomSearchOptions {
  config: RandomSearchConfig
  candles: Candle[]
  onProgress?: (progress: RandomSearchProgress) => void
  signal?: AbortSignal
}

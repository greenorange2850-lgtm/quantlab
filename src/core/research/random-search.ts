import { runBacktestPipeline } from '../dashboard/run-backtest-pipeline.js'
import { DEFAULT_MA_CROSS_PARAMS } from '../strategy/MovingAverageCrossStrategy.js'
import type { MovingAverageCrossParams } from '../strategy/MovingAverageCrossStrategy.js'
import {
  buildProgressPayload,
  createEmptyProgress,
  deriveLiveSearchStatus,
} from './progress.js'
import { sampleStrategyParams, validateRandomSearchConfig } from './sampling.js'
import { passesConstraints, scoreFromReport } from './scoring.js'
import type {
  RandomSearchCandidate,
  RandomSearchProgress,
  ResearchSession,
  RunRandomSearchOptions,
} from './types.js'

function createSessionId(): string {
  return `rs-${Date.now()}`
}

function createCandidateId(index: number): string {
  return `cand-${index}-${Date.now()}`
}

type ProgressTracker = {
  totalCandidates: number
  candidatesTested: number
  candidatesAccepted: number
  candidatesRejected: number
  currentCandidateScore: number | null
  bestScore: number | null
  bestTradeCount: number | null
  bestCandidateParameters: MovingAverageCrossParams | null
  improvementsCount: number
  candidatesSinceLastImprovement: number | null
  justImproved: boolean
}

function snapshotProgress(
  tracker: ProgressTracker,
  status: RandomSearchProgress['status'],
  startedAtMs: number,
  nowMs: number = Date.now(),
): RandomSearchProgress {
  return buildProgressPayload(
    {
      ...tracker,
      status,
    },
    startedAtMs,
    nowMs,
  )
}

/**
 * Random Search research engine.
 * Reuses `runBacktestPipeline` + existing `BacktestReport` metrics for scoring.
 * Does not implement a second backtest/analytics engine.
 *
 * Live progress is ephemeral: FINALIZING is emitted before return on success.
 * COMPLETED is reserved for the store after the Research Session is persisted.
 */
export async function runRandomSearch(
  options: RunRandomSearchOptions,
): Promise<ResearchSession> {
  const { config, candles, onProgress, signal } = options
  const issues = validateRandomSearchConfig({
    iterations: config.iterations,
    parameterRanges: config.parameterRanges,
  })

  const startedAtMs = Date.now()
  const tracker: ProgressTracker = {
    totalCandidates: config.iterations,
    candidatesTested: 0,
    candidatesAccepted: 0,
    candidatesRejected: 0,
    currentCandidateScore: null,
    bestScore: null,
    bestTradeCount: null,
    bestCandidateParameters: null,
    improvementsCount: 0,
    candidatesSinceLastImprovement: null,
    justImproved: false,
  }

  const session: ResearchSession = {
    id: createSessionId(),
    status: 'running',
    config,
    candidates: [],
    bestCandidateId: null,
    error: null,
    createdAt: startedAtMs,
    completedAt: null,
    progress: createEmptyProgress(config.iterations),
  }

  const emit = (status: RandomSearchProgress['status']) => {
    session.progress = snapshotProgress(tracker, status, startedAtMs)
    onProgress?.({ ...session.progress })
  }

  if (issues.length > 0) {
    session.status = 'failed'
    session.error = issues.map((issue) => issue.message).join('; ')
    session.completedAt = Date.now()
    emit('FAILED')
    return session
  }

  if (!candles.length) {
    session.status = 'failed'
    session.error = 'Candles are required for Random Search'
    session.completedAt = Date.now()
    emit('FAILED')
    return session
  }

  // Initial progress before the first candidate.
  emit('INITIALIZING')

  let bestScore = Number.NEGATIVE_INFINITY
  let bestId: string | null = null
  const baseSeed = config.seed ?? Date.now()

  try {
    for (let i = 0; i < config.iterations; i++) {
      if (signal?.aborted) {
        session.status = 'cancelled'
        session.completedAt = Date.now()
        emit('CANCELLED')
        return session
      }

      const parameters = sampleStrategyParams(config.parameterRanges, baseSeed + i)
      const pipelineResult = await runBacktestPipeline({
        symbol: config.symbol,
        interval: config.interval,
        limit: config.limit,
        initialCapital: config.initialCapital,
        commissionPercent: config.commissionPercent ?? 0.1,
        positionSizePercent: config.positionSizePercent ?? 100,
        candles,
        strategyParams: parameters,
        strategyVersion: `rs-${parameters.fastPeriod}-${parameters.slowPeriod}-${parameters.rsiPeriod}`,
      })

      const score = scoreFromReport(pipelineResult.report, config.objective)
      const passed = passesConstraints(pipelineResult.report, config.constraints)
      const candidateParams =
        pipelineResult.strategyParams ?? { ...DEFAULT_MA_CROSS_PARAMS, ...parameters }
      const candidate: RandomSearchCandidate = {
        id: createCandidateId(i),
        parameters: candidateParams,
        score,
        passedConstraints: passed,
        report: pipelineResult.report,
        backtestId: pipelineResult.backtestId,
      }

      session.candidates.push(candidate)

      tracker.candidatesTested = i + 1
      tracker.currentCandidateScore = score
      tracker.justImproved = false

      if (passed) {
        tracker.candidatesAccepted += 1
      } else {
        tracker.candidatesRejected += 1
      }

      if (passed && score > bestScore) {
        bestScore = score
        bestId = candidate.id
        session.bestCandidateId = bestId
        tracker.bestScore = bestScore
        tracker.bestTradeCount = candidate.report.summary.totalTrades
        tracker.bestCandidateParameters = { ...candidate.parameters }
        tracker.improvementsCount += 1
        tracker.candidatesSinceLastImprovement = 0
        tracker.justImproved = true
      } else if (tracker.bestScore !== null) {
        tracker.candidatesSinceLastImprovement =
          (tracker.candidatesSinceLastImprovement ?? 0) + 1
      }

      const liveStatus = deriveLiveSearchStatus({
        tested: tracker.candidatesTested,
        total: tracker.totalCandidates,
        bestScore: tracker.bestScore,
        candidatesSinceLastImprovement: tracker.candidatesSinceLastImprovement,
        justImproved: tracker.justImproved,
      })
      emit(liveStatus)
    }

    // Finalizing before report/session persistence (COMPLETED emitted by store after save).
    session.status = 'completed'
    session.completedAt = Date.now()
    emit('FINALIZING')
    return session
  } catch (error: unknown) {
    if (signal?.aborted) {
      session.status = 'cancelled'
      session.completedAt = Date.now()
      emit('CANCELLED')
      return session
    }

    session.status = 'failed'
    session.error = error instanceof Error ? error.message : 'Random Search failed'
    session.completedAt = Date.now()
    emit('FAILED')
    return session
  }
}

export function getProgressSnapshot(session: ResearchSession): RandomSearchProgress {
  return { ...session.progress }
}

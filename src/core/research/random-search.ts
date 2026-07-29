import { runBacktestPipeline } from '../dashboard/run-backtest-pipeline.js'
import { DEFAULT_MA_CROSS_PARAMS } from '../strategy/MovingAverageCrossStrategy.js'
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

/**
 * Random Search research engine.
 * Reuses `runBacktestPipeline` + existing `BacktestReport` metrics for scoring.
 * Does not implement a second backtest/analytics engine.
 */
export async function runRandomSearch(
  options: RunRandomSearchOptions,
): Promise<ResearchSession> {
  const { config, candles, onProgress, signal } = options
  const issues = validateRandomSearchConfig({
    iterations: config.iterations,
    parameterRanges: config.parameterRanges,
  })

  const session: ResearchSession = {
    id: createSessionId(),
    status: 'running',
    config,
    candidates: [],
    bestCandidateId: null,
    error: null,
    createdAt: Date.now(),
    completedAt: null,
    progress: {
      completed: 0,
      total: config.iterations,
      bestScore: null,
      status: 'running',
    },
  }

  if (issues.length > 0) {
    session.status = 'failed'
    session.error = issues.map((issue) => issue.message).join('; ')
    session.completedAt = Date.now()
    session.progress.status = 'failed'
    onProgress?.(session.progress)
    return session
  }

  if (!candles.length) {
    session.status = 'failed'
    session.error = 'Candles are required for Random Search'
    session.completedAt = Date.now()
    session.progress.status = 'failed'
    onProgress?.(session.progress)
    return session
  }

  let bestScore = Number.NEGATIVE_INFINITY
  let bestId: string | null = null
  const baseSeed = config.seed ?? Date.now()

  try {
    for (let i = 0; i < config.iterations; i++) {
      if (signal?.aborted) {
        session.status = 'cancelled'
        session.progress.status = 'cancelled'
        session.completedAt = Date.now()
        onProgress?.({ ...session.progress })
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
      const candidate: RandomSearchCandidate = {
        id: createCandidateId(i),
        parameters: pipelineResult.strategyParams ?? { ...DEFAULT_MA_CROSS_PARAMS, ...parameters },
        score,
        passedConstraints: passed,
        report: pipelineResult.report,
        backtestId: pipelineResult.backtestId,
      }

      session.candidates.push(candidate)

      if (passed && score > bestScore) {
        bestScore = score
        bestId = candidate.id
        session.bestCandidateId = bestId
      }

      session.progress = {
        completed: i + 1,
        total: config.iterations,
        bestScore: bestId ? bestScore : null,
        status: 'running',
      }
      onProgress?.({ ...session.progress })
    }

    session.status = 'completed'
    session.progress.status = 'completed'
    session.completedAt = Date.now()
    onProgress?.({ ...session.progress })
    return session
  } catch (error: unknown) {
    if (signal?.aborted) {
      session.status = 'cancelled'
      session.progress.status = 'cancelled'
      session.completedAt = Date.now()
      onProgress?.({ ...session.progress })
      return session
    }

    session.status = 'failed'
    session.progress.status = 'failed'
    session.error = error instanceof Error ? error.message : 'Random Search failed'
    session.completedAt = Date.now()
    onProgress?.({ ...session.progress })
    return session
  }
}

export function getProgressSnapshot(session: ResearchSession): RandomSearchProgress {
  return { ...session.progress }
}

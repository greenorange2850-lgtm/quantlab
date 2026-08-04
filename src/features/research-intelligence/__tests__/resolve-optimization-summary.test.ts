import { describe, expect, it } from 'vitest'
import { buildResearchReport, type ResearchSession } from '@/core/research'
import { resolveOptimizationSummary } from '../resolve-optimization-summary'

function emptyProgress(
  overrides: Partial<ResearchSession['progress']> = {},
): ResearchSession['progress'] {
  return {
    totalCandidates: 10,
    candidatesTested: 0,
    candidatesAccepted: 0,
    candidatesRejected: 0,
    currentCandidateScore: null,
    bestScore: null,
    bestTradeCount: null,
    bestCandidateParameters: null,
    improvementsCount: 0,
    candidatesSinceLastImprovement: 0,
    elapsedMs: 0,
    wallElapsedMs: 0,
    pausedMs: 0,
    estimatedRemainingMs: 0,
    status: 'COMPLETED',
    ...overrides,
  }
}

function baseSession(
  overrides: Partial<ResearchSession> = {},
): ResearchSession {
  return {
    id: 'rs-1',
    status: 'completed',
    config: {
      iterations: 10,
      parameterRanges: [],
      objective: 'profitFactor',
      symbol: 'BTCUSDT',
      interval: '1h',
      limit: 500,
      initialCapital: 10_000,
      seed: 1,
    },
    candidates: [],
    bestCandidateId: null,
    error: null,
    createdAt: 1,
    completedAt: 2,
    progress: emptyProgress(),
    ...overrides,
  }
}

describe('resolveOptimizationSummary', () => {
  it('returns persisted optimizationResult from the report', () => {
    const session = baseSession({
      optimizationResult: {
        baseline: null,
        rawBestCandidateId: null,
        recommendedCandidateId: null,
        recommendation: {
          rawBestCandidateId: null,
          recommendedCandidateId: null,
          ruleId: 'none_eligible',
          explanation: 'Persisted explanation',
        },
        stability: null,
        plateau: null,
        verdict: 'No Meaningful Improvement',
        verdictDetail: 'Detail',
        improvements: [],
        metricChanges: [],
        parameterChanges: [],
        searchExplanation: {
          stagesCompleted: ['baseline'],
          candidatesEvaluated: 0,
          uniqueCandidates: 0,
          duplicatesSkipped: 0,
          generatedCandidates: 0,
          duplicateRate: 0,
          improvementCount: 0,
          lastImprovement: null,
          plateauDetail: null,
          stabilitySummary: null,
          spaceExhausted: false,
        },
        rejectionReasonCounts: {},
        datasetCandleCount: 0,
        datasetStartMs: null,
        datasetEndMs: null,
        stabilityIncomplete: false,
        schemaVersion: 1,
      },
    })
    const report = buildResearchReport(session)
    const summary = resolveOptimizationSummary(report)
    expect(summary?.verdict).toBe('No Meaningful Improvement')
    expect(summary?.recommendation.explanation).toBe('Persisted explanation')
    expect(summary?.schemaVersion).toBe(1)
  })

  it('falls back safely for legacy sessions without adaptive fields', () => {
    const report = buildResearchReport(baseSession())
    expect(resolveOptimizationSummary(report)).toBeNull()
  })

  it('returns null for missing report', () => {
    expect(resolveOptimizationSummary(null)).toBeNull()
    expect(resolveOptimizationSummary(undefined)).toBeNull()
  })
})

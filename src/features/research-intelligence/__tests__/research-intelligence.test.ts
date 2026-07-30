import { describe, expect, it } from 'vitest'
import type {
  RandomSearchCandidate,
  ResearchReport,
  ResearchSession,
} from '@/core/research'
import type { BacktestReport } from '@/core/analytics/types'
import { defaultRiskConfig } from '@/core/risk/config'
import {
  buildOptimizerTransparency,
  buildResearchHealthReasons,
  buildResearchHealthSnapshot,
  buildResearchProgressSnapshot,
  buildResearchRecommendation,
  deriveLastImprovementAgo,
  deriveResearchPhaseStatus,
  mapResearchRatingToHealth,
} from '../research-intelligence'

function stubReport(
  overrides: Partial<BacktestReport['summary']> = {},
): BacktestReport {
  const summary = {
    totalTrades: 40,
    winRate: 0.6,
    netProfit: 100,
    profitFactor: 1.8,
    expectancy: 2,
    averageWin: 8,
    averageLoss: -6,
    maxDrawdown: 0.08,
    largestWinner: 20,
    largestLoser: -10,
    finalBalance: 1100,
    ...overrides,
  }

  return {
    summary,
    equityCurve: [],
    drawdown: {
      currentDrawdown: 0,
      maxDrawdown: summary.maxDrawdown,
      maxDrawdownDurationMs: 0,
      maxDrawdownRecoveryMs: null,
    },
    monthlyReturns: { months: [], bestMonth: null, worstMonth: null },
    tradeAnalysis: {
      averageWin: summary.averageWin,
      averageLoss: summary.averageLoss,
      largestWinner: summary.largestWinner,
      largestLoser: summary.largestLoser,
      profitFactor: summary.profitFactor,
      expectancy: summary.expectancy,
      averageHoldingTimeMs: 1,
      longPerformance: {
        trades: summary.totalTrades,
        netProfit: summary.netProfit,
        winRate: summary.winRate,
      },
      shortPerformance: { trades: 0, netProfit: 0, winRate: 0 },
    },
    topTrades: [],
    statistics: {
      totalTrades: summary.totalTrades,
      winningTrades: Math.round(summary.totalTrades * summary.winRate),
      losingTrades: Math.round(summary.totalTrades * (1 - summary.winRate)),
      winRate: summary.winRate,
      netProfit: summary.netProfit,
      grossProfit: 200,
      grossLoss: -100,
      maxDrawdown: summary.maxDrawdown,
      averageTrade: 2,
      finalBalance: summary.finalBalance,
    },
    trades: [],
    config: {
      initialCapital: 1000,
      commissionPercent: 0.04,
      positionSizePercent: 10,
      symbol: 'BTCUSDT',
      riskConfig: defaultRiskConfig,
    },
  }
}

function stubCandidate(input: {
  id: string
  score: number
  passed: boolean
  summary?: Partial<BacktestReport['summary']>
}): RandomSearchCandidate {
  return {
    id: input.id,
    parameters: { fastPeriod: 10, slowPeriod: 30, rsiPeriod: 14 },
    score: input.score,
    passedConstraints: input.passed,
    report: stubReport(input.summary),
    backtestId: `bt-${input.id}`,
  }
}

function emptyReport(): ResearchReport {
  return {
    sessionId: 'empty',
    status: 'completed',
    objective: 'profitFactor',
    iterationsRequested: 10,
    iterationsCompleted: 10,
    candidatesEvaluated: 10,
    candidatesPassingConstraints: 0,
    bestCandidate: null,
    topCandidates: [],
    config: {
      iterations: 10,
      parameterRanges: [],
      objective: 'profitFactor',
      symbol: 'BTCUSDT',
      interval: '1h',
      limit: 200,
      initialCapital: 1000,
    },
    error: null,
    createdAt: 1,
    completedAt: 2,
    analysis: {
      summary: 'none',
      strengths: [],
      weaknesses: ['none'],
      suggestions: [],
      riskLevel: 'elevated',
      rating: 'inconclusive',
    },
  }
}

describe('deriveLastImprovementAgo', () => {
  it('returns null when no passing candidates', () => {
    expect(
      deriveLastImprovementAgo([
        stubCandidate({ id: 'a', score: 1, passed: false }),
        stubCandidate({ id: 'b', score: 2, passed: false }),
      ]),
    ).toBeNull()
  })

  it('counts candidates since the last best improvement', () => {
    const candidates = [
      stubCandidate({ id: 'a', score: 1, passed: true }),
      stubCandidate({ id: 'b', score: 0.5, passed: true }),
      stubCandidate({ id: 'c', score: 2, passed: true }),
      stubCandidate({ id: 'd', score: 1.5, passed: true }),
      stubCandidate({ id: 'e', score: 1.8, passed: false }),
    ]
    expect(deriveLastImprovementAgo(candidates)).toBe(2)
  })

  it('returns 0 when the latest candidate set the best', () => {
    expect(
      deriveLastImprovementAgo([
        stubCandidate({ id: 'a', score: 1, passed: true }),
        stubCandidate({ id: 'b', score: 3, passed: true }),
      ]),
    ).toBe(0)
  })
})

describe('deriveResearchPhaseStatus', () => {
  it('marks early runs without a best as exploring', () => {
    expect(
      deriveResearchPhaseStatus({
        tested: 3,
        total: 20,
        accepted: 0,
        bestScore: null,
        lastImprovementAgo: null,
        sessionStatus: 'running',
        uiRunning: true,
      }),
    ).toBe('exploring')
  })

  it('marks recent improvements as improving', () => {
    expect(
      deriveResearchPhaseStatus({
        tested: 40,
        total: 50,
        accepted: 12,
        bestScore: 1.8,
        lastImprovementAgo: 2,
        sessionStatus: 'running',
        uiRunning: true,
      }),
    ).toBe('improving')
  })

  it('marks stale best while running as plateauing', () => {
    expect(
      deriveResearchPhaseStatus({
        tested: 40,
        total: 50,
        accepted: 12,
        bestScore: 1.8,
        lastImprovementAgo: 20,
        sessionStatus: 'running',
        uiRunning: true,
      }),
    ).toBe('plateauing')
  })

  it('marks finished plateaued runs as converged', () => {
    expect(
      deriveResearchPhaseStatus({
        tested: 50,
        total: 50,
        accepted: 12,
        bestScore: 1.8,
        lastImprovementAgo: 25,
        sessionStatus: 'completed',
      }),
    ).toBe('converged')
  })
})

describe('research health mapping', () => {
  it('maps packaged ratings to Excellent/Good/Fair/Poor', () => {
    expect(mapResearchRatingToHealth('strong')).toBe('Excellent')
    expect(mapResearchRatingToHealth('fair')).toBe('Good')
    expect(mapResearchRatingToHealth('mixed')).toBe('Fair')
    expect(mapResearchRatingToHealth('poor')).toBe('Poor')
    expect(mapResearchRatingToHealth('inconclusive')).toBe('Fair')
  })

  it('builds reason bullets from existing summary thresholds', () => {
    const strong = buildResearchHealthReasons(
      stubReport({
        profitFactor: 1.8,
        maxDrawdown: 0.08,
        winRate: 0.55,
        totalTrades: 40,
      }).summary,
    )
    expect(strong).toContain('Profit Factor healthy')
    expect(strong).toContain('Drawdown acceptable')
    expect(strong).toContain('Win Rate acceptable')

    const weak = buildResearchHealthReasons(
      stubReport({
        profitFactor: 0.9,
        maxDrawdown: 0.3,
        winRate: 0.4,
        totalTrades: 8,
        expectancy: -1,
      }).summary,
    )
    expect(weak).toContain('Profit Factor below break-even')
    expect(weak).toContain('Drawdown elevated')
    expect(weak).toContain('Win Rate unstable')
  })
})

describe('buildResearchProgressSnapshot + recommendation', () => {
  it('derives progress counters from a completed session/report', () => {
    const candidates = [
      stubCandidate({ id: 'a', score: 1.1, passed: true }),
      stubCandidate({ id: 'b', score: 0.8, passed: false }),
      stubCandidate({ id: 'c', score: 1.4, passed: true }),
      stubCandidate({ id: 'd', score: 1.2, passed: true }),
    ]

    const session = {
      id: 'rs-1',
      status: 'completed',
      config: {
        iterations: 4,
        parameterRanges: [],
        objective: 'profitFactor',
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 200,
        initialCapital: 1000,
      },
      candidates,
      bestCandidateId: 'c',
      error: null,
      createdAt: 1,
      completedAt: 2,
      progress: { completed: 4, total: 4, bestScore: 1.4, status: 'completed' },
    } satisfies ResearchSession

    const report = {
      sessionId: 'rs-1',
      status: 'completed',
      objective: 'profitFactor',
      iterationsRequested: 4,
      iterationsCompleted: 4,
      candidatesEvaluated: 4,
      candidatesPassingConstraints: 3,
      bestCandidate: candidates[2]!,
      topCandidates: [candidates[2]!, candidates[3]!, candidates[0]!],
      config: session.config,
      error: null,
      createdAt: 1,
      completedAt: 2,
      analysis: {
        summary: 'ok',
        strengths: [],
        weaknesses: [],
        suggestions: [],
        riskLevel: 'moderate',
        rating: 'strong',
      },
    } satisfies ResearchReport

    const progress = buildResearchProgressSnapshot({
      progress: session.progress,
      report,
      session,
    })

    expect(progress).toMatchObject({
      candidatesTested: 4,
      accepted: 3,
      rejected: 1,
      currentBestScore: 1.4,
      lastImprovementAgo: 1,
      status: 'converged',
    })

    expect(
      buildOptimizerTransparency({
        progress: session.progress,
        report,
        session,
      }),
    ).toEqual({
      candidatesGenerated: 4,
      passedFilters: 3,
      rejected: 1,
      currentBest: 1.4,
    })

    const health = buildResearchHealthSnapshot(report)
    expect(health?.rating).toBe('Excellent')

    const recommendation = buildResearchRecommendation(progress, health)
    expect(recommendation?.title).toBe('Search appears complete.')
    expect(recommendation?.detail).toMatch(/validation/i)
  })

  it('recommends continue search while improving', () => {
    const progress = buildResearchProgressSnapshot({
      progress: { completed: 12, total: 40, bestScore: 1.5, status: 'running' },
      report: null,
      session: {
        id: 'live',
        status: 'running',
        config: {
          iterations: 40,
          parameterRanges: [],
          objective: 'profitFactor',
          symbol: 'BTCUSDT',
          interval: '1h',
          limit: 200,
          initialCapital: 1000,
        },
        candidates: [
          stubCandidate({ id: 'a', score: 1.0, passed: true }),
          stubCandidate({ id: 'b', score: 1.5, passed: true }),
        ],
        bestCandidateId: 'b',
        error: null,
        createdAt: 1,
        completedAt: null,
        progress: { completed: 12, total: 40, bestScore: 1.5, status: 'running' },
      },
      uiRunning: true,
    })

    expect(progress?.status).toBe('improving')
    expect(buildResearchRecommendation(progress, null)?.title).toBe('Continue Search')
  })

  it('recommends adjusting search when nothing passed', () => {
    const report = emptyReport()
    const progress = buildResearchProgressSnapshot({
      progress: { completed: 10, total: 10, bestScore: null, status: 'completed' },
      report,
      session: null,
    })
    const health = buildResearchHealthSnapshot(report)

    expect(health?.rating).toBe('Fair')
    expect(buildResearchRecommendation(progress, health)?.title).toBe('Adjust Search')
  })
})

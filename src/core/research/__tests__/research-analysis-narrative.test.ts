import { describe, expect, it } from 'vitest'
import { buildResearchAnalysisNarrative, buildResearchReport } from '../build-research-report.js'
import type { RandomSearchCandidate, ResearchSession } from '../types.js'
import type { BacktestReport } from '../../analytics/types.js'
import { defaultRiskConfig } from '../../risk/config.js'

function stubReport(overrides: Partial<BacktestReport['summary']> = {}): BacktestReport {
  return {
    summary: {
      totalTrades: 25,
      winRate: 0.55,
      netProfit: 400,
      profitFactor: 1.8,
      expectancy: 16,
      averageWin: 40,
      averageLoss: -20,
      maxDrawdown: 0.08,
      largestWinner: 80,
      largestLoser: -30,
      finalBalance: 10_400,
      ...overrides,
    },
    equityCurve: [],
    drawdown: {
      currentDrawdown: 0,
      maxDrawdown: overrides.maxDrawdown ?? 0.08,
      maxDrawdownDurationMs: 0,
      maxDrawdownRecoveryMs: null,
    },
    monthlyReturns: { months: [], bestMonth: null, worstMonth: null },
    tradeAnalysis: {
      averageWin: 40,
      averageLoss: -20,
      largestWinner: 80,
      largestLoser: -30,
      profitFactor: overrides.profitFactor ?? 1.8,
      expectancy: overrides.expectancy ?? 16,
      averageHoldingTimeMs: 1,
      longPerformance: { trades: 25, netProfit: 400, winRate: 0.55 },
      shortPerformance: { trades: 0, netProfit: 0, winRate: 0 },
    },
    topTrades: [],
    statistics: {
      totalTrades: 25,
      winningTrades: 14,
      losingTrades: 11,
      winRate: 0.55,
      netProfit: overrides.netProfit ?? 400,
      grossProfit: 560,
      grossLoss: -160,
      maxDrawdown: overrides.maxDrawdown ?? 0.08,
      averageTrade: 16,
      finalBalance: 10_400,
    },
    trades: [],
    config: {
      initialCapital: 10_000,
      commissionPercent: 0.1,
      positionSizePercent: 100,
      symbol: 'BTCUSDT',
      riskConfig: defaultRiskConfig,
    },
  }
}

function baseSession(candidates: RandomSearchCandidate[]): ResearchSession {
  return {
    id: 'rs-ui',
    status: 'completed',
    config: {
      iterations: 5,
      parameterRanges: [],
      objective: 'profitFactor',
      symbol: 'BTCUSDT',
      interval: '1h',
      limit: 200,
      initialCapital: 10_000,
    },
    candidates,
    bestCandidateId: candidates[0]?.id ?? null,
    error: null,
    createdAt: 1,
    completedAt: 2,
    progress: {
      totalCandidates: 5,
      candidatesTested: candidates.length,
      candidatesAccepted: candidates.filter((c) => c.passedConstraints).length,
      candidatesRejected: candidates.filter((c) => !c.passedConstraints).length,
      currentCandidateScore: candidates[0]?.score ?? null,
      bestScore: candidates[0]?.score ?? null,
      bestTradeCount: candidates[0]?.report.summary.totalTrades ?? null,
      bestCandidateParameters: candidates[0]
        ? { ...candidates[0].parameters }
        : null,
      improvementsCount: candidates[0] ? 1 : 0,
      candidatesSinceLastImprovement: candidates[0] ? 0 : null,
      elapsedMs: 0,
      estimatedRemainingMs: 0,
      status: 'COMPLETED',
    },
  }
}

describe('buildResearchAnalysisNarrative', () => {
  it('packages existing metrics into narrative without inventing sharpe', () => {
    const candidate: RandomSearchCandidate = {
      id: 'c1',
      parameters: { fastPeriod: 12, slowPeriod: 40, rsiPeriod: 14 },
      score: 1.8,
      passedConstraints: true,
      report: stubReport(),
      backtestId: 'bt-1',
    }
    const narrative = buildResearchAnalysisNarrative(baseSession([candidate]), candidate)
    expect(narrative.summary).toContain('Historical research')
    expect(narrative.summary.toLowerCase()).toContain('validation required')
    expect(narrative.rating).toBe('strong')
    expect(narrative.riskLevel).toBe('moderate')
    expect(narrative.strengths.some((item) => item.includes('Profit factor'))).toBe(true)
  })

  it('marks empty constraint results as inconclusive', () => {
    const narrative = buildResearchAnalysisNarrative(baseSession([]), null)
    expect(narrative.rating).toBe('inconclusive')
    expect(narrative.strengths).toEqual([])
    expect(narrative.weaknesses.length).toBeGreaterThan(0)
  })
})

describe('buildResearchReport analysis attachment', () => {
  it('always includes analysis on the report object', () => {
    const candidate: RandomSearchCandidate = {
      id: 'c1',
      parameters: { fastPeriod: 10, slowPeriod: 30, rsiPeriod: 14 },
      score: 1.2,
      passedConstraints: true,
      report: stubReport({ profitFactor: 1.2, netProfit: 50, maxDrawdown: 0.18 }),
      backtestId: 'bt-2',
    }
    const report = buildResearchReport(baseSession([candidate]))
    expect(report.analysis.suggestions.length).toBeGreaterThan(0)
    expect(report.bestCandidate?.report.summary.profitFactor).toBe(1.2)
  })
})

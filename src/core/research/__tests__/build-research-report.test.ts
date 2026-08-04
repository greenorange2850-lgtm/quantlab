import { describe, expect, it } from 'vitest'
import { buildResearchReport } from '../build-research-report.js'
import type { RandomSearchCandidate, ResearchSession } from '../types.js'
import type { BacktestReport } from '../../analytics/types.js'
import { defaultRiskConfig } from '../../risk/config.js'

function stubReport(scoreFields: {
  profitFactor: number
  netProfit: number
}): BacktestReport {
  return {
    summary: {
      totalTrades: 10,
      winRate: 0.5,
      netProfit: scoreFields.netProfit,
      profitFactor: scoreFields.profitFactor,
      expectancy: 1,
      averageWin: 10,
      averageLoss: -5,
      maxDrawdown: 0.05,
      largestWinner: 20,
      largestLoser: -8,
      finalBalance: 10_000 + scoreFields.netProfit,
    },
    equityCurve: [],
    drawdown: {
      currentDrawdown: 0,
      maxDrawdown: 0.05,
      maxDrawdownDurationMs: 0,
      maxDrawdownRecoveryMs: null,
    },
    monthlyReturns: { months: [], bestMonth: null, worstMonth: null },
    tradeAnalysis: {
      averageWin: 10,
      averageLoss: -5,
      largestWinner: 20,
      largestLoser: -8,
      profitFactor: scoreFields.profitFactor,
      expectancy: 1,
      averageHoldingTimeMs: 1,
      longPerformance: { trades: 10, netProfit: scoreFields.netProfit, winRate: 0.5 },
      shortPerformance: { trades: 0, netProfit: 0, winRate: 0 },
    },
    topTrades: [],
    statistics: {
      totalTrades: 10,
      winningTrades: 5,
      losingTrades: 5,
      winRate: 0.5,
      netProfit: scoreFields.netProfit,
      grossProfit: 50,
      grossLoss: -40,
      maxDrawdown: 0.05,
      averageTrade: 1,
      finalBalance: 10_000 + scoreFields.netProfit,
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

function candidate(
  id: string,
  score: number,
  passed: boolean,
  pf: number,
): RandomSearchCandidate {
  return {
    id,
    parameters: { fastPeriod: 10, slowPeriod: 30, rsiPeriod: 14 },
    score,
    passedConstraints: passed,
    report: stubReport({ profitFactor: pf, netProfit: score }),
    backtestId: `bt-${id}`,
  }
}

describe('buildResearchReport', () => {
  it('ranks passing candidates by existing scores without recomputing metrics', () => {
    const session: ResearchSession = {
      id: 'rs-1',
      status: 'completed',
      config: {
        iterations: 3,
        parameterRanges: [],
        objective: 'profitFactor',
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 100,
        initialCapital: 10_000,
      },
      candidates: [
        candidate('a', 1.1, true, 1.1),
        candidate('b', 2.0, true, 2.0),
        candidate('c', 3.0, false, 3.0),
      ],
      bestCandidateId: 'b',
      error: null,
      createdAt: 1,
      completedAt: 2,
      progress: {
        totalCandidates: 3,
        candidatesTested: 3,
        candidatesAccepted: 2,
        candidatesRejected: 1,
        currentCandidateScore: 3,
        bestScore: 2,
        bestTradeCount: 8,
        bestCandidateParameters: { fastPeriod: 10, slowPeriod: 30, rsiPeriod: 14 },
        improvementsCount: 1,
        candidatesSinceLastImprovement: 1,
        elapsedMs: 0,
        wallElapsedMs: 0,
        pausedMs: 0,
        estimatedRemainingMs: 0,
        status: 'COMPLETED',
      },
    }

    const report = buildResearchReport(session)
    expect(report.bestCandidate?.id).toBe('b')
    expect(report.topCandidates.map((item) => item.id)).toEqual(['b', 'a'])
    expect(report.candidatesPassingConstraints).toBe(2)
    expect(report.bestCandidate?.score).toBe(2.0)
    expect(report.bestCandidate?.report.summary.profitFactor).toBe(2.0)
    expect(report.analysis.summary).toContain('Historical research')
    expect(report.analysis.rating).toBeTruthy()
    expect(report.analysis.riskLevel).toBeTruthy()
    expect(report.analysis.strengths.length + report.analysis.weaknesses.length).toBeGreaterThan(0)
  })
})

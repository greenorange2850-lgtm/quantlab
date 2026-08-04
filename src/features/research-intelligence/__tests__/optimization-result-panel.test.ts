import { createElement } from 'react'
import { describe, expect, it, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { BacktestReport } from '@/core/analytics/types'
import { defaultRiskConfig } from '@/core/risk/config'
import {
  buildResearchReport,
  type OptimizationBaseline,
  type OptimizationResultSummary,
  type ResearchSession,
} from '@/core/research'
import { OptimizationResultPanel } from '../OptimizationResultPanel'
import {
  clearResearchSessionArchive,
  expandPersistedResearchSession,
  resetResearchSessionMemory,
  saveResearchSession,
  slimResearchSessionForStorage,
  getResearchSession,
  ensureResearchSessionArchiveHydrated,
} from '@/research/session-archive'

function stubReport(netProfit: number, trades = 40): BacktestReport {
  return {
    summary: {
      totalTrades: trades,
      winRate: 0.4,
      netProfit,
      profitFactor: 1.5,
      expectancy: 5,
      averageWin: 20,
      averageLoss: -10,
      maxDrawdown: 0.05,
      largestWinner: 40,
      largestLoser: -15,
      finalBalance: 10_000 + netProfit,
    },
    equityCurve: [
      { time: 1, equity: 10_000, cash: 10_000, drawdown: 0 },
      { time: 2, equity: 10_000 + netProfit, cash: 10_000, drawdown: 0 },
    ],
    drawdown: {
      currentDrawdown: 0,
      maxDrawdown: 0.05,
      maxDrawdownDurationMs: 0,
      maxDrawdownRecoveryMs: null,
    },
    monthlyReturns: { months: [], bestMonth: null, worstMonth: null },
    tradeAnalysis: {
      averageWin: 20,
      averageLoss: -10,
      largestWinner: 40,
      largestLoser: -15,
      profitFactor: 1.5,
      expectancy: 5,
      averageHoldingTimeMs: 1,
      longPerformance: { trades, netProfit, winRate: 0.4 },
      shortPerformance: { trades: 0, netProfit: 0, winRate: 0 },
    },
    topTrades: [],
    statistics: {
      totalTrades: trades,
      winningTrades: 20,
      losingTrades: 20,
      winRate: 0.4,
      netProfit,
      grossProfit: 200,
      grossLoss: -100,
      maxDrawdown: 0.05,
      averageTrade: netProfit / trades,
      finalBalance: 10_000 + netProfit,
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

function makeBaseline(): OptimizationBaseline {
  const report = stubReport(120, 31)
  report.summary.profitFactor = 1.12
  report.summary.winRate = 0.36
  report.summary.maxDrawdown = 0.084
  return {
    parameters: { fastPeriod: 20, slowPeriod: 50, rsiPeriod: 14 },
    report,
    score: 1.12,
    researchRating: 'mixed',
    tradeCount: 31,
    netProfit: 120,
    profitFactor: 1.12,
    maxDrawdown: 0.084,
    winRate: 0.36,
    expectancy: 3,
    backtestId: 'bt-base',
  }
}

function makeOptimization(baseline: OptimizationBaseline): OptimizationResultSummary {
  return {
    baseline,
    rawBestCandidateId: 'cand-rec',
    recommendedCandidateId: 'cand-rec',
    recommendation: {
      rawBestCandidateId: 'cand-rec',
      recommendedCandidateId: 'cand-rec',
      ruleId: 'raw_best',
      explanation: 'Highest eligible score.',
    },
    stability: {
      overall: 'MEDIUM',
      stableParameters: [
        {
          name: 'fastPeriod',
          label: 'EMA Fast',
          level: 'HIGH',
          neighborhoodCount: 5,
          valueRangeLabel: '8–11',
          reason: 'Nearby EMA Fast values remained close.',
        },
      ],
      sensitiveParameters: [
        {
          name: 'slowPeriod',
          label: 'EMA Slow',
          level: 'LOW',
          neighborhoodCount: 5,
          valueRangeLabel: '46–50',
          reason: 'Nearby EMA Slow values caused a large score decline.',
        },
      ],
      neighborhoodSampleCount: 5,
      medianNearbyScore: 1.4,
      worstNearbyScore: 1.1,
      scoreDispersion: 0.12,
      nearbyPassRate: 0.8,
      summary: 'Some parameters show moderate sensitivity.',
    },
    plateau: {
      detected: true,
      reason: 'no_improvement_window',
      detail: 'No meaningful best-score improvement for 40 unique candidates.',
      continued: true,
      uniqueSinceImprovement: 40,
    },
    verdict: 'Meaningfully Improved',
    verdictDetail:
      'Historical performance improved versus the Strategy Lab baseline with acceptable parameter-region evidence. Validation on unseen data is still required.',
    improvements: [
      {
        candidateId: 'cand-rec',
        candidateIndex: 12,
        stage: 'exploration',
        score: 1.5,
        parameters: { fastPeriod: 9, slowPeriod: 48, rsiPeriod: 13 },
        netProfit: 482.54,
        profitFactor: 1.5,
        maxDrawdown: 0.047,
        winRate: 0.316,
        tradeCount: 67,
        elapsedMs: 1200,
      },
    ],
    metricChanges: [
      {
        key: 'netProfit',
        label: 'Net Profit',
        before: 120,
        after: 482.54,
        direction: 'higher_better',
        improved: true,
        text: 'Net Profit improved from $120.00 to $482.54.',
      },
    ],
    parameterChanges: [
      { name: 'fastPeriod', label: 'EMA Fast', before: 20, after: 9 },
      { name: 'slowPeriod', label: 'EMA Slow', before: 50, after: 48 },
      { name: 'rsiPeriod', label: 'RSI Period', before: 14, after: 13 },
    ],
    searchExplanation: {
      stagesCompleted: ['baseline', 'exploration', 'refinement', 'stability'],
      candidatesEvaluated: 100,
      uniqueCandidates: 80,
      duplicatesSkipped: 20,
      generatedCandidates: 100,
      duplicateRate: 0.2,
      improvementCount: 1,
      lastImprovement: null,
      plateauDetail: 'No meaningful best-score improvement for 40 unique candidates.',
      stabilitySummary: 'Some parameters show moderate sensitivity.',
      spaceExhausted: false,
    },
    rejectionReasonCounts: { minimum_trades: 5 },
    datasetCandleCount: 2000,
    datasetStartMs: 1,
    datasetEndMs: 2,
    stabilityIncomplete: false,
    schemaVersion: 1,
  }
}

function makeAdaptiveSession(): ResearchSession {
  const baseline = makeBaseline()
  const bestReport = stubReport(482.54, 67)
  bestReport.summary.maxDrawdown = 0.047
  bestReport.summary.profitFactor = 1.5
  bestReport.summary.winRate = 0.316

  return {
    id: 'rs-adaptive',
    status: 'completed',
    config: {
      iterations: 100,
      parameterRanges: [],
      objective: 'profitFactor',
      symbol: 'BTCUSDT',
      interval: '15m',
      limit: 100,
      initialCapital: 10_000,
      seed: 1,
    },
    candidates: [
      {
        id: 'cand-rec',
        parameters: { fastPeriod: 9, slowPeriod: 48, rsiPeriod: 13 },
        score: 1.5,
        passedConstraints: true,
        report: bestReport,
        backtestId: 'bt-rec',
        stage: 'refinement',
      },
    ],
    bestCandidateId: 'cand-rec',
    rawBestCandidateId: 'cand-rec',
    recommendedCandidateId: 'cand-rec',
    baseline,
    improvementTimeline: [
      {
        candidateId: 'cand-rec',
        candidateIndex: 12,
        stage: 'exploration',
        score: 1.5,
        parameters: { fastPeriod: 9, slowPeriod: 48, rsiPeriod: 13 },
        netProfit: 482.54,
        profitFactor: 1.5,
        maxDrawdown: 0.047,
        winRate: 0.316,
        tradeCount: 67,
        elapsedMs: 1200,
      },
    ],
    optimizationResult: makeOptimization(baseline),
    error: null,
    createdAt: 1,
    completedAt: 2,
    progress: {
      totalCandidates: 100,
      candidatesTested: 100,
      candidatesAccepted: 1,
      candidatesRejected: 0,
      currentCandidateScore: 1.5,
      bestScore: 1.5,
      bestTradeCount: 67,
      bestCandidateParameters: { fastPeriod: 9, slowPeriod: 48, rsiPeriod: 13 },
      improvementsCount: 1,
      candidatesSinceLastImprovement: 0,
      elapsedMs: 5000,
      wallElapsedMs: 5000,
      pausedMs: 0,
      estimatedRemainingMs: 0,
      status: 'COMPLETED',
    },
  }
}

describe('OptimizationResultPanel', () => {
  it('renders baseline comparison, improvements, and parameter changes', () => {
    const session = makeAdaptiveSession()
    const report = buildResearchReport(session)
    const html = renderToStaticMarkup(
      createElement(OptimizationResultPanel, {
        report,
        optimization: session.optimizationResult!,
      }),
    )

    expect(html).toContain('Optimization Result')
    expect(html).toContain('Meaningfully Improved')
    expect(html).toContain('Validation')
    expect(html).toContain('EMA Fast')
    expect(html).toContain('Net Profit improved')
    expect(html).toContain('MEDIUM')
  })

  it('renders zero-pass / constraints not met state', () => {
    const session = makeAdaptiveSession()
    session.candidates = []
    session.bestCandidateId = null
    session.recommendedCandidateId = null
    session.optimizationResult = {
      ...session.optimizationResult!,
      verdict: 'Constraints Not Met',
      verdictDetail: 'No candidates passed.',
      recommendedCandidateId: null,
      rawBestCandidateId: null,
    }
    const report = buildResearchReport(session)
    const html = renderToStaticMarkup(
      createElement(OptimizationResultPanel, {
        report,
        optimization: session.optimizationResult!,
      }),
    )
    expect(html).toContain('Constraints Not Met')
  })

  it('renders partial incomplete stability messaging', () => {
    const session = makeAdaptiveSession()
    session.optimizationResult!.stabilityIncomplete = true
    session.status = 'partial'
    const report = buildResearchReport(session)
    const html = renderToStaticMarkup(
      createElement(OptimizationResultPanel, {
        report,
        optimization: session.optimizationResult!,
      }),
    )
    expect(html).toContain('Partial Optimization Result')
  })

  it('marks legacy sessions without adaptive fields as unavailable', () => {
    const session = makeAdaptiveSession()
    session.baseline = null
    session.optimizationResult = {
      ...makeOptimization(makeBaseline()),
      baseline: null,
      schemaVersion: 0,
      verdict: 'Insufficient Evidence',
      verdictDetail: '',
    }
    const report = buildResearchReport(session)
    const html = renderToStaticMarkup(
      createElement(OptimizationResultPanel, {
        report,
        optimization: session.optimizationResult,
      }),
    )
    expect(html).toContain('unavailable for this legacy session')
  })
})

describe('adaptive session archive reload', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value)
        },
        removeItem: (key: string) => {
          store.delete(key)
        },
        clear: () => {
          store.clear()
        },
      },
    })
    clearResearchSessionArchive()
    resetResearchSessionMemory()
  })

  it('reload restores baseline, recommended result, timeline, and stability', () => {
    const session = makeAdaptiveSession()
    const report = buildResearchReport(session)
    const ok = saveResearchSession({ session, report, savedAt: 10 })
    expect(ok).toBe(true)

    const slim = slimResearchSessionForStorage({ session, report, savedAt: 10 })
    expect(JSON.stringify({ [session.id]: slim }).length).toBeLessThan(12_000)

    resetResearchSessionMemory()
    ensureResearchSessionArchiveHydrated()
    const restored = getResearchSession(session.id)
    expect(restored).not.toBeNull()
    expect(restored!.session.baseline?.score).toBe(1.12)
    expect(restored!.session.improvementTimeline?.[0]?.score).toBe(1.5)
    expect(restored!.session.optimizationResult?.stability?.overall).toBe('MEDIUM')
    expect(restored!.report.recommendedCandidate?.parameters.fastPeriod).toBe(9)
    expect(restored!.report.baseline?.netProfit).toBe(120)

    const expanded = expandPersistedResearchSession(slim)
    expect(expanded.report.bestCandidate?.id).toBe('cand-rec')
  })
})

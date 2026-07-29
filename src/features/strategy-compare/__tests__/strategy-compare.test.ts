import { describe, expect, it, beforeEach } from 'vitest'
import type { BacktestReport } from '@/core/analytics/types'
import { defaultRiskConfig } from '@/core/risk/config'
import {
  buildImprovementHeadline,
  buildMetricCompareRows,
  buildOverviewPairs,
  buildWhatsChangedLines,
  directionLabel,
} from '../compare-metrics'
import { buildComparePair } from '../resolve-compare-pair'
import {
  clearBacktestDetailArchive,
  saveBacktestDetail,
} from '@/backtests/detail-archive'
import { buildPersistedDetail } from '@/backtests/restore-dashboard'
import { buildResearchReport } from '@/core/research'
import type { RandomSearchCandidate, ResearchSession } from '@/core/research'

function stubReport(overrides: Partial<BacktestReport['summary']> = {}): BacktestReport {
  const netProfit = overrides.netProfit ?? 100
  return {
    summary: {
      totalTrades: 20,
      winRate: 0.5,
      netProfit,
      profitFactor: 1.4,
      expectancy: 5,
      averageWin: 20,
      averageLoss: -10,
      maxDrawdown: 0.1,
      largestWinner: 40,
      largestLoser: -15,
      finalBalance: 10_000 + netProfit,
      ...overrides,
    },
    equityCurve: [],
    drawdown: {
      currentDrawdown: 0,
      maxDrawdown: overrides.maxDrawdown ?? 0.1,
      maxDrawdownDurationMs: 0,
      maxDrawdownRecoveryMs: null,
    },
    monthlyReturns: { months: [], bestMonth: null, worstMonth: null },
    tradeAnalysis: {
      averageWin: 20,
      averageLoss: -10,
      largestWinner: 40,
      largestLoser: -15,
      profitFactor: overrides.profitFactor ?? 1.4,
      expectancy: overrides.expectancy ?? 5,
      averageHoldingTimeMs: 1,
      longPerformance: { trades: 20, netProfit, winRate: 0.5 },
      shortPerformance: { trades: 0, netProfit: 0, winRate: 0 },
    },
    topTrades: [],
    statistics: {
      totalTrades: overrides.totalTrades ?? 20,
      winningTrades: 10,
      losingTrades: 10,
      winRate: overrides.winRate ?? 0.5,
      netProfit,
      grossProfit: 200,
      grossLoss: -100,
      maxDrawdown: overrides.maxDrawdown ?? 0.1,
      averageTrade: netProfit / (overrides.totalTrades ?? 20),
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

function candidate(
  id: string,
  report: BacktestReport,
  backtestId: string,
): RandomSearchCandidate {
  return {
    id,
    parameters: { fastPeriod: 12, slowPeriod: 40, rsiPeriod: 14 },
    score: report.summary.profitFactor,
    passedConstraints: true,
    report,
    backtestId,
  }
}

describe('strategy compare metrics (presentation only)', () => {
  it('builds overview and metric diffs from existing report fields', () => {
    const baseline = stubReport({
      netProfit: 100,
      profitFactor: 1.2,
      maxDrawdown: 0.15,
      winRate: 0.45,
      totalTrades: 30,
      expectancy: 3,
    })
    const optimized = stubReport({
      netProfit: 250,
      profitFactor: 1.8,
      maxDrawdown: 0.08,
      winRate: 0.55,
      totalTrades: 22,
      expectancy: 11,
    })

    const overview = buildOverviewPairs(baseline, optimized)
    expect(overview.map((item) => item.label)).toEqual([
      'Initial Capital',
      'Final Equity',
      'Net Profit',
      'ROI',
      'Total Trades',
    ])

    const rows = buildMetricCompareRows(baseline, optimized)
    const pf = rows.find((row) => row.label === 'Profit Factor')
    expect(pf?.direction).toBe('improved')
    expect(directionLabel('improved')).toBe('↑ Improved')

    const dd = rows.find((row) => row.label === 'Max Drawdown')
    expect(dd?.direction).toBe('improved')

    const sharpe = rows.find((row) => row.label === 'Sharpe Ratio')
    expect(sharpe?.direction).toBe('unavailable')

    const lines = buildWhatsChangedLines(baseline, optimized)
    expect(lines).toEqual(
      expect.arrayContaining([
        'Net profit increased.',
        'Drawdown reduced.',
        'Win rate improved.',
        'Trade count decreased.',
      ]),
    )

    expect(buildImprovementHeadline(baseline, optimized)).toMatch(/stronger/i)
  })
})

describe('resolve compare pair', () => {
  beforeEach(() => {
    clearBacktestDetailArchive()
  })

  it('pairs baseline archive report with selected optimized candidate', () => {
    const baselineReport = stubReport({ netProfit: 50, profitFactor: 1.1 })
    const optimizedReport = stubReport({ netProfit: 200, profitFactor: 1.9 })

    saveBacktestDetail(
      buildPersistedDetail({
        id: 'bt-baseline',
        report: baselineReport,
        context: {
          strategyName: 'Moving Average Cross',
          strategyVersion: 'v1.0.0',
          timeframe: '1H',
        },
      }),
    )

    const optimized = candidate('cand-1', optimizedReport, 'bt-opt')
    const session: ResearchSession = {
      id: 'rs-1',
      status: 'completed',
      config: {
        iterations: 2,
        parameterRanges: [],
        objective: 'profitFactor',
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 100,
        initialCapital: 10_000,
      },
      candidates: [optimized],
      bestCandidateId: 'cand-1',
      error: null,
      createdAt: 1,
      completedAt: 2,
      progress: { completed: 1, total: 2, bestScore: 1.9, status: 'completed' },
    }
    const researchReport = buildResearchReport(session)

    const pair = buildComparePair({
      researchReport,
      selectedCandidateId: 'cand-1',
      sessionCandidates: session.candidates,
      activeReport: null,
      activeBacktestId: null,
    })

    expect(pair).not.toBeNull()
    expect(pair?.baselineId).toBe('bt-baseline')
    expect(pair?.optimized.summary.netProfit).toBe(200)
    expect(pair?.baseline.summary.netProfit).toBe(50)
  })

  it('returns null when optimized exists but no baseline is available', () => {
    const optimized = candidate('cand-1', stubReport({ netProfit: 200 }), 'bt-opt')
    const session: ResearchSession = {
      id: 'rs-2',
      status: 'completed',
      config: {
        iterations: 1,
        parameterRanges: [],
        objective: 'profitFactor',
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 100,
        initialCapital: 10_000,
      },
      candidates: [optimized],
      bestCandidateId: 'cand-1',
      error: null,
      createdAt: 1,
      completedAt: 2,
      progress: { completed: 1, total: 1, bestScore: 1.4, status: 'completed' },
    }

    const pair = buildComparePair({
      researchReport: buildResearchReport(session),
      selectedCandidateId: null,
      sessionCandidates: session.candidates,
    })

    expect(pair).toBeNull()
  })
})

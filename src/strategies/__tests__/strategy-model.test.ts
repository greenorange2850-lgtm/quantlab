import { describe, expect, it, beforeEach } from 'vitest'
import type { BacktestReport } from '@/core/analytics/types'
import { defaultRiskConfig } from '@/core/risk/config'
import { buildResearchReport, type ResearchSession } from '@/core/research'
import { DEFAULT_MA_CROSS_PARAMS } from '@/core/strategy'
import type { PersistedResearchSession } from '@/research/session-archive'
import {
  clearStrategyMetadataArchive,
  ensureStrategyDraft,
  filterAndSortStrategies,
  saveStrategy,
  toStrategyListItem,
  toStrategyViewModel,
} from '@/strategies'

function stubReport(netProfit: number, trades = 12): BacktestReport {
  return {
    summary: {
      totalTrades: trades,
      winRate: 0.5,
      netProfit,
      profitFactor: 1.5,
      expectancy: 5,
      averageWin: 20,
      averageLoss: -10,
      maxDrawdown: 0.1,
      largestWinner: 40,
      largestLoser: -15,
      finalBalance: 10_000 + netProfit,
    },
    equityCurve: [
      { time: 1_700_000_000_000, equity: 10_000, cash: 10_000, drawdown: 0 },
      { time: 1_700_003_600_000, equity: 10_000 + netProfit, cash: 10_000, drawdown: 0 },
    ],
    drawdown: {
      currentDrawdown: 0,
      maxDrawdown: 0.1,
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
      longPerformance: { trades, netProfit, winRate: 0.5 },
      shortPerformance: { trades: 0, netProfit: 0, winRate: 0 },
    },
    topTrades: [],
    statistics: {
      totalTrades: trades,
      winningTrades: Math.floor(trades / 2),
      losingTrades: Math.ceil(trades / 2),
      winRate: 0.5,
      netProfit,
      grossProfit: 100,
      grossLoss: -50,
      maxDrawdown: 0.1,
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

function makeSession(): ResearchSession {
  const report = stubReport(250)
  return {
    id: 'strat-1',
    status: 'completed',
    config: {
      iterations: 5,
      parameterRanges: [],
      objective: 'profitFactor',
      symbol: 'BTCUSDT',
      interval: '1h',
      limit: 100,
      initialCapital: 10_000,
    },
    candidates: [
      {
        id: 'cand-1',
        parameters: { fastPeriod: 12, slowPeriod: 40, rsiPeriod: 14 },
        score: 1.8,
        passedConstraints: true,
        report,
        backtestId: 'bt-1',
      },
    ],
    bestCandidateId: 'cand-1',
    recommendedCandidateId: 'cand-1',
    error: null,
    createdAt: 1_700_000_000_000,
    completedAt: 1_700_000_100_000,
    progress: {
      totalCandidates: 5,
      candidatesTested: 5,
      candidatesAccepted: 1,
      candidatesRejected: 4,
      currentCandidateScore: 1.8,
      bestScore: 1.8,
      bestTradeCount: 12,
      bestCandidateParameters: { fastPeriod: 12, slowPeriod: 40, rsiPeriod: 14 },
      improvementsCount: 1,
      candidatesSinceLastImprovement: 0,
      elapsedMs: 0,
      wallElapsedMs: 0,
      pausedMs: 0,
      estimatedRemainingMs: 0,
      status: 'COMPLETED',
    },
    baseline: {
      parameters: DEFAULT_MA_CROSS_PARAMS,
      score: 1.1,
      researchRating: 'fair',
      report: stubReport(50, 8),
      tradeCount: 8,
      netProfit: 50,
      profitFactor: 1.1,
      maxDrawdown: 0.15,
      winRate: 0.5,
      expectancy: 6,
      backtestId: 'bt-base',
    },
  }
}

function makeEntry(session: ResearchSession): PersistedResearchSession {
  return {
    session,
    report: buildResearchReport(session),
    savedAt: session.completedAt ?? Date.now(),
  }
}

describe('strategy-first model', () => {
  beforeEach(() => {
    clearStrategyMetadataArchive()
  })

  it('maps a persisted research session to a Strategy view model', () => {
    const strategy = toStrategyViewModel(makeEntry(makeSession()))

    expect(strategy.id).toBe('strat-1')
    expect(strategy.market).toBe('BTCUSDT')
    expect(strategy.winningParameters).toEqual({
      fastPeriod: 12,
      slowPeriod: 40,
      rsiPeriod: 14,
    })
    expect(strategy.versions.some((v) => v.isBaseline)).toBe(true)
    expect(strategy.versions.some((v) => v.isCurrent)).toBe(true)
    // Legacy / unresolved metadata appears as saved so History → Library keeps data.
    expect(strategy.lifecycle).toBe('saved')
  })

  it('creates drafts from Random Search and promotes on Save Strategy', () => {
    ensureStrategyDraft({
      id: 'strat-1',
      market: 'BTCUSDT',
      timeframe: '1H',
      createdAt: 1,
    })
    expect(toStrategyViewModel(makeEntry(makeSession())).lifecycle).toBe('draft')

    saveStrategy({ id: 'strat-1', name: 'BTC Momentum v1' })
    const saved = toStrategyViewModel(makeEntry(makeSession()))
    expect(saved.lifecycle).toBe('saved')
    expect(saved.name).toBe('BTC Momentum v1')
  })

  it('filters drafts out of the library when savedOnly is on', () => {
    ensureStrategyDraft({
      id: 'strat-1',
      market: 'BTCUSDT',
      timeframe: '1H',
    })
    const items = [toStrategyListItem(makeEntry(makeSession()))]
    expect(
      filterAndSortStrategies(items, {
        search: '',
        market: '',
        timeframe: '',
        sort: 'newest',
        savedOnly: true,
      }),
    ).toHaveLength(0)

    saveStrategy({ id: 'strat-1', name: 'Saved' })
    expect(
      filterAndSortStrategies([toStrategyListItem(makeEntry(makeSession()))], {
        search: '',
        market: '',
        timeframe: '',
        sort: 'newest',
        savedOnly: true,
      })[0]?.name,
    ).toBe('Saved')
  })
})

import { beforeEach, describe, expect, it } from 'vitest'
import { appQueryClient } from '@/api/query-client'
import {
  clearResearchSessionArchive,
  saveResearchSession,
  type PersistedResearchSession,
} from '@/research/session-archive'
import { buildResearchReport, type ResearchSession } from '@/core/research'
import type { BacktestReport } from '@/core/analytics/types'
import { defaultRiskConfig } from '@/core/risk/config'
import { DEFAULT_MA_CROSS_PARAMS } from '@/core/strategy'
import {
  clearStrategyMetadataArchive,
  ensureStrategyDraft,
} from '@/strategies'
import {
  strategyKeys,
  syncStrategyQueries,
} from '@/api/queries/strategies'

function stubReport(netProfit: number): BacktestReport {
  return {
    summary: {
      totalTrades: 4,
      winRate: 0.5,
      netProfit,
      profitFactor: 1.4,
      expectancy: 5,
      averageWin: 20,
      averageLoss: -10,
      maxDrawdown: 0.05,
      largestWinner: 20,
      largestLoser: -10,
      finalBalance: 10_000 + netProfit,
    },
    equityCurve: [
      { time: 1, equity: 10_000, cash: 10_000, drawdown: 0 },
      { time: 2, equity: 10_000 + netProfit, cash: 10_000 + netProfit, drawdown: 0 },
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
      largestWinner: 20,
      largestLoser: -10,
      profitFactor: 1.4,
      expectancy: 5,
      averageHoldingTimeMs: 1,
      longPerformance: { trades: 4, netProfit, winRate: 0.5 },
      shortPerformance: { trades: 0, netProfit: 0, winRate: 0 },
    },
    topTrades: [],
    statistics: {
      totalTrades: 4,
      winningTrades: 2,
      losingTrades: 2,
      winRate: 0.5,
      netProfit,
      grossProfit: 40,
      grossLoss: -20,
      maxDrawdown: 0.05,
      averageTrade: netProfit / 4,
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

function makeEntry(): PersistedResearchSession {
  const session: ResearchSession = {
    id: 'save-strat-1',
    status: 'completed',
    config: {
      iterations: 3,
      parameterRanges: [],
      objective: 'profitFactor',
      symbol: 'BTCUSDT',
      interval: '1h',
      limit: 50,
      initialCapital: 10_000,
    },
    candidates: [
      {
        id: 'c1',
        parameters: { ...DEFAULT_MA_CROSS_PARAMS },
        score: 1.4,
        passedConstraints: true,
        report: stubReport(80),
        backtestId: 'bt-save-1',
      },
    ],
    bestCandidateId: 'c1',
    recommendedCandidateId: 'c1',
    error: null,
    createdAt: 10,
    completedAt: 20,
    progress: {
      totalCandidates: 3,
      candidatesTested: 3,
      candidatesAccepted: 1,
      candidatesRejected: 2,
      currentCandidateScore: 1.4,
      bestScore: 1.4,
      bestTradeCount: 4,
      bestCandidateParameters: { ...DEFAULT_MA_CROSS_PARAMS },
      improvementsCount: 1,
      candidatesSinceLastImprovement: 0,
      elapsedMs: 0,
      wallElapsedMs: 0,
      pausedMs: 0,
      estimatedRemainingMs: 0,
      status: 'COMPLETED',
    },
  }
  return { session, report: buildResearchReport(session), savedAt: 20 }
}

describe('save strategy query cache', () => {
  beforeEach(() => {
    clearResearchSessionArchive()
    clearStrategyMetadataArchive()
    appQueryClient.clear()
  })

  it('updates detail lifecycle Draft → Saved immediately via syncStrategyQueries', async () => {
    const entry = makeEntry()
    saveResearchSession(entry)
    ensureStrategyDraft({
      id: entry.session.id,
      market: 'BTCUSDT',
      timeframe: '1H',
      createdAt: 10,
    })
    syncStrategyQueries(appQueryClient)

    const before = appQueryClient.getQueryData(strategyKeys.detail(entry.session.id)) as {
      lifecycle: string
    }
    expect(before.lifecycle).toBe('draft')

    // Simulate useSaveStrategy mutationFn body.
    const { saveStrategy } = await import('@/strategies')
    saveStrategy({ id: entry.session.id, name: 'Named Momentum' })
    syncStrategyQueries(appQueryClient)

    const after = appQueryClient.getQueryData(strategyKeys.detail(entry.session.id)) as {
      lifecycle: string
      name: string
    }
    expect(after.lifecycle).toBe('saved')
    expect(after.name).toBe('Named Momentum')

    const list = appQueryClient.getQueryData(strategyKeys.list()) as Array<{
      id: string
      lifecycle: string
    }>
    expect(list.find((item) => item.id === entry.session.id)?.lifecycle).toBe('saved')
  })
})

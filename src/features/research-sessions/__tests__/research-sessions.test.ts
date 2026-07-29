import { describe, expect, it, beforeEach } from 'vitest'
import type { BacktestReport } from '@/core/analytics/types'
import { defaultRiskConfig } from '@/core/risk/config'
import { buildResearchReport, type ResearchSession } from '@/core/research'
import {
  clearResearchSessionArchive,
  deleteResearchSession,
  listResearchSessionsBySavedAt,
  saveResearchSession,
} from '@/research/session-archive'
import {
  collectFilterOptions,
  filterAndSortSessions,
  toSessionListItem,
} from '../session-list-model'

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
    equityCurve: [],
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

function makeSession(input: {
  id: string
  symbol: string
  interval: string
  createdAt: number
  score: number
  netProfit: number
}): ResearchSession {
  const report = stubReport(input.netProfit)
  report.config.symbol = input.symbol
  return {
    id: input.id,
    status: 'completed',
    config: {
      iterations: 5,
      parameterRanges: [],
      objective: 'profitFactor',
      symbol: input.symbol,
      interval: input.interval,
      limit: 100,
      initialCapital: 10_000,
    },
    candidates: [
      {
        id: `${input.id}-c1`,
        parameters: { fastPeriod: 10, slowPeriod: 30, rsiPeriod: 14 },
        score: input.score,
        passedConstraints: true,
        report,
        backtestId: `bt-${input.id}`,
      },
    ],
    bestCandidateId: `${input.id}-c1`,
    error: null,
    createdAt: input.createdAt,
    completedAt: input.createdAt + 1,
    progress: {
      completed: 5,
      total: 5,
      bestScore: input.score,
      status: 'completed',
    },
  }
}

describe('research sessions archive delete/list', () => {
  beforeEach(() => {
    clearResearchSessionArchive()
  })

  it('lists and deletes archived sessions', () => {
    const session = makeSession({
      id: 'rs-a',
      symbol: 'ETHUSDT',
      interval: '1h',
      createdAt: 100,
      score: 1.8,
      netProfit: 200,
    })
    saveResearchSession({
      session,
      report: buildResearchReport(session),
      savedAt: 200,
    })

    expect(listResearchSessionsBySavedAt()).toHaveLength(1)
    expect(deleteResearchSession('rs-a')).toBe(true)
    expect(listResearchSessionsBySavedAt()).toHaveLength(0)
    expect(deleteResearchSession('rs-a')).toBe(false)
  })
})

describe('session list model', () => {
  beforeEach(() => {
    clearResearchSessionArchive()
  })

  it('maps existing report fields without inventing analytics', () => {
    const session = makeSession({
      id: 'rs-b',
      symbol: 'BTCUSDT',
      interval: '15m',
      createdAt: 1_700_000_000_000,
      score: 2.1,
      netProfit: 250,
    })
    const entry = {
      session,
      report: buildResearchReport(session),
      savedAt: 1_700_000_100_000,
    }

    const item = toSessionListItem(entry)
    expect(item.strategyName).toBe('Moving Average Cross')
    expect(item.market).toBe('BTCUSDT')
    expect(item.timeframe).toBe('15M')
    expect(item.bestScore).toBe(2.1)
    expect(item.netProfit).toBe(250)
    expect(item.roiPercent).toBeCloseTo(2.5)
    expect(item.totalTrades).toBe(12)
  })

  it('filters by strategy/market/timeframe and sorts by profit/score/newest', () => {
    const sessions = [
      makeSession({
        id: 'rs-1',
        symbol: 'BTCUSDT',
        interval: '1h',
        createdAt: 100,
        score: 1.2,
        netProfit: 50,
      }),
      makeSession({
        id: 'rs-2',
        symbol: 'ETHUSDT',
        interval: '15m',
        createdAt: 300,
        score: 2.5,
        netProfit: 400,
      }),
      makeSession({
        id: 'rs-3',
        symbol: 'BTCUSDT',
        interval: '1h',
        createdAt: 200,
        score: 1.9,
        netProfit: 120,
      }),
    ].map((session) => ({
      session,
      report: buildResearchReport(session),
      savedAt: session.createdAt,
    }))

    const items = sessions.map(toSessionListItem)
    const options = collectFilterOptions(items)
    expect(options.markets).toEqual(['BTCUSDT', 'ETHUSDT'])
    expect(options.timeframes).toEqual(['15M', '1H'])

    const btcOnly = filterAndSortSessions(items, {
      search: 'moving',
      market: 'BTCUSDT',
      timeframe: '1H',
      sort: 'profit',
    })
    expect(btcOnly.map((item) => item.id)).toEqual(['rs-3', 'rs-1'])

    const byScore = filterAndSortSessions(items, {
      search: '',
      market: '',
      timeframe: '',
      sort: 'score',
    })
    expect(byScore.map((item) => item.id)).toEqual(['rs-2', 'rs-3', 'rs-1'])

    const byNewest = filterAndSortSessions(items, {
      search: '',
      market: '',
      timeframe: '',
      sort: 'newest',
    })
    expect(byNewest.map((item) => item.id)).toEqual(['rs-2', 'rs-3', 'rs-1'])
  })
})

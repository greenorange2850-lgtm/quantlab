import { describe, expect, it, beforeEach } from 'vitest'
import type { BacktestReport } from '@/core/analytics/types'
import { defaultRiskConfig } from '@/core/risk/config'
import { buildResearchReport, type ResearchSession } from '@/core/research'
import { appQueryClient } from '@/api/query-client'
import {
  researchSessionKeys,
  syncResearchSessionQueries,
} from '@/api/queries/research-sessions'
import {
  clearResearchSessionArchive,
  deleteResearchSession,
  listResearchSessionsBySavedAt,
  resetResearchSessionMemory,
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

function installMemoryLocalStorage(): void {
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
}

describe('research sessions archive + query sync', () => {
  beforeEach(() => {
    installMemoryLocalStorage()
    clearResearchSessionArchive()
    appQueryClient.clear()
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

  it('generated session appears in query list and updates count', () => {
    // Simulate visiting /research-sessions while empty (stale empty cache).
    appQueryClient.setQueryData(researchSessionKeys.list(), [])
    expect(appQueryClient.getQueryData(researchSessionKeys.list())).toEqual([])

    const session = makeSession({
      id: 'rs-1785330235023',
      symbol: 'BTCUSDT',
      interval: '1h',
      createdAt: 1_785_330_235_023,
      score: 1.75,
      netProfit: 180,
    })
    const entry = {
      session,
      report: buildResearchReport(session),
      savedAt: Date.now(),
    }
    saveResearchSession(entry)
    syncResearchSessionQueries()

    const list = appQueryClient.getQueryData(researchSessionKeys.list()) as
      | ReturnType<typeof listResearchSessionsBySavedAt>
      | undefined
    expect(list).toHaveLength(1)
    expect(list?.[0]?.session.id).toBe('rs-1785330235023')
    expect(toSessionListItem(list![0]!).id).toBe('rs-1785330235023')
    expect(
      appQueryClient.getQueryData(researchSessionKeys.detail('rs-1785330235023')),
    ).toEqual(entry)
  })

  it('persisted session restores after reload (memory drop, storage kept)', () => {
    const session = makeSession({
      id: 'rs-persist',
      symbol: 'SOLUSDT',
      interval: '4h',
      createdAt: 500,
      score: 2.2,
      netProfit: 300,
    })
    saveResearchSession({
      session,
      report: buildResearchReport(session),
      savedAt: 600,
    })
    syncResearchSessionQueries()
    expect(listResearchSessionsBySavedAt()).toHaveLength(1)

    // Simulate full page reload: drop memory + query cache, keep localStorage.
    resetResearchSessionMemory()
    appQueryClient.clear()
    expect(listResearchSessionsBySavedAt()).toHaveLength(1)
    expect(listResearchSessionsBySavedAt()[0]?.session.id).toBe('rs-persist')

    syncResearchSessionQueries()
    const list = appQueryClient.getQueryData(researchSessionKeys.list()) as
      | ReturnType<typeof listResearchSessionsBySavedAt>
      | undefined
    expect(list).toHaveLength(1)
    expect(list?.[0]?.session.id).toBe('rs-persist')
  })

  it('deleting a session removes it from the synced query list', () => {
    const session = makeSession({
      id: 'rs-del',
      symbol: 'BTCUSDT',
      interval: '1h',
      createdAt: 10,
      score: 1.1,
      netProfit: 40,
    })
    saveResearchSession({
      session,
      report: buildResearchReport(session),
      savedAt: 20,
    })
    syncResearchSessionQueries()
    expect(
      (appQueryClient.getQueryData(researchSessionKeys.list()) as unknown[]).length,
    ).toBe(1)

    expect(deleteResearchSession('rs-del')).toBe(true)
    syncResearchSessionQueries()

    expect(appQueryClient.getQueryData(researchSessionKeys.list())).toEqual([])
    expect(
      appQueryClient.getQueryData(researchSessionKeys.detail('rs-del')),
    ).toBeUndefined()
    expect(appQueryClient.getQueryData(researchSessionKeys.latest())).toBeNull()
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

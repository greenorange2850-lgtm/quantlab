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
  ensureResearchSessionArchiveHydrated,
  isResearchSessionArchiveHydrated,
  listResearchSessionsBySavedAt,
  resetResearchSessionMemory,
  saveResearchSession,
  slimResearchSessionForStorage,
} from '@/research/session-archive'
import { shouldAwaitResearchArchive } from '@/research/ui-gates'
import {
  collectFilterOptions,
  filterAndSortSessions,
  toSessionListItem,
} from '../session-list-model'

const STORAGE_KEY = 'quantlab.research-sessions.v1'

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
    equityCurve: Array.from({ length: 40 }, (_, i) => ({
      time: 1_700_000_000_000 + i * 3_600_000,
      equity: 10_000 + i,
      cash: 10_000,
      drawdown: 0,
    })),
    drawdown: {
      currentDrawdown: 0,
      maxDrawdown: 0.1,
      maxDrawdownDurationMs: 0,
      maxDrawdownRecoveryMs: null,
    },
    monthlyReturns: {
      months: [
        {
          month: '2024-01',
          startEquity: 10_000,
          endEquity: 10_000 + netProfit,
          monthlyReturn: netProfit / 10_000,
          cumulativeReturn: netProfit / 10_000,
        },
      ],
      bestMonth: null,
      worstMonth: null,
    },
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

function installMemoryLocalStorage(options?: {
  quotaBytes?: number
}): Map<string, string> {
  const store = new Map<string, string>()
  const quota = options?.quotaBytes
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (quota !== undefined) {
          const others = [...store.entries()]
            .filter(([k]) => k !== key)
            .reduce((sum, [, v]) => sum + v.length, 0)
          if (others + value.length > quota) {
            const err = new Error('QuotaExceededError')
            err.name = 'QuotaExceededError'
            throw err
          }
        }
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
  return store
}

/** Mirrors ResearchSessionsPage empty-state gate (no empty UI before hydrate). */
function shouldShowSessionsEmptyState(input: {
  archiveReady: boolean
  data: unknown[] | undefined
  isPending: boolean
}): boolean {
  if (
    shouldAwaitResearchArchive({
      archiveReady: input.archiveReady,
      hasData: Boolean(input.data),
      isPending: input.isPending,
    })
  ) {
    return false
  }
  return (input.data?.length ?? 0) === 0
}

describe('research sessions archive + query sync', () => {
  beforeEach(() => {
    installMemoryLocalStorage()
    clearResearchSessionArchive()
    appQueryClient.clear()
  })

  it('creating a session persists it under the stable storage key', () => {
    const session = makeSession({
      id: 'rs-create',
      symbol: 'ETHUSDT',
      interval: '1h',
      createdAt: 100,
      score: 1.8,
      netProfit: 200,
    })
    const ok = saveResearchSession({
      session,
      report: buildResearchReport(session),
      savedAt: 200,
    })
    expect(ok).toBe(true)

    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!) as Record<string, { session: { id: string } }>
    expect(parsed['rs-create']?.session.id).toBe('rs-create')
    expect(listResearchSessionsBySavedAt()).toHaveLength(1)
  })

  it('hydration restores sessions on startup (memory drop, storage kept)', () => {
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
    expect(isResearchSessionArchiveHydrated()).toBe(true)

    // Simulate tab close / reopen: module memory cleared, localStorage kept.
    resetResearchSessionMemory()
    appQueryClient.clear()
    expect(isResearchSessionArchiveHydrated()).toBe(false)

    ensureResearchSessionArchiveHydrated()
    expect(isResearchSessionArchiveHydrated()).toBe(true)
    expect(listResearchSessionsBySavedAt()).toHaveLength(1)
    expect(listResearchSessionsBySavedAt()[0]?.session.id).toBe('rs-persist')

    // List metrics still resolve from slim persisted summaries.
    const item = toSessionListItem(listResearchSessionsBySavedAt()[0]!)
    expect(item.netProfit).toBe(300)
    expect(item.totalTrades).toBe(12)
  })

  it('session list does not render empty before hydration completes', () => {
    expect(
      shouldShowSessionsEmptyState({
        archiveReady: false,
        data: undefined,
        isPending: true,
      }),
    ).toBe(false)

    expect(
      shouldShowSessionsEmptyState({
        archiveReady: true,
        data: undefined,
        isPending: true,
      }),
    ).toBe(false)

    expect(
      shouldShowSessionsEmptyState({
        archiveReady: true,
        data: [],
        isPending: false,
      }),
    ).toBe(true)

    expect(
      shouldShowSessionsEmptyState({
        archiveReady: true,
        data: [{ id: 'rs-1' }],
        isPending: false,
      }),
    ).toBe(false)
  })

  it('deleting a session removes it from persisted storage', () => {
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
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toHaveProperty('rs-del')

    expect(deleteResearchSession('rs-del')).toBe(true)
    expect(listResearchSessionsBySavedAt()).toHaveLength(0)

    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw!)).not.toHaveProperty('rs-del')
    expect(Object.keys(JSON.parse(raw!))).toHaveLength(0)
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

  it('deleting a session removes it from the synced query list', () => {
    const session = makeSession({
      id: 'rs-del-q',
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

    expect(deleteResearchSession('rs-del-q')).toBe(true)
    syncResearchSessionQueries()

    expect(appQueryClient.getQueryData(researchSessionKeys.list())).toEqual([])
    expect(
      appQueryClient.getQueryData(researchSessionKeys.detail('rs-del-q')),
    ).toBeUndefined()
    expect(appQueryClient.getQueryData(researchSessionKeys.latest())).toBeNull()
  })

  it('slim storage payload drops heavy series but keeps list metrics and period endpoints', () => {
    const session = makeSession({
      id: 'rs-slim',
      symbol: 'BTCUSDT',
      interval: '1h',
      createdAt: 1,
      score: 1.5,
      netProfit: 90,
    })
    const entry = {
      session,
      report: buildResearchReport(session),
      savedAt: 2,
    }
    const slim = slimResearchSessionForStorage(entry)
    expect(slim.session.candidates[0]!.report.equityCurve).toHaveLength(2)
    expect(slim.session.candidates[0]!.report.trades).toEqual([])
    expect(slim.session.candidates[0]!.report.summary.netProfit).toBe(90)

    const fullJson = JSON.stringify(entry)
    const slimJson = JSON.stringify(slim)
    expect(slimJson.length).toBeLessThan(fullJson.length / 2)
  })

  it('survives quota pressure by writing slim payloads', () => {
    // Tiny quota that a full equity/trades payload would blow past.
    installMemoryLocalStorage({ quotaBytes: 8_000 })
    clearResearchSessionArchive()

    const session = makeSession({
      id: 'rs-quota',
      symbol: 'BTCUSDT',
      interval: '1h',
      createdAt: 1,
      score: 1.4,
      netProfit: 55,
    })
    const ok = saveResearchSession({
      session,
      report: buildResearchReport(session),
      savedAt: 2,
    })
    expect(ok).toBe(true)

    resetResearchSessionMemory()
    expect(listResearchSessionsBySavedAt()[0]?.session.id).toBe('rs-quota')
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

    const byMarketSearch = filterAndSortSessions(items, {
      search: 'btc',
      market: '',
      timeframe: '',
      sort: 'newest',
    })
    expect(byMarketSearch.map((item) => item.id)).toEqual(['rs-3', 'rs-1'])
  })
})

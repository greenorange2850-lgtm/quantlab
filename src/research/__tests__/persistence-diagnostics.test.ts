import { describe, expect, it, beforeEach } from 'vitest'
import {
  classifyVercelHost,
  isEphemeralVercelDeploymentHost,
  shouldShowPersistenceDiagnostics,
  STABLE_VERCEL_PRODUCTION_URL,
} from '@/research/persistence-diagnostics'
import {
  clearResearchSessionArchive,
  ensureResearchSessionArchiveHydrated,
  getResearchSessionPersistenceDiagnostics,
  RESEARCH_SESSION_STORAGE_KEY,
  saveResearchSession,
} from '@/research/session-archive'
import { buildResearchReport, type ResearchSession } from '@/core/research'
import type { BacktestReport } from '@/core/analytics/types'
import { defaultRiskConfig } from '@/core/risk/config'

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
      clear: () => store.clear(),
    },
  })
}

function stubReport(): BacktestReport {
  return {
    summary: {
      totalTrades: 2,
      winRate: 0.5,
      netProfit: 10,
      profitFactor: 1.2,
      expectancy: 1,
      averageWin: 10,
      averageLoss: -5,
      maxDrawdown: 0.01,
      largestWinner: 10,
      largestLoser: -5,
      finalBalance: 10_010,
    },
    equityCurve: [],
    drawdown: {
      currentDrawdown: 0,
      maxDrawdown: 0.01,
      maxDrawdownDurationMs: 0,
      maxDrawdownRecoveryMs: null,
    },
    monthlyReturns: { months: [], bestMonth: null, worstMonth: null },
    tradeAnalysis: {
      averageWin: 10,
      averageLoss: -5,
      largestWinner: 10,
      largestLoser: -5,
      profitFactor: 1.2,
      expectancy: 1,
      averageHoldingTimeMs: 1,
      longPerformance: { trades: 2, netProfit: 10, winRate: 0.5 },
      shortPerformance: { trades: 0, netProfit: 0, winRate: 0 },
    },
    topTrades: [],
    statistics: {
      totalTrades: 2,
      winningTrades: 1,
      losingTrades: 1,
      winRate: 0.5,
      netProfit: 10,
      grossProfit: 10,
      grossLoss: -5,
      maxDrawdown: 0.01,
      averageTrade: 5,
      finalBalance: 10_010,
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

function makeSession(id: string): ResearchSession {
  const report = stubReport()
  return {
    id,
    status: 'completed',
    config: {
      iterations: 1,
      parameterRanges: [],
      objective: 'profitFactor',
      symbol: 'BTCUSDT',
      interval: '1h',
      limit: 50,
      initialCapital: 10_000,
    },
    candidates: [
      {
        id: `${id}-c1`,
        parameters: { fastPeriod: 10, slowPeriod: 30, rsiPeriod: 14 },
        score: 1.2,
        passedConstraints: true,
        report,
        backtestId: `bt-${id}`,
      },
    ],
    bestCandidateId: `${id}-c1`,
    error: null,
    createdAt: 1,
    completedAt: 2,
    progress: {
      totalCandidates: 1,
      candidatesTested: 1,
      candidatesAccepted: 1,
      candidatesRejected: 0,
      currentCandidateScore: 1.2,
      bestScore: 1.2,
      bestTradeCount: report.summary.totalTrades,
      bestCandidateParameters: { fastPeriod: 10, slowPeriod: 30, rsiPeriod: 14 },
      improvementsCount: 1,
      candidatesSinceLastImprovement: 0,
      elapsedMs: 0,
      wallElapsedMs: 0,
      pausedMs: 0,
      estimatedRemainingMs: 0,
      status: 'COMPLETED',
    },
  }
}

describe('vercel persistence origin helpers', () => {
  it('detects ephemeral per-deployment hosts vs stable alias', () => {
    expect(
      isEphemeralVercelDeploymentHost(
        'quantlab-frontend-8pa2sn2a0-greenorange.vercel.app',
      ),
    ).toBe(true)
    expect(
      isEphemeralVercelDeploymentHost('quantlab-frontend-14r84o1ld-greenorange.vercel.app'),
    ).toBe(true)
    expect(isEphemeralVercelDeploymentHost('quantlab-frontend.vercel.app')).toBe(false)
    expect(isEphemeralVercelDeploymentHost('localhost')).toBe(false)

    expect(
      classifyVercelHost('quantlab-frontend-8pa2sn2a0-greenorange.vercel.app').kind,
    ).toBe('ephemeral-deployment')
    expect(classifyVercelHost('quantlab-frontend.vercel.app').kind).toBe('stable-or-other')
    expect(STABLE_VERCEL_PRODUCTION_URL).toBe('https://quantlab-frontend.vercel.app')
  })

  it('shows diagnostics in dev, on vercel hosts, or with query flag', () => {
    expect(
      shouldShowPersistenceDiagnostics({
        isDev: true,
        hostname: 'localhost',
        search: '',
      }),
    ).toBe(true)
    expect(
      shouldShowPersistenceDiagnostics({
        isDev: false,
        hostname: 'quantlab-frontend-8pa2sn2a0-greenorange.vercel.app',
        search: '',
      }),
    ).toBe(true)
    expect(
      shouldShowPersistenceDiagnostics({
        isDev: false,
        hostname: 'example.com',
        search: '?persistDiag=1',
      }),
    ).toBe(true)
    expect(
      shouldShowPersistenceDiagnostics({
        isDev: false,
        hostname: 'example.com',
        search: '',
      }),
    ).toBe(false)
  })
})

describe('research session persistence diagnostics', () => {
  beforeEach(() => {
    installMemoryLocalStorage()
    clearResearchSessionArchive()
  })

  it('reports key, counts, and payload size without renaming the storage key', () => {
    const session = makeSession('rs-diag')
    saveResearchSession({
      session,
      report: buildResearchReport(session),
      savedAt: 10,
    })
    ensureResearchSessionArchiveHydrated()

    const diag = getResearchSessionPersistenceDiagnostics()
    expect(diag.storageKey).toBe(RESEARCH_SESSION_STORAGE_KEY)
    expect(diag.storageKey).toBe('quantlab.research-sessions.v1')
    expect(diag.hydrated).toBe(true)
    expect(diag.persistedCount).toBe(1)
    expect(diag.memoryCount).toBe(1)
    expect(diag.keyPresent).toBe(true)
    expect(diag.payloadBytes).toBeGreaterThan(0)
    expect(diag.lastPersistenceError).toBeNull()
  })
})

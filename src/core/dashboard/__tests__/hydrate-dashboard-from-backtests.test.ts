import { describe, expect, it } from 'vitest'
import type { Backtest, BacktestSummary, DashboardData } from '@trading-os/shared'
import { createEmptyDashboard } from '../empty-dashboard.js'
import { hydrateDashboardFromPersistedBacktests } from '../hydrate-dashboard-from-backtests.js'

const sampleSummary = (overrides: Partial<BacktestSummary> = {}): BacktestSummary => ({
  id: 'bt-1',
  version: 'v1.0.0',
  date: '2024-01-10',
  market: 'BTCUSDT',
  timeframe: 'H1',
  trades: 12,
  winRate: 58.3,
  profitFactor: 1.74,
  maxDrawdown: -6.2,
  netProfit: 840,
  status: 'completed',
  ...overrides,
})

const sampleDetail = (overrides: Partial<Backtest> = {}): Backtest => ({
  id: 'bt-1',
  strategyVersionId: 'sv-1',
  symbolId: 'sym-btcusdt',
  timeframeId: 'tf-h1',
  status: 'completed',
  startDate: '2024-01-01',
  endDate: '2024-01-10',
  initialCapital: 10_000,
  metrics: {
    winRate: 58.3,
    profitFactor: 1.74,
    maxDrawdown: -6.2,
    netProfit: 840,
    totalTrades: 12,
    averageRR: 1.9,
    expectedValue: 70,
    sharpeRatio: 1.2,
    recoveryFactor: 2.1,
    maxWinStreak: 4,
    maxLossStreak: 2,
  },
  equityCurve: [
    { date: '2024-01-01', equity: 10_000, drawdown: 0 },
    { date: '2024-01-10', equity: 10_840, drawdown: -1.5 },
  ],
  createdAt: '2024-01-10T00:00:00.000Z',
  completedAt: '2024-01-10T00:00:00.000Z',
  ...overrides,
})

describe('hydrateDashboardFromPersistedBacktests', () => {
  it('restores recent history, KPIs, and hasBacktest from summaries', () => {
    const empty = createEmptyDashboard()
    const hydrated = hydrateDashboardFromPersistedBacktests(empty, [sampleSummary()])

    expect(hydrated.hasBacktest).toBe(true)
    expect(hydrated.recentBacktests).toHaveLength(1)
    expect(hydrated.kpis.find((kpi) => kpi.id === 'win-rate')?.value).toBe(58.3)
    expect(hydrated.kpis.find((kpi) => kpi.id === 'net-profit')?.value).toBe(840)
    expect(hydrated.kpis.find((kpi) => kpi.id === 'status')?.value).toBe('Completed')
    expect(hydrated.activeStrategy.version).toBe('v1.0.0')
  })

  it('restores equity curve and portfolio from latest detail when present', () => {
    const hydrated = hydrateDashboardFromPersistedBacktests(
      createEmptyDashboard(),
      [sampleSummary()],
      { latest: sampleDetail() },
    )

    expect(hydrated.equityCurve).toHaveLength(2)
    expect(hydrated.equityCurve.at(-1)?.equity).toBe(10_840)
    expect(hydrated.portfolio.equity).toBe(10_840)
    expect(hydrated.portfolio.realizedPnL).toBe(840)
    expect(hydrated.kpis.find((kpi) => kpi.id === 'avg-rr')?.value).toBe(1.9)
  })

  it('only updates recentBacktests when preserving a live session dashboard', () => {
    const session = {
      ...createEmptyDashboard(),
      hasBacktest: true,
      kpis: createEmptyDashboard().kpis.map((kpi) =>
        kpi.id === 'win-rate' ? { ...kpi, value: 99 } : kpi,
      ),
    } satisfies DashboardData

    const hydrated = hydrateDashboardFromPersistedBacktests(
      session,
      [sampleSummary(), sampleSummary({ id: 'bt-2', market: 'ETHUSDT' })],
      { preserveSessionDashboard: true },
    )

    expect(hydrated.kpis.find((kpi) => kpi.id === 'win-rate')?.value).toBe(99)
    expect(hydrated.recentBacktests.map((item) => item.id)).toEqual(['bt-1', 'bt-2'])
  })

  it('clears hasBacktest when history is empty and session is not preserved', () => {
    const prior = hydrateDashboardFromPersistedBacktests(createEmptyDashboard(), [
      sampleSummary(),
    ])
    const cleared = hydrateDashboardFromPersistedBacktests(prior, [])
    expect(cleared.hasBacktest).toBe(false)
    expect(cleared.recentBacktests).toEqual([])
  })
})

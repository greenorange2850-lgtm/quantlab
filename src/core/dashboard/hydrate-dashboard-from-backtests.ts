import type {
  Backtest,
  BacktestSummary,
  DashboardData,
  KpiMetric,
} from '@trading-os/shared'

export interface HydrateDashboardOptions {
  /** Full latest backtest row (metrics + equity) when available from GET /backtests/:id. */
  latest?: Backtest | null
  /**
   * When true, only replace `recentBacktests`.
   * Use while a live session report already owns the dashboard.
   */
  preserveSessionDashboard?: boolean
}

function upsertKpi(kpis: KpiMetric[], id: string, value: KpiMetric['value'], trend?: KpiMetric['trend']): KpiMetric[] {
  return kpis.map((kpi) =>
    kpi.id === id
      ? {
          ...kpi,
          value,
          ...(trend ? { trend } : {}),
        }
      : kpi,
  )
}

function trendFromNumber(value: number): KpiMetric['trend'] {
  if (value > 0) return 'up'
  if (value < 0) return 'down'
  return 'neutral'
}

/**
 * Overlay persisted backtest history onto the dashboard presentation model.
 *
 * - Always refreshes `recentBacktests` from the server list.
 * - When no live session owns the dashboard, also restores summary-level KPIs,
 *   strategy labels, optional equity curve, and `hasBacktest`.
 */
export function hydrateDashboardFromPersistedBacktests(
  current: DashboardData,
  summaries: readonly BacktestSummary[],
  options: HydrateDashboardOptions = {},
): DashboardData {
  const recentBacktests = summaries.slice(0, 12)

  if (options.preserveSessionDashboard) {
    return {
      ...current,
      recentBacktests,
    }
  }

  if (recentBacktests.length === 0) {
    return {
      ...current,
      recentBacktests: [],
      hasBacktest: false,
    }
  }

  const latestSummary = recentBacktests[0]!
  const detail = options.latest ?? null
  const metrics = detail?.metrics

  const winRate = metrics?.winRate ?? latestSummary.winRate
  const profitFactor = metrics?.profitFactor ?? latestSummary.profitFactor
  const maxDrawdown = metrics?.maxDrawdown ?? latestSummary.maxDrawdown
  const netProfit = metrics?.netProfit ?? latestSummary.netProfit
  const totalTrades = metrics?.totalTrades ?? latestSummary.trades
  const averageRR = metrics?.averageRR ?? 0
  const maxWinStreak = metrics?.maxWinStreak ?? 0
  const maxLossStreak = metrics?.maxLossStreak ?? 0
  const expectedValue = metrics?.expectedValue ?? 0
  const sharpeRatio = metrics?.sharpeRatio ?? 0
  const recoveryFactor = metrics?.recoveryFactor ?? 0

  let kpis = current.kpis
  kpis = upsertKpi(kpis, 'active-strategy', latestSummary.market, 'neutral')
  kpis = upsertKpi(kpis, 'version', latestSummary.version, 'neutral')
  kpis = upsertKpi(kpis, 'status', 'Completed', 'up')
  kpis = upsertKpi(kpis, 'win-rate', winRate, trendFromNumber(winRate - 50))
  kpis = upsertKpi(kpis, 'profit-factor', profitFactor, trendFromNumber(profitFactor - 1))
  kpis = upsertKpi(kpis, 'max-drawdown', maxDrawdown, 'down')
  kpis = upsertKpi(kpis, 'net-profit', netProfit, trendFromNumber(netProfit))
  kpis = upsertKpi(kpis, 'total-trades', totalTrades, 'neutral')
  kpis = upsertKpi(kpis, 'avg-rr', averageRR, trendFromNumber(averageRR))
  kpis = upsertKpi(kpis, 'consecutive-wins', maxWinStreak, 'up')
  kpis = upsertKpi(kpis, 'consecutive-losses', maxLossStreak, 'down')

  const equityCurve =
    detail?.equityCurve && detail.equityCurve.length > 0
      ? detail.equityCurve
      : current.equityCurve

  const lastEquity = equityCurve.at(-1)?.equity
  const initialCapital = detail?.initialCapital ?? current.portfolio.cash

  return {
    ...current,
    activeStrategy: {
      name: latestSummary.market,
      version: latestSummary.version,
      status: 'active',
    },
    kpis,
    equityCurve,
    bestStrategy: {
      ...current.bestStrategy,
      name: latestSummary.market,
      version: latestSummary.version,
      winRate,
      profitFactor,
      drawdown: Math.abs(maxDrawdown),
      tradeCount: totalTrades,
      expectedValue,
      sharpeRatio,
      recoveryFactor,
      score: Math.max(0, Math.min(100, Math.round(winRate))),
    },
    overallHealthScore: Math.max(0, Math.min(100, Math.round(winRate))),
    recentBacktests,
    portfolio: {
      ...current.portfolio,
      cash: lastEquity ?? initialCapital,
      equity: lastEquity ?? initialCapital,
      buyingPower: lastEquity ?? initialCapital,
      realizedPnL: netProfit,
    },
    timeframeDistribution:
      current.timeframeDistribution[0]?.name === 'No data'
        ? [{ name: latestSummary.timeframe, value: 1, color: '#6366f1' }]
        : current.timeframeDistribution,
    hasBacktest: true,
  }
}

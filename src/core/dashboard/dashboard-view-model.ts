import type {
  BacktestSummary,
  DailyHeatmapCell,
  DashboardData,
  DashboardTradeRow,
  DistributionItem,
  EquityPoint,
  KpiMetric,
  MonthlyProfit,
  PortfolioSnapshot,
  TradeDirection,
  WeeklySummary,
} from '@trading-os/shared'
import type { Candle } from '../../data/candles.js'
import {
  computeAverageRiskReward,
  computeTradeStreaks,
} from '../analytics/trade-analyzer.js'
import type { BacktestReport } from '../analytics/types.js'
import { TradeDirection as CoreTradeDirection } from '../backtest/Trade.js'
import type { Trade } from '../backtest/Trade.js'
import { buildPortfolioFromBacktestBalances } from '../portfolio/index.js'

export interface DashboardViewModelContext {
  strategyName: string
  strategyVersion: string
  timeframe: string
  candles?: readonly Candle[]
}

const WIN_COLOR = '#22c55e'
const LOSS_COLOR = '#ef4444'
const LONG_COLOR = '#6366f1'
const SHORT_COLOR = '#a855f7'

function ratioToPercent(ratio: number): number {
  return Math.round(ratio * 1000) / 10
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-')
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1))
  return date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
}

function isoDate(time: number): string {
  return new Date(time).toISOString().split('T')[0]
}

function buildBuyHoldByTime(
  candles: readonly Candle[],
  initialCapital: number,
): ReadonlyMap<number, number> {
  if (candles.length === 0) {
    return new Map()
  }

  const firstClose = candles[0].close
  const map = new Map<number, number>()

  for (const candle of candles) {
    map.set(candle.time, initialCapital * (candle.close / firstClose))
  }

  return map
}

function subsampleEquityPoints<T>(points: T[], maxPoints = 400): T[] {
  if (points.length <= maxPoints) {
    return points
  }

  const step = Math.ceil(points.length / maxPoints)
  const sampled: T[] = []

  for (let index = 0; index < points.length; index += step) {
    sampled.push(points[index])
  }

  const last = points.at(-1)
  if (last && sampled.at(-1) !== last) {
    sampled.push(last)
  }

  return sampled
}

function mapEquityCurve(
  report: BacktestReport,
  buyHoldByTime: ReadonlyMap<number, number>,
): EquityPoint[] {
  const points = subsampleEquityPoints(report.equityCurve).map((point) => ({
    date: isoDate(point.time),
    equity: Math.round(point.equity * 100) / 100,
    drawdown: Math.round(ratioToPercent(point.drawdown) * 100) / 100,
    buyHold: buyHoldByTime.has(point.time)
      ? Math.round((buyHoldByTime.get(point.time) ?? 0) * 100) / 100
      : undefined,
  }))

  return points
}

function countTradesByMonth(trades: Trade[]): Map<string, number> {
  const counts = new Map<string, number>()

  for (const trade of trades) {
    const month = isoDate(trade.exitTime).slice(0, 7)
    counts.set(month, (counts.get(month) ?? 0) + 1)
  }

  return counts
}

function buildMonthlyProfit(report: BacktestReport): MonthlyProfit[] {
  const tradeCounts = countTradesByMonth(report.trades)

  return report.monthlyReturns.months.map((month) => ({
    month: formatMonthLabel(month.month),
    profit: Math.round((month.endEquity - month.startEquity) * 100) / 100,
    trades: tradeCounts.get(month.month) ?? 0,
  }))
}

function buildDailyHeatmap(trades: Trade[]): DailyHeatmapCell[] {
  if (trades.length === 0) {
    const today = isoDate(Date.now())
    return [{ date: today, day: 0, week: 0, profit: 0 }]
  }

  const profitByDate = new Map<string, number>()

  for (const trade of trades) {
    const date = isoDate(trade.exitTime)
    profitByDate.set(date, (profitByDate.get(date) ?? 0) + trade.pnl)
  }

  const sortedDates = [...profitByDate.keys()].sort()
  const startDate = new Date(sortedDates[0])
  const cells: DailyHeatmapCell[] = []

  for (let offset = 0; offset < 90; offset++) {
    const date = new Date(startDate)
    date.setUTCDate(date.getUTCDate() + offset)
    const key = isoDate(date.getTime())
    const day = (date.getUTCDay() + 6) % 7
    const week = Math.floor(offset / 7)

    cells.push({
      date: key,
      day,
      week,
      profit: Math.round((profitByDate.get(key) ?? 0) * 100) / 100,
    })
  }

  return cells
}

function buildWeeklySummary(trades: Trade[]): WeeklySummary[] {
  if (trades.length === 0) {
    return [{ week: 'W01', profit: 0, trades: 0, winRate: 0 }]
  }

  const buckets = new Map<string, { profit: number; trades: number; wins: number }>()

  for (const trade of trades) {
    const date = new Date(trade.exitTime)
    const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1)
    const week = Math.ceil(((date.getTime() - yearStart) / 86_400_000 + date.getUTCDay() + 1) / 7)
    const key = `W${String(week).padStart(2, '0')}`
    const bucket = buckets.get(key) ?? { profit: 0, trades: 0, wins: 0 }
    bucket.profit += trade.pnl
    bucket.trades += 1
    if (trade.pnl > 0) {
      bucket.wins += 1
    }
    buckets.set(key, bucket)
  }

  return [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-6)
    .map(([week, bucket]) => ({
      week,
      profit: Math.round(bucket.profit * 100) / 100,
      trades: bucket.trades,
      winRate: bucket.trades > 0 ? Math.round((bucket.wins / bucket.trades) * 1000) / 10 : 0,
    }))
}

function buildWinLossDistribution(trades: Trade[]): DistributionItem[] {
  const wins = trades.filter((trade) => trade.pnl > 0).length
  const losses = trades.filter((trade) => trade.pnl < 0).length

  if (wins === 0 && losses === 0) {
    return [{ name: 'No trades', value: 1, color: '#71717a' }]
  }

  return [
    { name: 'Wins', value: wins, color: WIN_COLOR },
    { name: 'Losses', value: losses, color: LOSS_COLOR },
  ]
}

function buildLongShortDistribution(trades: Trade[]): DistributionItem[] {
  const longs = trades.filter((trade) => trade.direction === CoreTradeDirection.LONG).length
  const shorts = trades.filter((trade) => trade.direction === CoreTradeDirection.SHORT).length

  if (longs === 0 && shorts === 0) {
    return [{ name: 'No trades', value: 1, color: '#71717a' }]
  }

  return [
    { name: 'Long', value: longs, color: LONG_COLOR },
    { name: 'Short', value: shorts, color: SHORT_COLOR },
  ]
}

function mapCoreDirection(direction: Trade['direction']): TradeDirection {
  return direction === CoreTradeDirection.SHORT ? 'short' : 'long'
}

function buildTradeHistory(trades: Trade[]): DashboardTradeRow[] {
  return [...trades]
    .sort((left, right) => right.exitTime - left.exitTime)
    .map((trade) => {
      const returnPercent =
        trade.entryPrice > 0
          ? ((trade.exitPrice - trade.entryPrice) / trade.entryPrice) *
            (trade.direction === CoreTradeDirection.SHORT ? -100 : 100)
          : 0

      return {
        id: trade.id,
        symbol: trade.symbol,
        side: mapCoreDirection(trade.direction),
        entryPrice: trade.entryPrice,
        exitPrice: trade.exitPrice,
        quantity: trade.quantity,
        pnl: trade.pnl,
        returnPercent: Math.round(returnPercent * 100) / 100,
        durationMs: trade.duration,
      }
    })
}

function buildKpis(
  report: BacktestReport,
  context: DashboardViewModelContext,
  streaks: ReturnType<typeof computeTradeStreaks>,
  averageRiskReward: number,
): KpiMetric[] {
  const { summary } = report
  const winRatePercent = ratioToPercent(summary.winRate)
  const maxDrawdownPercent = -ratioToPercent(summary.maxDrawdown)
  const avgRr = Number.isFinite(averageRiskReward) ? Math.round(averageRiskReward * 100) / 100 : 0

  return [
    { id: 'active-strategy', label: 'Active Strategy', value: context.strategyName, format: 'text' },
    { id: 'version', label: 'Current Version', value: context.strategyVersion, format: 'text' },
    {
      id: 'status',
      label: 'Status',
      value: summary.totalTrades > 0 ? 'Active' : 'No trades',
      format: 'text',
      trend: summary.netProfit >= 0 ? 'up' : 'down',
    },
    {
      id: 'win-rate',
      label: 'Win Rate',
      value: winRatePercent,
      format: 'percent',
      trend: winRatePercent >= 50 ? 'up' : 'down',
    },
    {
      id: 'profit-factor',
      label: 'Profit Factor',
      value: Math.round(summary.profitFactor * 100) / 100,
      format: 'number',
      trend: summary.profitFactor >= 1 ? 'up' : 'down',
    },
    {
      id: 'max-drawdown',
      label: 'Max Drawdown',
      value: maxDrawdownPercent,
      format: 'percent',
      trend: maxDrawdownPercent > -10 ? 'up' : 'down',
    },
    {
      id: 'net-profit',
      label: 'Net Profit',
      value: Math.round(summary.netProfit * 100) / 100,
      format: 'currency',
      trend: summary.netProfit >= 0 ? 'up' : 'down',
    },
    {
      id: 'total-trades',
      label: 'Total Trades',
      value: summary.totalTrades,
      format: 'number',
      trend: 'neutral',
    },
    {
      id: 'avg-rr',
      label: 'Average RR',
      value: avgRr,
      format: 'number',
      trend: avgRr >= 1 ? 'up' : 'down',
    },
    {
      id: 'consecutive-wins',
      label: 'Consecutive Wins',
      value: streaks.consecutiveWins,
      format: 'number',
      trend: streaks.consecutiveWins > 0 ? 'up' : 'neutral',
    },
    {
      id: 'consecutive-losses',
      label: 'Consecutive Losses',
      value: streaks.consecutiveLosses,
      format: 'number',
      trend: streaks.consecutiveLosses > 0 ? 'down' : 'neutral',
    },
  ]
}

function buildStrategyHealth(report: BacktestReport): DashboardData['strategyHealth'] {
  const { summary } = report
  const winRateScore = Math.min(100, Math.round(summary.winRate * 100))
  const profitFactorScore = Math.min(100, Math.round(summary.profitFactor * 40))
  const drawdownScore = Math.min(100, Math.round((1 - summary.maxDrawdown) * 100))
  const profitabilityScore = Math.min(
    100,
    Math.max(0, Math.round(50 + summary.netProfit / report.config.initialCapital / 2)),
  )
  const tradeQualityScore = Math.min(
    100,
    Math.max(0, Math.round(50 + summary.expectancy)),
  )

  return [
    { id: 'profitability', label: 'Profitability', score: profitabilityScore },
    { id: 'consistency', label: 'Consistency', score: winRateScore },
    { id: 'risk-control', label: 'Risk Control', score: drawdownScore },
    { id: 'drawdown', label: 'Drawdown', score: drawdownScore },
    { id: 'trade-quality', label: 'Trade Quality', score: tradeQualityScore },
    { id: 'execution', label: 'Execution Quality', score: profitFactorScore },
  ]
}

function buildPortfolioSnapshot(report: BacktestReport): PortfolioSnapshot {
  const lastPoint = report.equityCurve.at(-1)
  const cash = lastPoint?.cash ?? report.config.initialCapital
  const equity = lastPoint?.equity ?? report.summary.finalBalance

  const portfolio = buildPortfolioFromBacktestBalances({
    cash,
    equity,
    realizedPnL: report.summary.netProfit,
    positions: [],
  })

  return {
    cash: portfolio.cash,
    equity: portfolio.equity,
    buyingPower: portfolio.buyingPower,
    realizedPnL: portfolio.realizedPnL,
    unrealizedPnL: portfolio.unrealizedPnL,
    totalExposure: portfolio.totalExposure,
    positions: portfolio.positions,
  }
}

function buildBacktestSummary(
  report: BacktestReport,
  context: DashboardViewModelContext,
  id: string,
): BacktestSummary {
  const { summary } = report

  return {
    id,
    version: context.strategyVersion,
    date: isoDate(report.equityCurve.at(-1)?.time ?? Date.now()),
    market: report.config.symbol,
    timeframe: context.timeframe,
    trades: summary.totalTrades,
    winRate: ratioToPercent(summary.winRate),
    profitFactor: Math.round(summary.profitFactor * 100) / 100,
    maxDrawdown: -ratioToPercent(summary.maxDrawdown),
    netProfit: Math.round(summary.netProfit * 100) / 100,
    status: 'completed',
  }
}

/**
 * Maps analytics output into the dashboard presentation model.
 */
export function buildDashboardViewModel(
  report: BacktestReport,
  context: DashboardViewModelContext,
  recentBacktests: BacktestSummary[] = [],
): DashboardData {
  const streaks = computeTradeStreaks(report.trades)
  const averageRiskReward = computeAverageRiskReward(
    report.summary.averageWin,
    report.summary.averageLoss,
  )
  const buyHoldByTime = buildBuyHoldByTime(
    context.candles ?? [],
    report.config.initialCapital,
  )
  const strategyHealth = buildStrategyHealth(report)
  const overallHealthScore = Math.round(
    strategyHealth.reduce((sum, metric) => sum + metric.score, 0) / strategyHealth.length,
  )

  return {
    activeStrategy: {
      name: context.strategyName,
      version: context.strategyVersion,
      status: 'active',
    },
    kpis: buildKpis(report, context, streaks, averageRiskReward),
    equityCurve: mapEquityCurve(report, buyHoldByTime),
    monthlyProfit: buildMonthlyProfit(report),
    dailyHeatmap: buildDailyHeatmap(report.trades),
    weeklySummary: buildWeeklySummary(report.trades),
    winLossDistribution: buildWinLossDistribution(report.trades),
    longShortDistribution: buildLongShortDistribution(report.trades),
    sessionDistribution: [{ name: 'Unavailable', value: 1, color: '#71717a' }],
    timeframeDistribution: [
      { name: context.timeframe, value: report.trades.length || 1, color: LONG_COLOR },
    ],
    riskDistribution: [
      {
        name: `${report.config.positionSizePercent}%`,
        value: report.trades.length || 1,
        color: LONG_COLOR,
      },
    ],
    bestStrategy: {
      name: context.strategyName,
      version: context.strategyVersion,
      filtersEnabled: ['EMA Cross', 'RSI Confirmation'],
      score: overallHealthScore,
      winRate: ratioToPercent(report.summary.winRate),
      profitFactor: Math.round(report.summary.profitFactor * 100) / 100,
      drawdown: ratioToPercent(report.summary.maxDrawdown),
      tradeCount: report.summary.totalTrades,
      expectedValue: Math.round(report.summary.expectancy * 100) / 100,
      sharpeRatio: 0,
      recoveryFactor:
        report.summary.maxDrawdown > 0
          ? Math.round((report.summary.netProfit / report.config.initialCapital / report.summary.maxDrawdown) * 100) / 100
          : 0,
    },
    aiRecommendation: {
      suggestions: [
        {
          id: 'session-filter',
          text: 'Add session filter when session metadata is available',
          type: 'add',
        },
        {
          id: 'risk-cap',
          text: 'Review position sizing against risk limits',
          type: 'avoid',
        },
      ],
      confidence: Math.min(95, overallHealthScore),
      reasoning: `Backtest completed with ${report.summary.totalTrades} trades, ${ratioToPercent(report.summary.winRate).toFixed(1)}% win rate and ${Math.round(report.summary.profitFactor * 100) / 100} profit factor.`,
    },
    strategyHealth,
    overallHealthScore,
    recentBacktests,
    tradeHistory: buildTradeHistory(report.trades),
    marketContext: {
      newsSentiment: 50,
      fearGreed: 50,
      volatility: Math.round(ratioToPercent(report.drawdown.maxDrawdown) * 10) / 10,
      upcomingEvents: [],
      liquidityStatus: 'medium',
      marketSession: 'Backtest',
      currentSpread: 0,
    },
    watchlist: [
      {
        symbol: report.config.symbol,
        price: report.trades.at(-1)?.exitPrice ?? 0,
        dailyChange: ratioToPercent(
          report.summary.netProfit / Math.max(report.config.initialCapital, 1),
        ),
        trend: report.summary.netProfit >= 0 ? 'bullish' : 'bearish',
        signal: report.summary.netProfit >= 0 ? 'buy' : 'sell',
      },
    ],
    portfolio: buildPortfolioSnapshot(report),
    hasBacktest: true,
  }
}

export function createBacktestSummaryFromReport(
  report: BacktestReport,
  context: DashboardViewModelContext,
  id: string,
): BacktestSummary {
  return buildBacktestSummary(report, context, id)
}

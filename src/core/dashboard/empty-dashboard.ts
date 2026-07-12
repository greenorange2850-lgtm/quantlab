import type { DashboardData } from '@trading-os/shared'

const PLACEHOLDER_DISTRIBUTION = [
  { name: 'No data', value: 1, color: '#71717a' },
] as const

/**
 * Dashboard presentation model shown before any backtest has been executed.
 */
export function createEmptyDashboard(): DashboardData {
  const today = new Date().toISOString().split('T')[0]

  return {
    activeStrategy: {
      name: 'No strategy selected',
      version: '—',
      status: 'draft',
    },
    kpis: [
      { id: 'active-strategy', label: 'Active Strategy', value: '—', format: 'text' },
      { id: 'version', label: 'Current Version', value: '—', format: 'text' },
      { id: 'status', label: 'Status', value: 'Awaiting backtest', format: 'text', trend: 'neutral' },
      { id: 'win-rate', label: 'Win Rate', value: 0, format: 'percent', trend: 'neutral' },
      { id: 'profit-factor', label: 'Profit Factor', value: 0, format: 'number', trend: 'neutral' },
      { id: 'max-drawdown', label: 'Max Drawdown', value: 0, format: 'percent', trend: 'neutral' },
      { id: 'net-profit', label: 'Net Profit', value: 0, format: 'currency', trend: 'neutral' },
      { id: 'total-trades', label: 'Total Trades', value: 0, format: 'number', trend: 'neutral' },
      { id: 'avg-rr', label: 'Average RR', value: 0, format: 'number', trend: 'neutral' },
      { id: 'consecutive-wins', label: 'Consecutive Wins', value: 0, format: 'number', trend: 'neutral' },
      { id: 'consecutive-losses', label: 'Consecutive Losses', value: 0, format: 'number', trend: 'neutral' },
    ],
    equityCurve: [],
    monthlyProfit: [],
    dailyHeatmap: [{ date: today, day: 0, week: 0, profit: 0 }],
    weeklySummary: [{ week: 'W01', profit: 0, trades: 0, winRate: 0 }],
    winLossDistribution: [...PLACEHOLDER_DISTRIBUTION],
    longShortDistribution: [...PLACEHOLDER_DISTRIBUTION],
    sessionDistribution: [...PLACEHOLDER_DISTRIBUTION],
    timeframeDistribution: [...PLACEHOLDER_DISTRIBUTION],
    riskDistribution: [...PLACEHOLDER_DISTRIBUTION],
    bestStrategy: {
      name: '—',
      version: '—',
      filtersEnabled: [],
      score: 0,
      winRate: 0,
      profitFactor: 0,
      drawdown: 0,
      tradeCount: 0,
      expectedValue: 0,
      sharpeRatio: 0,
      recoveryFactor: 0,
    },
    aiRecommendation: {
      suggestions: [],
      confidence: 0,
      reasoning: 'Run a backtest in Strategy Lab to generate performance insights.',
    },
    strategyHealth: [
      { id: 'profitability', label: 'Profitability', score: 0 },
      { id: 'consistency', label: 'Consistency', score: 0 },
      { id: 'risk-control', label: 'Risk Control', score: 0 },
      { id: 'drawdown', label: 'Drawdown', score: 0 },
      { id: 'trade-quality', label: 'Trade Quality', score: 0 },
      { id: 'execution', label: 'Execution Quality', score: 0 },
    ],
    overallHealthScore: 0,
    recentBacktests: [],
    tradeHistory: [],
    marketContext: {
      newsSentiment: 0,
      fearGreed: 50,
      volatility: 0,
      upcomingEvents: [],
      liquidityStatus: 'medium',
      marketSession: '—',
      currentSpread: 0,
    },
    watchlist: [],
    portfolio: {
      cash: 0,
      equity: 0,
      buyingPower: 0,
      realizedPnL: 0,
      unrealizedPnL: 0,
      totalExposure: 0,
      positions: [],
    },
    hasBacktest: false,
  }
}

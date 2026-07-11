/**
 * Dashboard service — bridges database + mock data during transition.
 * Will be replaced with real aggregation from repositories as modules come online.
 */
import type { DashboardData } from '@trading-os/shared'

function generateEquityCurve(): DashboardData['equityCurve'] {
  const points: DashboardData['equityCurve'] = []
  let equity = 10000
  const start = new Date('2024-01-01')

  for (let i = 0; i < 365; i++) {
    const date = new Date(start)
    date.setDate(date.getDate() + i)
    equity *= 1 + (Math.random() - 0.42) * 0.015

    if (i % 3 === 0) {
      points.push({
        date: date.toISOString().split('T')[0],
        equity: Math.round(equity * 100) / 100,
        drawdown: 0,
        buyHold: Math.round((10000 * (1 + i * 0.0003)) * 100) / 100,
      })
    }
  }
  return points
}

export const dashboardData: DashboardData = {
  activeStrategy: { name: 'Momentum Breakout v3.2', version: 'v3.2.1', status: 'active' },
  kpis: [
    { id: 'active-strategy', label: 'Active Strategy', value: 'Momentum Breakout', format: 'text' },
    { id: 'version', label: 'Current Version', value: 'v3.2.1', format: 'text' },
    { id: 'status', label: 'Status', value: 'Active', format: 'text', trend: 'up' },
    { id: 'win-rate', label: 'Win Rate', value: 62.4, format: 'percent', change: 2.1, trend: 'up' },
    { id: 'profit-factor', label: 'Profit Factor', value: 1.87, format: 'number', change: 0.12, trend: 'up' },
    { id: 'max-drawdown', label: 'Max Drawdown', value: -8.3, format: 'percent', change: -0.5, trend: 'up' },
    { id: 'net-profit', label: 'Net Profit', value: 24750, format: 'currency', change: 12.4, trend: 'up' },
    { id: 'total-trades', label: 'Total Trades', value: 342, format: 'number', change: 18, trend: 'up' },
    { id: 'avg-rr', label: 'Average RR', value: 2.14, format: 'number', change: 0.08, trend: 'up' },
    { id: 'consecutive-wins', label: 'Consecutive Wins', value: 7, format: 'number', trend: 'up' },
    { id: 'consecutive-losses', label: 'Consecutive Losses', value: 0, format: 'number', trend: 'neutral' },
  ],
  equityCurve: generateEquityCurve(),
  monthlyProfit: [
    { month: 'Aug', profit: 2840, trades: 28 }, { month: 'Sep', profit: 1920, trades: 31 },
    { month: 'Oct', profit: -680, trades: 26 }, { month: 'Nov', profit: 4120, trades: 34 },
    { month: 'Dec', profit: 3560, trades: 29 }, { month: 'Jan', profit: 5280, trades: 38 },
    { month: 'Feb', profit: 2940, trades: 32 }, { month: 'Mar', profit: 6180, trades: 41 },
    { month: 'Apr', profit: 1890, trades: 27 }, { month: 'May', profit: 4320, trades: 35 },
    { month: 'Jun', profit: 3760, trades: 33 }, { month: 'Jul', profit: 2820, trades: 18 },
  ],
  dailyHeatmap: Array.from({ length: 90 }, (_, i) => ({
    date: new Date(2025, 0, i + 1).toISOString().split('T')[0],
    day: i % 7, week: Math.floor(i / 7),
    profit: Math.round((Math.random() - 0.35) * 800 * 100) / 100,
  })),
  weeklySummary: [
    { week: 'W27', profit: 1240, trades: 12, winRate: 66.7 },
    { week: 'W28', profit: 890, trades: 9, winRate: 55.6 },
    { week: 'W29', profit: -320, trades: 11, winRate: 36.4 },
    { week: 'W30', profit: 2180, trades: 14, winRate: 71.4 },
    { week: 'W31', profit: 1560, trades: 10, winRate: 60.0 },
    { week: 'W32', profit: 940, trades: 8, winRate: 62.5 },
  ],
  winLossDistribution: [
    { name: 'Wins', value: 214, color: '#22c55e' },
    { name: 'Losses', value: 128, color: '#ef4444' },
  ],
  longShortDistribution: [
    { name: 'Long', value: 198, color: '#6366f1' },
    { name: 'Short', value: 144, color: '#a855f7' },
  ],
  sessionDistribution: [
    { name: 'London', value: 142, color: '#3b82f6' },
    { name: 'New York', value: 118, color: '#f59e0b' },
    { name: 'Asian', value: 52, color: '#8b5cf6' },
    { name: 'Overlap', value: 30, color: '#22c55e' },
  ],
  timeframeDistribution: [
    { name: 'M15', value: 86, color: '#6366f1' },
    { name: 'H1', value: 142, color: '#3b82f6' },
    { name: 'H4', value: 78, color: '#22c55e' },
    { name: 'D1', value: 36, color: '#f59e0b' },
  ],
  riskDistribution: [
    { name: '0.5%', value: 48, color: '#22c55e' },
    { name: '1.0%', value: 186, color: '#6366f1' },
    { name: '1.5%', value: 78, color: '#f59e0b' },
    { name: '2.0%', value: 30, color: '#ef4444' },
  ],
  bestStrategy: {
    name: 'Momentum Breakout', version: 'v3.2.1',
    filtersEnabled: ['EMA200', 'London Session', 'HTF Bias', 'FVG Confirmation'],
    score: 87, winRate: 62.4, profitFactor: 1.87, drawdown: 8.3,
    tradeCount: 342, expectedValue: 72.37, sharpeRatio: 1.94, recoveryFactor: 2.98,
  },
  aiRecommendation: {
    suggestions: [
      { id: '1', text: 'Add EMA200 Filter', type: 'add' },
      { id: '2', text: 'Enable London Session', type: 'add' },
      { id: '3', text: 'Enable HTF Bias', type: 'add' },
      { id: '4', text: 'Add FVG Confirmation', type: 'add' },
      { id: '5', text: 'Martingale', type: 'avoid' },
      { id: '6', text: 'ATR Filter', type: 'avoid' },
      { id: '7', text: 'Friday Session', type: 'avoid' },
    ],
    confidence: 84,
    reasoning: 'London session entries show 18% higher win rate. HTF bias reduces false breakouts by 24%.',
  },
  strategyHealth: [
    { id: 'profitability', label: 'Profitability', score: 88 },
    { id: 'consistency', label: 'Consistency', score: 76 },
    { id: 'risk-control', label: 'Risk Control', score: 82 },
    { id: 'drawdown', label: 'Drawdown', score: 79 },
    { id: 'trade-quality', label: 'Trade Quality', score: 85 },
    { id: 'execution', label: 'Execution Quality', score: 91 },
  ],
  overallHealthScore: 84,
  recentBacktests: [],
  marketContext: {
    newsSentiment: 62, fearGreed: 58, volatility: 24.6,
    upcomingEvents: [
      { id: 'ev-1', time: '14:30', event: 'US CPI m/m', impact: 'high', currency: 'USD' },
      { id: 'ev-2', time: '15:00', event: 'FOMC Minutes', impact: 'high', currency: 'USD' },
    ],
    liquidityStatus: 'high', marketSession: 'London / New York Overlap', currentSpread: 0.18,
  },
  watchlist: [
    { symbol: 'XAUUSD', price: 2347.82, dailyChange: 0.42, trend: 'bullish', signal: 'buy' },
    { symbol: 'EURUSD', price: 1.0842, dailyChange: -0.18, trend: 'bearish', signal: 'sell' },
    { symbol: 'GBPUSD', price: 1.2734, dailyChange: 0.24, trend: 'bullish', signal: 'hold' },
    { symbol: 'USDJPY', price: 157.42, dailyChange: -0.31, trend: 'bearish', signal: 'sell' },
    { symbol: 'BTCUSD', price: 67240.5, dailyChange: 1.84, trend: 'bullish', signal: 'buy' },
    { symbol: 'ETHUSD', price: 3482.18, dailyChange: 2.12, trend: 'bullish', signal: 'buy' },
  ],
}

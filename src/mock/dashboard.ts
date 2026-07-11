import type { DashboardData } from '@/types'

function generateEquityCurve(): DashboardData['equityCurve'] {
  const points: DashboardData['equityCurve'] = []
  let equity = 10000
  let buyHold = 10000
  let peak = 10000
  const startDate = new Date('2024-01-01')

  for (let i = 0; i < 365; i++) {
    const date = new Date(startDate)
    date.setDate(date.getDate() + i)

    equity *= 1 + (Math.random() - 0.42) * 0.015
    buyHold *= 1 + (Math.random() - 0.48) * 0.012
    peak = Math.max(peak, equity)

    if (i % 3 === 0) {
      points.push({
        date: date.toISOString().split('T')[0],
        equity: Math.round(equity * 100) / 100,
        drawdown: Math.round(((peak - equity) / peak) * 10000) / 100,
        buyHold: Math.round(buyHold * 100) / 100,
      })
    }
  }

  return points
}

function generateDailyHeatmap(): DashboardData['dailyHeatmap'] {
  const cells: DashboardData['dailyHeatmap'] = []
  const startDate = new Date('2025-01-01')

  for (let i = 0; i < 90; i++) {
    const date = new Date(startDate)
    date.setDate(date.getDate() + i)
    const week = Math.floor(i / 7)
    const day = i % 7

    cells.push({
      date: date.toISOString().split('T')[0],
      day,
      week,
      profit: Math.round((Math.random() - 0.35) * 800 * 100) / 100,
    })
  }

  return cells
}

export const dashboardData: DashboardData = {
  activeStrategy: {
    name: 'Momentum Breakout v3.2',
    version: 'v3.2.1',
    status: 'active',
  },

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
    { month: 'Aug', profit: 2840, trades: 28 },
    { month: 'Sep', profit: 1920, trades: 31 },
    { month: 'Oct', profit: -680, trades: 26 },
    { month: 'Nov', profit: 4120, trades: 34 },
    { month: 'Dec', profit: 3560, trades: 29 },
    { month: 'Jan', profit: 5280, trades: 38 },
    { month: 'Feb', profit: 2940, trades: 32 },
    { month: 'Mar', profit: 6180, trades: 41 },
    { month: 'Apr', profit: 1890, trades: 27 },
    { month: 'May', profit: 4320, trades: 35 },
    { month: 'Jun', profit: 3760, trades: 33 },
    { month: 'Jul', profit: 2820, trades: 18 },
  ],

  dailyHeatmap: generateDailyHeatmap(),

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
    name: 'Momentum Breakout',
    version: 'v3.2.1',
    filtersEnabled: ['EMA200', 'London Session', 'HTF Bias', 'FVG Confirmation'],
    score: 87,
    winRate: 62.4,
    profitFactor: 1.87,
    drawdown: 8.3,
    tradeCount: 342,
    expectedValue: 72.37,
    sharpeRatio: 1.94,
    recoveryFactor: 2.98,
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
    reasoning:
      'Analysis of 342 trades across 12 months indicates session filtering and trend alignment significantly improve edge. London session entries show 18% higher win rate. HTF bias reduces false breakouts by 24%. Avoid martingale and Friday session due to elevated drawdown risk.',
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

  recentBacktests: [
    { id: 'bt-001', version: 'v3.2.1', date: '2025-07-08', market: 'XAUUSD', timeframe: 'H1', trades: 342, winRate: 62.4, profitFactor: 1.87, maxDrawdown: -8.3, netProfit: 24750, status: 'completed' },
    { id: 'bt-002', version: 'v3.2.0', date: '2025-07-05', market: 'XAUUSD', timeframe: 'H1', trades: 338, winRate: 60.1, profitFactor: 1.72, maxDrawdown: -9.1, netProfit: 22180, status: 'completed' },
    { id: 'bt-003', version: 'v3.1.4', date: '2025-07-01', market: 'EURUSD', timeframe: 'H4', trades: 186, winRate: 58.6, profitFactor: 1.54, maxDrawdown: -11.2, netProfit: 12450, status: 'completed' },
    { id: 'bt-004', version: 'v3.1.3', date: '2025-06-28', market: 'GBPUSD', timeframe: 'H1', trades: 224, winRate: 55.8, profitFactor: 1.41, maxDrawdown: -12.8, netProfit: 9820, status: 'completed' },
    { id: 'bt-005', version: 'v3.1.2', date: '2025-06-25', market: 'XAUUSD', timeframe: 'M15', trades: 512, winRate: 52.3, profitFactor: 1.28, maxDrawdown: -15.4, netProfit: 8640, status: 'completed' },
    { id: 'bt-006', version: 'v3.1.1', date: '2025-06-22', market: 'USDJPY', timeframe: 'H1', trades: 198, winRate: 57.1, profitFactor: 1.48, maxDrawdown: -10.6, netProfit: 11200, status: 'completed' },
    { id: 'bt-007', version: 'v3.1.0', date: '2025-06-18', market: 'BTCUSD', timeframe: 'H4', trades: 156, winRate: 54.5, profitFactor: 1.35, maxDrawdown: -18.2, netProfit: 7280, status: 'completed' },
    { id: 'bt-008', version: 'v3.0.9', date: '2025-06-15', market: 'XAUUSD', timeframe: 'H1', trades: 310, winRate: 56.8, profitFactor: 1.52, maxDrawdown: -13.1, netProfit: 15680, status: 'completed' },
    { id: 'bt-009', version: 'v3.0.8', date: '2025-06-12', market: 'ETHUSD', timeframe: 'H1', trades: 142, winRate: 51.4, profitFactor: 1.22, maxDrawdown: -16.8, netProfit: 5420, status: 'failed' },
    { id: 'bt-010', version: 'v3.0.7', date: '2025-06-10', market: 'XAUUSD', timeframe: 'D1', trades: 86, winRate: 61.6, profitFactor: 1.78, maxDrawdown: -7.2, netProfit: 18920, status: 'completed' },
    { id: 'bt-011', version: 'v3.0.6', date: '2025-06-08', market: 'EURUSD', timeframe: 'H1', trades: 268, winRate: 53.7, profitFactor: 1.31, maxDrawdown: -14.5, netProfit: 8940, status: 'completed' },
    { id: 'bt-012', version: 'v3.0.5', date: '2025-06-05', market: 'XAUUSD', timeframe: 'H1', trades: 295, winRate: 55.2, profitFactor: 1.44, maxDrawdown: -12.4, netProfit: 13850, status: 'running' },
  ],

  marketContext: {
    newsSentiment: 62,
    fearGreed: 58,
    volatility: 24.6,
    upcomingEvents: [
      { id: 'ev-1', time: '14:30', event: 'US CPI m/m', impact: 'high', currency: 'USD' },
      { id: 'ev-2', time: '15:00', event: 'FOMC Minutes', impact: 'high', currency: 'USD' },
      { id: 'ev-3', time: '09:30', event: 'UK GDP q/q', impact: 'medium', currency: 'GBP' },
      { id: 'ev-4', time: '12:45', event: 'ECB Rate Decision', impact: 'high', currency: 'EUR' },
      { id: 'ev-5', time: '23:50', event: 'Japan CPI y/y', impact: 'medium', currency: 'JPY' },
    ],
    liquidityStatus: 'high',
    marketSession: 'London / New York Overlap',
    currentSpread: 0.18,
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

export const userProfile = {
  name: 'Alex Chen',
  email: 'alex@quantlab.io',
  avatar: 'AC',
  subscription: 'pro' as const,
  connectionStatus: 'connected' as const,
}

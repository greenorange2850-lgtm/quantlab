export const APP_NAME = 'QUANTLAB'
export const APP_VERSION = '0.2.0-alpha.1'
export const API_BASE_PATH = '/api/v1'

export const ENGINE_NAMES = {
  RESEARCH: 'research',
  BACKTEST: 'backtest',
  STRATEGY: 'strategy',
  AI: 'ai',
  KNOWLEDGE: 'knowledge',
  OPTIMIZATION: 'optimization',
} as const

export const PATTERN_LABELS: Record<string, string> = {
  crt: 'Candle Range Theory',
  liquidity_sweep: 'Liquidity Sweep',
  fvg: 'Fair Value Gap',
  mss: 'Market Structure Shift',
  bos: 'Break of Structure',
  order_block: 'Order Block',
  equal_highs: 'Equal Highs',
  equal_lows: 'Equal Lows',
}

export const SESSION_LABELS: Record<string, string> = {
  asian: 'Asian',
  london: 'London',
  new_york: 'New York',
  overlap: 'Overlap',
  off_hours: 'Off Hours',
}

export const DEFAULT_PAGINATION = {
  page: 1,
  pageSize: 20,
} as const

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', path: '/' },
  { id: 'strategy-lab', label: 'Strategy Lab', icon: 'Layers', path: '/strategy-lab' },
  { id: 'backtest-lab', label: 'Backtest Lab', icon: 'FlaskConical', path: '/backtest-lab' },
  { id: 'dataset-library', label: 'Dataset Library', icon: 'Database', path: '/dataset-library' },
  { id: 'market-explorer', label: 'Market Explorer', icon: 'Globe', path: '/market-explorer' },
  { id: 'trade-replay', label: 'Backtest Replay', icon: 'Play', path: '/backtest-replay' },
  { id: 'research-analysis', label: 'Research Analysis', icon: 'Brain', path: '/research-analysis' },
  { id: 'strategy-compare', label: 'Strategy Compare', icon: 'ArrowLeftRight', path: '/strategy-compare' },
  { id: 'research-sessions', label: 'Research Sessions', icon: 'History', path: '/research-sessions' },
  { id: 'optimizer', label: 'Optimizer', icon: 'SlidersHorizontal', path: '/optimizer' },
  { id: 'reports', label: 'Reports', icon: 'FileText', path: '/reports', planned: true },
  { id: 'settings', label: 'Settings', icon: 'Settings', path: '/settings', planned: true },
] as const

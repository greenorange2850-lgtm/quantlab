// ─── Enums & Primitives ───────────────────────────────────────────────────────

export type StrategyStatus = 'active' | 'paused' | 'optimizing' | 'draft' | 'archived'
export type BacktestStatus = 'completed' | 'running' | 'failed' | 'queued' | 'cancelled'
export type TrendDirection = 'bullish' | 'bearish' | 'neutral' | 'ranging'
export type SignalType = 'buy' | 'sell' | 'hold' | 'none'
export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting'
export type SubscriptionTier = 'starter' | 'pro' | 'enterprise'
export type TradeDirection = 'long' | 'short'
export type TradeResult = 'win' | 'loss' | 'breakeven'
export type SessionType = 'asian' | 'london' | 'new_york' | 'overlap' | 'off_hours'
export type ImpactLevel = 'high' | 'medium' | 'low'
export type LiquidityStatus = 'high' | 'medium' | 'low'
export type ImportSource = 'csv' | 'sqlite' | 'metatrader' | 'dukascopy' | 'api'
export type PatternType =
  | 'crt'
  | 'liquidity_sweep'
  | 'fvg'
  | 'mss'
  | 'bos'
  | 'order_block'
  | 'equal_highs'
  | 'equal_lows'
export type EngineStatus = 'idle' | 'running' | 'completed' | 'failed'
export type AiSuggestionType = 'add' | 'avoid' | 'modify' | 'remove'
export type KnowledgeCategory =
  | 'successful_condition'
  | 'failed_condition'
  | 'best_session'
  | 'worst_session'
  | 'best_filter'
  | 'worst_filter'
  | 'best_timeframe'
  | 'best_rr'
  | 'best_volatility'
  | 'best_htf'

// ─── Market Data ────────────────────────────────────────────────────────────

export interface Symbol {
  id: string
  name: string
  displayName: string
  assetClass: 'forex' | 'crypto' | 'indices' | 'commodities'
  pipSize: number
  tickSize: number
  createdAt: string
}

export interface Timeframe {
  id: string
  code: string
  minutes: number
  label: string
}

export interface Session {
  id: string
  name: string
  type: SessionType
  startUtc: string
  endUtc: string
  timezone: string
}

export interface Candle {
  id: string
  symbolId: string
  timeframeId: string
  timestamp: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface ParsedCandle {
  timestamp: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface CandleStats {
  count: number
  startDate: string | null
  endDate: string | null
}

export interface PatternEvent {
  id: string
  symbolId: string
  timeframeId: string
  patternType: PatternType
  timestamp: string
  price: number
  direction: TrendDirection
  confidence: number
  metadata: Record<string, unknown>
}

export interface CrtEvent extends PatternEvent {
  patternType: 'crt'
  metadata: { rangeHigh: number; rangeLow: number; closePosition: number }
}

export interface FvgEvent extends PatternEvent {
  patternType: 'fvg'
  metadata: { gapHigh: number; gapLow: number; filled: boolean }
}

export interface LiquidityEvent extends PatternEvent {
  patternType: 'liquidity_sweep'
  metadata: { sweptLevel: number; reclaimed: boolean }
}

export interface MssEvent extends PatternEvent {
  patternType: 'mss'
  metadata: { previousStructure: TrendDirection; newStructure: TrendDirection }
}

// ─── Strategy & Versioning ────────────────────────────────────────────────────

export interface Strategy {
  id: string
  name: string
  description: string
  status: StrategyStatus
  currentVersionId: string | null
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface StrategyVersion {
  id: string
  strategyId: string
  version: string
  versionNumber: number
  rules: StrategyRules
  filters: StrategyFilters
  metrics: StrategyMetrics | null
  aiNotes: string | null
  parentVersionId: string | null
  changelog: string
  createdAt: string
}

export interface StrategyRules {
  entryConditions: RuleCondition[]
  exitConditions: RuleCondition[]
  riskManagement: RiskManagement
  positionSizing: PositionSizing
}

export interface RuleCondition {
  id: string
  type: string
  operator: 'and' | 'or'
  parameters: Record<string, unknown>
  description: string
}

export interface StrategyFilters {
  sessions: SessionType[]
  timeframes: string[]
  htfBias: boolean
  htfTimeframe: string | null
  volatilityMin: number | null
  volatilityMax: number | null
  dayOfWeek: number[]
  enabledPatterns: PatternType[]
}

export interface RiskManagement {
  maxRiskPerTrade: number
  maxDailyLoss: number
  maxDrawdown: number
  trailingStop: boolean
  breakEvenAt: number | null
}

export interface PositionSizing {
  method: 'fixed' | 'percent' | 'kelly' | 'atr'
  value: number
}

export interface StrategyMetrics {
  winRate: number
  profitFactor: number
  maxDrawdown: number
  netProfit: number
  totalTrades: number
  averageRR: number
  expectedValue: number
  sharpeRatio: number
  recoveryFactor: number
  maxWinStreak: number
  maxLossStreak: number
}

// ─── Backtest ─────────────────────────────────────────────────────────────────

export interface Backtest {
  id: string
  strategyVersionId: string
  symbolId: string
  timeframeId: string
  status: BacktestStatus
  startDate: string
  endDate: string
  initialCapital: number
  metrics: StrategyMetrics
  equityCurve: EquityPoint[]
  createdAt: string
  completedAt: string | null
}

export interface Trade {
  id: string
  backtestId: string
  symbolId: string
  direction: TradeDirection
  result: TradeResult
  entryTime: string
  exitTime: string
  entryPrice: number
  exitPrice: number
  stopLoss: number
  takeProfit: number
  riskReward: number
  pnl: number
  pnlPercent: number
  session: SessionType
  timeframe: string
  patterns: PatternType[]
  metadata: Record<string, unknown>
}

export interface EquityPoint {
  date: string
  equity: number
  drawdown: number
  buyHold?: number
}

// ─── Optimization ─────────────────────────────────────────────────────────────

export interface OptimizationRun {
  id: string
  strategyVersionId: string
  status: EngineStatus
  parameters: OptimizationParameter[]
  results: OptimizationResult[]
  bestResultId: string | null
  createdAt: string
  completedAt: string | null
}

export interface OptimizationParameter {
  name: string
  min: number
  max: number
  step: number
  current: number
}

export interface OptimizationResult {
  id: string
  parameters: Record<string, number>
  metrics: StrategyMetrics
  score: number
}

// ─── AI Analysis ──────────────────────────────────────────────────────────────

export interface AiAnalysis {
  id: string
  strategyVersionId: string
  backtestId: string | null
  confidence: number
  reasoning: string
  suggestions: AiSuggestion[]
  weaknesses: AiWeakness[]
  proposedVersionId: string | null
  createdAt: string
}

export interface AiSuggestion {
  id: string
  type: AiSuggestionType
  text: string
  impact: 'high' | 'medium' | 'low'
  measurable: boolean
  expectedImprovement: string | null
}

export interface AiWeakness {
  id: string
  category: string
  description: string
  severity: 'critical' | 'moderate' | 'minor'
  affectedMetric: string
  evidence: string
}

// ─── Knowledge Base ───────────────────────────────────────────────────────────

export interface KnowledgeEntry {
  id: string
  category: KnowledgeCategory
  strategyId: string | null
  backtestId: string | null
  condition: string
  value: string
  confidence: number
  sampleSize: number
  createdAt: string
}

// ─── Reports & Settings ───────────────────────────────────────────────────────

export interface Report {
  id: string
  type: 'backtest' | 'comparison' | 'optimization' | 'ai_analysis'
  title: string
  strategyVersionId: string | null
  backtestId: string | null
  content: Record<string, unknown>
  createdAt: string
}

export interface AppSettings {
  id: string
  key: string
  value: unknown
  updatedAt: string
}

// ─── Dashboard (Presentation) ───────────────────────────────────────────────────

export interface KpiMetric {
  id: string
  label: string
  value: string | number
  change?: number
  format?: 'currency' | 'percent' | 'number' | 'text'
  trend?: 'up' | 'down' | 'neutral'
}

export interface DashboardData {
  activeStrategy: { name: string; version: string; status: StrategyStatus }
  kpis: KpiMetric[]
  equityCurve: EquityPoint[]
  monthlyProfit: MonthlyProfit[]
  dailyHeatmap: DailyHeatmapCell[]
  weeklySummary: WeeklySummary[]
  winLossDistribution: DistributionItem[]
  longShortDistribution: DistributionItem[]
  sessionDistribution: DistributionItem[]
  timeframeDistribution: DistributionItem[]
  riskDistribution: DistributionItem[]
  bestStrategy: BestStrategySummary
  /** Null until a real AI research session produces recommendations. */
  aiRecommendation: AiRecommendationSummary | null
  strategyHealth: HealthMetric[]
  overallHealthScore: number
  recentBacktests: BacktestSummary[]
  tradeHistory: DashboardTradeRow[]
  /** Null until live market intelligence is connected. */
  marketContext: MarketContext | null
  watchlist: WatchlistItem[]
  portfolio: PortfolioSnapshot
  hasBacktest: boolean
}

export interface PortfolioSnapshot {
  cash: number
  equity: number
  buyingPower: number
  realizedPnL: number
  unrealizedPnL: number
  totalExposure: number
  positions: PortfolioPositionSnapshot[]
}

export interface PortfolioPositionSnapshot {
  symbol: string
  quantity: number
  marketValue: number
  costBasis: number
  unrealizedPnL: number
  realizedPnL: number
  weight: number
}

export interface DashboardTradeRow {
  id: string
  symbol: string
  side: TradeDirection
  entryPrice: number
  exitPrice: number
  quantity: number
  pnl: number
  returnPercent: number
  durationMs: number
}

export interface MonthlyProfit {
  month: string
  profit: number
  trades: number
}

export interface DailyHeatmapCell {
  date: string
  day: number
  week: number
  profit: number
}

export interface WeeklySummary {
  week: string
  profit: number
  trades: number
  winRate: number
}

export interface DistributionItem {
  name: string
  value: number
  color: string
}

export interface BestStrategySummary {
  name: string
  version: string
  filtersEnabled: string[]
  score: number
  winRate: number
  profitFactor: number
  drawdown: number
  tradeCount: number
  expectedValue: number
  sharpeRatio: number
  recoveryFactor: number
}

export interface AiRecommendationSummary {
  suggestions: Array<{ id: string; text: string; type: 'add' | 'avoid' }>
  confidence: number
  reasoning: string
}

export interface HealthMetric {
  id: string
  label: string
  score: number
}

export interface BacktestSummary {
  id: string
  version: string
  date: string
  market: string
  timeframe: string
  trades: number
  winRate: number
  profitFactor: number
  maxDrawdown: number
  netProfit: number
  status: BacktestStatus
}

export interface MarketContext {
  newsSentiment: number
  fearGreed: number
  volatility: number
  upcomingEvents: EconomicEvent[]
  liquidityStatus: LiquidityStatus
  marketSession: string
  currentSpread: number
}

export interface EconomicEvent {
  id: string
  time: string
  event: string
  impact: ImpactLevel
  currency: string
}

export interface WatchlistItem {
  symbol: string
  price: number
  dailyChange: number
  trend: TrendDirection
  signal: SignalType
}

export interface NavItem {
  id: string
  label: string
  icon: string
  path: string
  badge?: string
}

export interface UserProfile {
  name: string
  email: string
  avatar: string
  subscription: SubscriptionTier
  connectionStatus: ConnectionStatus
}

// ─── Research Engine Types ────────────────────────────────────────────────────

export interface ResearchContext {
  symbolId: string
  timeframeId: string
  htfTimeframeId: string | null
  startDate: string
  endDate: string
}

export interface ResearchResult {
  patterns: PatternEvent[]
  trend: TrendDirection
  htfTrend: TrendDirection | null
  sessionContext: SessionType
  summary: string
}

export interface MultiTimeframeContext {
  timeframe: string
  trend: TrendDirection
  keyLevels: number[]
  patterns: PatternType[]
}

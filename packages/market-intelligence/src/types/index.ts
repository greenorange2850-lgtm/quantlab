import type { MarketEvent } from '@trading-os/rule-engine'
import type { SessionType } from '@trading-os/market-data'

export type TimeframeCode = 'MN' | 'W1' | 'D1' | 'H4' | 'H1' | 'M30' | 'M15' | 'M5' | 'M1'

export const TIMEFRAME_HIERARCHY: TimeframeCode[] = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN']

export type TrendDirection = 'bullish' | 'bearish' | 'sideways'
export type TrendPhase = 'accelerating' | 'weakening' | 'stable'
export type MtfAlignment = 'aligned' | 'conflicted' | 'neutral'
export type OpportunityLevel = 'very_low' | 'low' | 'medium' | 'high' | 'excellent'
export type RiskLevel = 'safe' | 'medium' | 'high' | 'extreme'
export type VolatilityState = 'expansion' | 'compression' | 'normal' | 'spike'

export interface IntelligenceCandle {
  timestamp: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  spread?: number
  session?: SessionType | null
}

export interface AnalysisContext {
  event: MarketEvent
  symbol: string
  timeframe: string
  candles: IntelligenceCandle[]
  candleIndex: number
  htfCandles: Record<string, IntelligenceCandle[]>
  relatedEvents: MarketEvent[]
}

export interface AnalyzerContribution {
  analyzer: string
  score: number
  weight: number
  tags: string[]
  metadata: Record<string, unknown>
}

export interface TrendAnalysis {
  direction: TrendDirection
  strength: number
  phase: TrendPhase
  emaSlope: number
}

export interface VolatilityAnalysis {
  atr: number
  atrRatio: number
  dailyRange: number
  state: VolatilityState
  spikeDetected: boolean
}

export interface LiquidityAnalysis {
  areas: Array<{ level: number; type: 'high' | 'low'; strength: number }>
  sweepProbability: number
  equalHighs: number
  equalLows: number
  restingLiquidity: 'above' | 'below' | 'balanced'
}

export interface SessionAnalysis {
  session: SessionType
  strength: number
  volatility: number
  isOpen: boolean
}

export interface SpreadAnalysis {
  current: number
  average: number
  ratio: number
  isHigh: boolean
}

export interface MomentumAnalysis {
  rsi: number
  direction: TrendDirection
  strength: number
}

export interface RangeAnalysis {
  position: number
  rangeHigh: number
  rangeLow: number
  inPremium: boolean
  inDiscount: boolean
}

export interface StructureAnalysis {
  structure: 'bullish' | 'bearish' | 'ranging'
  lastBos: 'bullish' | 'bearish' | 'none'
  lastChoch: 'bullish' | 'bearish' | 'none'
}

export interface MtfAnalysis {
  alignment: MtfAlignment
  trends: Record<string, TrendDirection>
  conflictingTimeframes: string[]
}

export interface RiskAnalysis {
  level: RiskLevel
  score: number
  factors: string[]
}

export interface MarketConditionSnapshot {
  trend: TrendAnalysis
  volatility: VolatilityAnalysis
  liquidity: LiquidityAnalysis
  session: SessionAnalysis
  spread: SpreadAnalysis
  momentum: MomentumAnalysis
  range: RangeAnalysis
  structure: StructureAnalysis
  mtf: MtfAnalysis
  risk: RiskAnalysis
}

export interface IntelligenceScores {
  qualityScore: number
  confidence: number
  riskScore: number
  opportunityScore: number
  opportunityLevel: OpportunityLevel
  riskLevel: RiskLevel
}

export interface Recommendation {
  type: 'favorable' | 'caution' | 'avoid' | 'neutral'
  message: string
  priority: number
}

export interface StructuredExplanation {
  verdict: 'high_quality' | 'medium_quality' | 'low_quality' | 'poor_quality'
  summary: string
  reasons: string[]
  warnings: string[]
}

export interface EnhancedMarketEvent {
  event: MarketEvent
  scores: IntelligenceScores
  conditions: MarketConditionSnapshot
  contextTags: string[]
  recommendations: Recommendation[]
  explanation: StructuredExplanation
  contributions: AnalyzerContribution[]
  analyzedAt: string
  analysisId: string
}

export interface AnalyzeOptions {
  symbol: string
  timeframe: string
  eventIds?: string[]
  scanId?: string
  startDate?: string
  endDate?: string
  debug?: boolean
  batchSize?: number
}

export interface AnalyzeResult {
  analysisId: string
  symbol: string
  timeframe: string
  eventsAnalyzed: number
  enhancedEvents: EnhancedMarketEvent[]
  durationMs: number
  debug?: IntelligenceDebugReport
}

export interface IntelligenceDebugReport {
  engines: EngineDebugEntry[]
  totalEvents: number
  totalExecutionMs: number
}

export interface EngineDebugEntry {
  engine: string
  executionMs: number
  avgScore: number
  tagsGenerated: number
}

export interface IAnalyzer {
  readonly name: string
  readonly weight: number
  analyze(context: AnalysisContext): AnalyzerContribution
}

export interface ICandleSource {
  getCandles(params: {
    symbol: string
    timeframe: string
    start?: string
    end?: string
    limit?: number
  }): IntelligenceCandle[]
}

export interface IIntelligenceRepository {
  saveAnalysis(events: EnhancedMarketEvent[], runId: string): number
  getEnhancedEvent(eventId: string): EnhancedMarketEvent | null
  getEnhancedEvents(params: {
    symbol: string
    timeframe: string
    start?: string
    end?: string
    limit?: number
  }): EnhancedMarketEvent[]
  createRun(run: {
    id: string
    symbol: string
    timeframe: string
    eventsAnalyzed: number
    durationMs: number
    debugMode: boolean
  }): void
  getRuns(symbol?: string, timeframe?: string, limit?: number): unknown[]
}

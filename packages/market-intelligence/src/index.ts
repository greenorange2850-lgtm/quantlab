export type {
  TimeframeCode,
  TrendDirection,
  TrendPhase,
  MtfAlignment,
  OpportunityLevel,
  RiskLevel,
  VolatilityState,
  IntelligenceCandle,
  AnalysisContext,
  AnalyzerContribution,
  TrendAnalysis,
  VolatilityAnalysis,
  LiquidityAnalysis,
  SessionAnalysis,
  SpreadAnalysis,
  MomentumAnalysis,
  RangeAnalysis,
  StructureAnalysis,
  MtfAnalysis,
  RiskAnalysis,
  MarketConditionSnapshot,
  IntelligenceScores,
  Recommendation,
  StructuredExplanation,
  EnhancedMarketEvent,
  AnalyzeOptions,
  AnalyzeResult,
  IntelligenceDebugReport,
  EngineDebugEntry,
  IAnalyzer,
  ICandleSource,
  IIntelligenceRepository,
} from './types/index.js'

export { TIMEFRAME_HIERARCHY } from './types/index.js'
export { createAnalyzers } from './analyzers/index.js'
export { IntelligenceEngine, type EventSource } from './engine/intelligence-engine.js'
export { IntelligenceDebugReporter } from './engine/debug-reporter.js'
export { buildScores } from './scoring/score.engine.js'
export { AnalyzeService } from './services/analyze.service.js'
export { RepositoryCandleSource, type MarketDataSource } from './providers/candle-source.js'

import { AnalyzeService } from './services/analyze.service.js'
import { RepositoryCandleSource } from './providers/candle-source.js'
import { IntelligenceEngine } from './engine/intelligence-engine.js'
import type { ICandleSource, IIntelligenceRepository } from './types/index.js'
import type { MarketDataSource } from './providers/candle-source.js'
import type { EventSource } from './engine/intelligence-engine.js'

export interface MarketIntelligenceFactory {
  analyze: AnalyzeService
  engine: IntelligenceEngine
}

export function createMarketIntelligence(
  candleSource: MarketDataSource,
  eventSource: EventSource,
  repository: IIntelligenceRepository,
): MarketIntelligenceFactory {
  const candles: ICandleSource = new RepositoryCandleSource(candleSource)
  const engine = new IntelligenceEngine(candles, eventSource)
  return {
    analyze: new AnalyzeService(candles, eventSource, repository),
    engine,
  }
}

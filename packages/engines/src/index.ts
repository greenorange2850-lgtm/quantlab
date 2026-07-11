import { ResearchEngine } from './research/research-engine.js'
import { BacktestEngine } from './backtest/backtest-engine.js'
import { StrategyEngine } from './strategy/strategy-engine.js'
import { AiAnalysisEngine } from './ai/ai-engine.js'
import { KnowledgeEngine } from './knowledge/knowledge-engine.js'
import { OptimizationEngine } from './optimization/optimization-engine.js'

export { BaseEngine } from './core/base-engine.js'
export type { EngineResult, EngineHealth } from './core/base-engine.js'

export { ResearchEngine } from './research/research-engine.js'
export type { IResearchEngine, PatternDetector } from './research/research-engine.js'

export { BacktestEngine } from './backtest/backtest-engine.js'
export type { IBacktestEngine, ComparisonResult } from './backtest/backtest-engine.js'

export { StrategyEngine } from './strategy/strategy-engine.js'
export type { IStrategyEngine, VersionDiff } from './strategy/strategy-engine.js'

export { AiAnalysisEngine } from './ai/ai-engine.js'
export type { IAiAnalysisEngine } from './ai/ai-engine.js'

export { KnowledgeEngine } from './knowledge/knowledge-engine.js'
export type { IKnowledgeEngine } from './knowledge/knowledge-engine.js'

export { OptimizationEngine } from './optimization/optimization-engine.js'
export type { IOptimizationEngine } from './optimization/optimization-engine.js'

export interface EngineRegistry {
  research: ResearchEngine
  backtest: BacktestEngine
  strategy: StrategyEngine
  ai: AiAnalysisEngine
  knowledge: KnowledgeEngine
  optimization: OptimizationEngine
}

export function createEngines(): EngineRegistry {
  return {
    research: new ResearchEngine(),
    backtest: new BacktestEngine(),
    strategy: new StrategyEngine(),
    ai: new AiAnalysisEngine(),
    knowledge: new KnowledgeEngine(),
    optimization: new OptimizationEngine(),
  }
}

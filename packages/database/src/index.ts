import { getDatabase } from './connection.js'
import { StrategyRepository } from './repositories/strategy.repository.js'
import { BacktestRepository } from './repositories/backtest.repository.js'
import { MarketDataRepository } from './repositories/market-data.repository.js'
import { MarketDataEngineRepository } from './repositories/market-data-engine.repository.js'
import { KnowledgeRepository } from './repositories/knowledge.repository.js'
import { RuleEngineRepository } from './repositories/rule-engine.repository.js'
import { MarketIntelligenceRepository } from './repositories/market-intelligence.repository.js'

export { getDatabase, closeDatabase, getDatabasePath } from './connection.js'
export { migrate } from './migrate.js'
export { seed } from './seed.js'
export { BaseRepository } from './repositories/base.js'
export { StrategyRepository } from './repositories/strategy.repository.js'
export { BacktestRepository } from './repositories/backtest.repository.js'
export type { CandleQuery } from './repositories/market-data.repository.js'
export { MarketDataRepository } from './repositories/market-data.repository.js'
export { MarketDataEngineRepository } from './repositories/market-data-engine.repository.js'
export { KnowledgeRepository } from './repositories/knowledge.repository.js'
export { RuleEngineRepository } from './repositories/rule-engine.repository.js'
export { MarketIntelligenceRepository } from './repositories/market-intelligence.repository.js'

export interface Repositories {
  strategies: StrategyRepository
  backtests: BacktestRepository
  marketData: MarketDataRepository
  marketDataEngine: MarketDataEngineRepository
  knowledge: KnowledgeRepository
  ruleEngine: RuleEngineRepository
  marketIntelligence: MarketIntelligenceRepository
}

export function createRepositories(): Repositories {
  const db = getDatabase()
  return {
    strategies: new StrategyRepository(db),
    backtests: new BacktestRepository(db),
    marketData: new MarketDataRepository(db),
    marketDataEngine: new MarketDataEngineRepository(db),
    knowledge: new KnowledgeRepository(db),
    ruleEngine: new RuleEngineRepository(db),
    marketIntelligence: new MarketIntelligenceRepository(db),
  }
}

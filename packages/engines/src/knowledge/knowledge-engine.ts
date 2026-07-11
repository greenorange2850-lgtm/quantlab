import type { Backtest, KnowledgeCategory, KnowledgeEntry, Trade } from '@trading-os/shared'
import { BaseEngine } from '../core/base-engine.js'

export interface IKnowledgeEngine {
  readonly name: string
  learnFromBacktest(backtest: Backtest, trades: Trade[]): Promise<KnowledgeEntry[]>
  query(category?: KnowledgeCategory): Promise<KnowledgeEntry[]>
  getInsights(strategyId: string): Promise<KnowledgeEntry[]>
}

/**
 * Knowledge Engine — learns from every completed backtest.
 * Stores successful/failed conditions, best sessions, filters, timeframes, etc.
 */
export class KnowledgeEngine extends BaseEngine implements IKnowledgeEngine {
  readonly name = 'knowledge'

  async learnFromBacktest(_backtest: Backtest, _trades: Trade[]): Promise<KnowledgeEntry[]> {
    const result = await this.execute(async () => {
      // Stub: will analyze trades and extract patterns of success/failure
      return [] as KnowledgeEntry[]
    })

    if (!result.success || !result.data) throw new Error(result.error ?? 'Knowledge extraction failed')
    return result.data
  }

  async query(_category?: KnowledgeCategory): Promise<KnowledgeEntry[]> {
    return []
  }

  async getInsights(_strategyId: string): Promise<KnowledgeEntry[]> {
    return []
  }
}

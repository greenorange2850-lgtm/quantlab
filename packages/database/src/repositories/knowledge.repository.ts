import type { KnowledgeEntry } from '@trading-os/shared'
import { BaseRepository } from './base.js'

interface KnowledgeRow {
  id: string
  category: string
  strategy_id: string | null
  backtest_id: string | null
  condition: string
  value: string
  confidence: number
  sample_size: number
  created_at: string
}

export class KnowledgeRepository extends BaseRepository {
  findAll(category?: string): KnowledgeEntry[] {
    const rows = category
      ? (this.db.prepare('SELECT * FROM knowledge_base WHERE category = ? ORDER BY confidence DESC').all(category) as KnowledgeRow[])
      : (this.db.prepare('SELECT * FROM knowledge_base ORDER BY created_at DESC').all() as KnowledgeRow[])

    return rows.map((row) => ({
      id: row.id,
      category: row.category as KnowledgeEntry['category'],
      strategyId: row.strategy_id,
      backtestId: row.backtest_id,
      condition: row.condition,
      value: row.value,
      confidence: row.confidence,
      sampleSize: row.sample_size,
      createdAt: row.created_at,
    }))
  }
}

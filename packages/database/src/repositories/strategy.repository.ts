import type { Strategy, StrategyVersion } from '@trading-os/shared'
import { BaseRepository } from './base.js'

interface StrategyRow {
  id: string
  name: string
  description: string
  status: string
  current_version_id: string | null
  tags: string
  created_at: string
  updated_at: string
}

interface VersionRow {
  id: string
  strategy_id: string
  version: string
  version_number: number
  rules: string
  filters: string
  metrics: string | null
  ai_notes: string | null
  parent_version_id: string | null
  changelog: string
  created_at: string
}

export class StrategyRepository extends BaseRepository {
  findAll(): Strategy[] {
    const rows = this.db.prepare('SELECT * FROM strategies ORDER BY updated_at DESC').all() as StrategyRow[]
    return rows.map(this.mapStrategy)
  }

  findById(id: string): Strategy | null {
    const row = this.db.prepare('SELECT * FROM strategies WHERE id = ?').get(id) as StrategyRow | undefined
    return row ? this.mapStrategy(row) : null
  }

  findVersions(strategyId: string): StrategyVersion[] {
    const rows = this.db
      .prepare('SELECT * FROM strategy_versions WHERE strategy_id = ? ORDER BY version_number DESC')
      .all(strategyId) as VersionRow[]
    return rows.map(this.mapVersion)
  }

  findVersionById(id: string): StrategyVersion | null {
    const row = this.db.prepare('SELECT * FROM strategy_versions WHERE id = ?').get(id) as VersionRow | undefined
    return row ? this.mapVersion(row) : null
  }

  private mapStrategy(row: StrategyRow): Strategy {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      status: row.status as Strategy['status'],
      currentVersionId: row.current_version_id,
      tags: this.parseJson<string[]>(row.tags, []),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  private mapVersion(row: VersionRow): StrategyVersion {
    return {
      id: row.id,
      strategyId: row.strategy_id,
      version: row.version,
      versionNumber: row.version_number,
      rules: this.parseJson(row.rules, {} as StrategyVersion['rules']),
      filters: this.parseJson(row.filters, {} as StrategyVersion['filters']),
      metrics: row.metrics ? this.parseJson(row.metrics, null) : null,
      aiNotes: row.ai_notes,
      parentVersionId: row.parent_version_id,
      changelog: row.changelog,
      createdAt: row.created_at,
    }
  }
}

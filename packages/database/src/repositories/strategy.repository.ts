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

  findByName(name: string): Strategy | null {
    const row = this.db
      .prepare('SELECT * FROM strategies WHERE name = ? COLLATE NOCASE')
      .get(name) as StrategyRow | undefined
    return row ? this.mapStrategy(row) : null
  }

  findVersionByStrategyAndLabel(strategyId: string, version: string): StrategyVersion | null {
    const row = this.db
      .prepare(
        'SELECT * FROM strategy_versions WHERE strategy_id = ? AND version = ? COLLATE NOCASE',
      )
      .get(strategyId, version) as VersionRow | undefined
    return row ? this.mapVersion(row) : null
  }

  /**
   * Ensure a strategy + version exist for FK integrity when persisting backtests.
   * Returns the strategy_versions.id.
   */
  ensureVersion(strategyName: string, version: string): string {
    let strategy = this.findByName(strategyName)
    if (!strategy) {
      const strategyId = `str-${strategyName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
      this.db
        .prepare(
          `INSERT INTO strategies (id, name, description, status, tags)
           VALUES (?, ?, ?, 'active', '[]')`,
        )
        .run(strategyId, strategyName, `${strategyName} (auto-created for backtest history)`)
      strategy = this.findById(strategyId)
    }

    if (!strategy) {
      throw new Error(`Failed to resolve strategy "${strategyName}"`)
    }

    const existingVersion = this.findVersionByStrategyAndLabel(strategy.id, version)
    if (existingVersion) return existingVersion.id

    const maxRow = this.db
      .prepare(
        'SELECT COALESCE(MAX(version_number), 0) as max_version FROM strategy_versions WHERE strategy_id = ?',
      )
      .get(strategy.id) as { max_version: number }
    const versionNumber = maxRow.max_version + 1
    const versionId = `sv-${strategy.id.replace(/^str-/, '')}-v${versionNumber}`

    this.db
      .prepare(
        `INSERT INTO strategy_versions
          (id, strategy_id, version, version_number, rules, filters, metrics, changelog)
         VALUES (?, ?, ?, ?, '{}', '{}', NULL, ?)`,
      )
      .run(versionId, strategy.id, version, versionNumber, 'Auto-created for persisted backtest history')

    this.db
      .prepare('UPDATE strategies SET current_version_id = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(versionId, strategy.id)

    return versionId
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

import type { MarketEvent, RuleMetadata, IEventRepository } from '@trading-os/rule-engine'
import type { Database } from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { BaseRepository } from './base.js'

interface EventRow {
  id: string
  rule_id: string
  rule_name: string
  rule_version: string
  symbol: string
  timeframe: string
  timestamp: string
  direction: string
  confidence: number
  score: number
  explanation: string
  metadata: string
  candle_index: number | null
  scan_id: string | null
}

export class RuleEngineRepository extends BaseRepository implements IEventRepository {
  saveEvents(events: MarketEvent[], scanId: string): number {
    const insertEvent = this.db.prepare(`
      INSERT INTO market_events (id, rule_id, rule_name, rule_version, symbol, timeframe, timestamp, direction, confidence, score, explanation, metadata, candle_index, scan_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const insertTag = this.db.prepare(`INSERT INTO event_tags (id, event_id, tag) VALUES (?, ?, ?)`)
    const insertDep = this.db.prepare(`
      INSERT INTO event_dependencies (id, event_id, depends_on_event_id, depends_on_rule, relation)
      VALUES (?, ?, ?, ?, ?)
    `)
    const insertScore = this.db.prepare(`
      INSERT INTO event_scores (id, event_id, metric, value, weight) VALUES (?, ?, ?, ?, ?)
    `)

    const tx = this.db.transaction((batch: MarketEvent[]) => {
      for (const e of batch) {
        insertEvent.run(
          e.id, e.ruleId, e.ruleName, e.ruleVersion, e.symbol, e.timeframe,
          e.timestamp, e.direction, e.confidence, e.score, e.explanation,
          JSON.stringify(e.metadata), e.candleIndex ?? null, scanId,
        )
        for (const tag of e.tags) {
          insertTag.run(randomUUID(), e.id, tag)
        }
        for (const dep of e.dependencies ?? []) {
          insertDep.run(
            randomUUID(), e.id, dep.dependsOnEventId ?? '', dep.dependsOnRule, dep.relation,
          )
        }
        for (const s of e.scores ?? []) {
          insertScore.run(randomUUID(), e.id, s.metric, s.value, s.weight)
        }
      }
    })

    tx(events)
    return events.length
  }

  getEvents(params: {
    symbol: string
    timeframe: string
    ruleName?: string
    start?: string
    end?: string
    limit?: number
  }): MarketEvent[] {
    let sql = `SELECT * FROM market_events WHERE symbol = ? AND timeframe = ?`
    const args: unknown[] = [params.symbol, params.timeframe]

    if (params.ruleName) { sql += ` AND rule_name = ?`; args.push(params.ruleName) }
    if (params.start) { sql += ` AND timestamp >= ?`; args.push(params.start) }
    if (params.end) { sql += ` AND timestamp <= ?`; args.push(params.end) }

    sql += ` ORDER BY timestamp DESC LIMIT ?`
    args.push(params.limit ?? 500)

    const rows = this.db.prepare(sql).all(...args) as EventRow[]
    return rows.map((r) => this.rowToEvent(r))
  }

  getEventById(id: string): MarketEvent | null {
    const row = this.db.prepare(`SELECT * FROM market_events WHERE id = ?`).get(id) as EventRow | undefined
    if (!row) return null
    const event = this.rowToEvent(row)
    event.tags = this.getTags(id)
    event.scores = this.getScores(id)
    event.dependencies = this.getDependencies(id)
    return event
  }

  createScan(scan: {
    id: string
    symbol: string
    timeframe: string
    rules: string[]
    eventsFound: number
    durationMs: number
    debugMode: boolean
  }): void {
    this.db.prepare(`
      INSERT INTO rule_scans (id, symbol, timeframe, rules, events_found, duration_ms, debug_mode)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      scan.id, scan.symbol, scan.timeframe,
      JSON.stringify(scan.rules), scan.eventsFound, scan.durationMs,
      scan.debugMode ? 1 : 0,
    )
  }

  saveRuleDefinition(meta: RuleMetadata): void {
    this.db.prepare(`
      INSERT INTO rule_definitions (id, name, version, description, author, parameters, dependencies, priority)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        version = excluded.version, description = excluded.description,
        parameters = excluded.parameters, dependencies = excluded.dependencies,
        priority = excluded.priority, updated_at = datetime('now')
    `).run(
      meta.id, meta.name, meta.version, meta.description, meta.author,
      JSON.stringify(meta.parameters), JSON.stringify(meta.dependencies), meta.priority,
    )
  }

  getRuleDefinitions(): RuleMetadata[] {
    const rows = this.db.prepare(`SELECT * FROM rule_definitions WHERE enabled = 1 ORDER BY priority DESC`).all() as Array<{
      id: string; name: string; version: string; description: string; author: string
      parameters: string; dependencies: string; priority: number
    }>
    return rows.map((r) => ({
      id: r.id, name: r.name, version: r.version, description: r.description,
      author: r.author, priority: r.priority,
      parameters: JSON.parse(r.parameters),
      dependencies: JSON.parse(r.dependencies),
      outputEvents: [], tags: [],
    }))
  }

  getScans(symbol?: string, timeframe?: string, limit = 20) {
    let sql = `SELECT * FROM rule_scans`
    const args: unknown[] = []
    const clauses: string[] = []
    if (symbol) { clauses.push(`symbol = ?`); args.push(symbol) }
    if (timeframe) { clauses.push(`timeframe = ?`); args.push(timeframe) }
    if (clauses.length) sql += ` WHERE ${clauses.join(' AND ')}`
    sql += ` ORDER BY created_at DESC LIMIT ?`
    args.push(limit)
    return this.db.prepare(sql).all(...args)
  }

  private rowToEvent(row: EventRow): MarketEvent {
    return {
      id: row.id,
      ruleId: row.rule_id,
      ruleName: row.rule_name,
      ruleVersion: row.rule_version,
      symbol: row.symbol,
      timeframe: row.timeframe,
      timestamp: row.timestamp,
      direction: row.direction as MarketEvent['direction'],
      confidence: row.confidence,
      score: row.score,
      explanation: row.explanation,
      tags: [],
      metadata: JSON.parse(row.metadata),
      candleIndex: row.candle_index ?? undefined,
      scanId: row.scan_id ?? undefined,
    }
  }

  private getTags(eventId: string) {
    const rows = this.db.prepare(`SELECT tag FROM event_tags WHERE event_id = ?`).all(eventId) as Array<{ tag: string }>
    return rows.map((r) => r.tag)
  }

  private getScores(eventId: string) {
    const rows = this.db.prepare(`SELECT metric, value, weight FROM event_scores WHERE event_id = ?`).all(eventId) as Array<{ metric: string; value: number; weight: number }>
    return rows.map((r) => ({ metric: r.metric, value: r.value, weight: r.weight }))
  }

  private getDependencies(eventId: string) {
    const rows = this.db.prepare(`SELECT depends_on_event_id, depends_on_rule, relation FROM event_dependencies WHERE event_id = ?`).all(eventId) as Array<{ depends_on_event_id: string; depends_on_rule: string; relation: string }>
    return rows.map((r) => ({
      dependsOnEventId: r.depends_on_event_id || undefined,
      dependsOnRule: r.depends_on_rule,
      relation: r.relation as 'requires' | 'confirms' | 'contradicts',
    }))
  }
}

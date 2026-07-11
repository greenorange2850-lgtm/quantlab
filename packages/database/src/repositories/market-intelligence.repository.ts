import type {
  EnhancedMarketEvent,
  IIntelligenceRepository,
  IntelligenceScores,
  MarketConditionSnapshot,
  StructuredExplanation,
  Recommendation,
  AnalyzerContribution,
} from '@trading-os/market-intelligence'
import type { Database } from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { BaseRepository } from './base.js'

export class MarketIntelligenceRepository extends BaseRepository implements IIntelligenceRepository {
  saveAnalysis(events: EnhancedMarketEvent[], runId: string): number {
    const insertContext = this.db.prepare(`
      INSERT INTO market_context (id, event_id, analysis_id, symbol, timeframe, timestamp, conditions, explanation, recommendations, analyzed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const insertScore = this.db.prepare(`
      INSERT INTO market_scores (id, event_id, analysis_id, quality_score, confidence, risk_score, opportunity_score, opportunity_level, risk_level)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const insertTag = this.db.prepare(`
      INSERT INTO market_tags (id, event_id, analysis_id, tag) VALUES (?, ?, ?, ?)
    `)
    const insertCondition = this.db.prepare(`
      INSERT INTO market_conditions (id, event_id, analysis_id, engine, condition_type, value, score, weight, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const tx = this.db.transaction((batch: EnhancedMarketEvent[]) => {
      for (const e of batch) {
        const contextId = randomUUID()
        insertContext.run(
          contextId, e.event.id, e.analysisId, e.event.symbol, e.event.timeframe,
          e.event.timestamp, JSON.stringify(e.conditions), JSON.stringify(e.explanation),
          JSON.stringify(e.recommendations), e.analyzedAt,
        )
        insertScore.run(
          randomUUID(), e.event.id, e.analysisId,
          e.scores.qualityScore, e.scores.confidence, e.scores.riskScore,
          e.scores.opportunityScore, e.scores.opportunityLevel, e.scores.riskLevel,
        )
        for (const tag of e.contextTags) {
          insertTag.run(randomUUID(), e.event.id, e.analysisId, tag)
        }
        for (const c of e.contributions) {
          insertCondition.run(
            randomUUID(), e.event.id, e.analysisId, c.analyzer, c.analyzer,
            String(c.score), c.score, c.weight, JSON.stringify(c.metadata),
          )
        }
      }
    })

    tx(events)
    return events.length
  }

  getEnhancedEvent(eventId: string): EnhancedMarketEvent | null {
    const ctx = this.db.prepare(`
      SELECT * FROM market_context WHERE event_id = ? ORDER BY analyzed_at DESC LIMIT 1
    `).get(eventId) as ContextRow | undefined
    if (!ctx) return null

    const scoreRow = this.db.prepare(`
      SELECT * FROM market_scores WHERE event_id = ? AND analysis_id = ?
    `).get(eventId, ctx.analysis_id) as ScoreRow | undefined

    const tags = this.db.prepare(`SELECT tag FROM market_tags WHERE event_id = ? AND analysis_id = ?`)
      .all(eventId, ctx.analysis_id) as Array<{ tag: string }>

    const contributions = this.db.prepare(`
      SELECT engine, score, weight, metadata FROM market_conditions WHERE event_id = ? AND analysis_id = ?
    `).all(eventId, ctx.analysis_id) as Array<{ engine: string; score: number; weight: number; metadata: string }>

    const event = this.getBaseEvent(eventId)
    if (!event) return null

    return {
      event,
      scores: scoreRow ? this.rowToScores(scoreRow) : this.defaultScores(),
      conditions: JSON.parse(ctx.conditions) as MarketConditionSnapshot,
      contextTags: tags.map((t) => t.tag),
      recommendations: JSON.parse(ctx.recommendations) as Recommendation[],
      explanation: JSON.parse(ctx.explanation) as StructuredExplanation,
      contributions: contributions.map((c) => ({
        analyzer: c.engine,
        score: c.score,
        weight: c.weight,
        tags: [],
        metadata: JSON.parse(c.metadata),
      })),
      analyzedAt: ctx.analyzed_at,
      analysisId: ctx.analysis_id,
    }
  }

  getEnhancedEvents(params: {
    symbol: string
    timeframe: string
    start?: string
    end?: string
    limit?: number
  }): EnhancedMarketEvent[] {
    let sql = `SELECT DISTINCT event_id FROM market_context WHERE symbol = ? AND timeframe = ?`
    const args: unknown[] = [params.symbol, params.timeframe]
    if (params.start) { sql += ` AND timestamp >= ?`; args.push(params.start) }
    if (params.end) { sql += ` AND timestamp <= ?`; args.push(params.end) }
    sql += ` ORDER BY timestamp DESC LIMIT ?`
    args.push(params.limit ?? 100)

    const rows = this.db.prepare(sql).all(...args) as Array<{ event_id: string }>
    return rows.map((r) => this.getEnhancedEvent(r.event_id)).filter((e): e is EnhancedMarketEvent => e !== null)
  }

  createRun(run: {
    id: string
    symbol: string
    timeframe: string
    eventsAnalyzed: number
    durationMs: number
    debugMode: boolean
  }): void {
    this.db.prepare(`
      INSERT INTO intelligence_runs (id, symbol, timeframe, events_analyzed, duration_ms, debug_mode)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(run.id, run.symbol, run.timeframe, run.eventsAnalyzed, run.durationMs, run.debugMode ? 1 : 0)
  }

  getRuns(symbol?: string, timeframe?: string, limit = 20) {
    let sql = `SELECT * FROM intelligence_runs`
    const args: unknown[] = []
    const clauses: string[] = []
    if (symbol) { clauses.push('symbol = ?'); args.push(symbol) }
    if (timeframe) { clauses.push('timeframe = ?'); args.push(timeframe) }
    if (clauses.length) sql += ` WHERE ${clauses.join(' AND ')}`
    sql += ` ORDER BY created_at DESC LIMIT ?`
    args.push(limit)
    return this.db.prepare(sql).all(...args)
  }

  private getBaseEvent(eventId: string) {
    const row = this.db.prepare(`SELECT * FROM market_events WHERE id = ?`).get(eventId) as EventRow | undefined
    if (!row) return null
    return {
      id: row.id,
      ruleId: row.rule_id,
      ruleName: row.rule_name,
      ruleVersion: row.rule_version,
      symbol: row.symbol,
      timeframe: row.timeframe,
      timestamp: row.timestamp,
      direction: row.direction as 'bullish' | 'bearish' | 'neutral' | 'warning' | 'rejected',
      confidence: row.confidence,
      score: row.score,
      explanation: row.explanation,
      tags: [] as string[],
      metadata: JSON.parse(row.metadata),
      candleIndex: row.candle_index ?? undefined,
      scanId: row.scan_id ?? undefined,
    }
  }

  private rowToScores(row: ScoreRow): IntelligenceScores {
    return {
      qualityScore: row.quality_score,
      confidence: row.confidence,
      riskScore: row.risk_score,
      opportunityScore: row.opportunity_score,
      opportunityLevel: row.opportunity_level as IntelligenceScores['opportunityLevel'],
      riskLevel: row.risk_level as IntelligenceScores['riskLevel'],
    }
  }

  private defaultScores(): IntelligenceScores {
    return {
      qualityScore: 0, confidence: 0, riskScore: 50, opportunityScore: 0,
      opportunityLevel: 'low', riskLevel: 'medium',
    }
  }
}

interface ContextRow {
  analysis_id: string
  conditions: string
  explanation: string
  recommendations: string
  analyzed_at: string
}

interface ScoreRow {
  quality_score: number
  confidence: number
  risk_score: number
  opportunity_score: number
  opportunity_level: string
  risk_level: string
}

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

import type { Database } from 'better-sqlite3'
import { randomUUID } from 'crypto'
import { BaseRepository } from './base.js'
import type {
  IMarketDataRepository,
  InsertCandleInput,
  MarketCandle,
  ImportJob,
  DataQualityReport,
  MarketSession,
  MarketDataSource,
  ImportError,
  QualityReportDetails,
} from '@trading-os/market-data'

const BATCH_SIZE = 5000

interface MarketDataRow {
  id: string
  symbol: string
  timeframe: string
  timestamp: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  spread: number
  source: string
  session: string | null
  created_at: string
}

export class MarketDataEngineRepository extends BaseRepository implements IMarketDataRepository {
  insertCandlesBatch(
    symbol: string,
    timeframe: string,
    source: MarketDataSource,
    candles: InsertCandleInput[],
  ): number {
    const stmt = this.db.prepare(`
      INSERT INTO market_data (id, symbol, timeframe, timestamp, open, high, low, close, volume, spread, source, session)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(symbol, timeframe, timestamp) DO UPDATE SET
        open = excluded.open, high = excluded.high, low = excluded.low,
        close = excluded.close, volume = excluded.volume,
        spread = excluded.spread, source = excluded.source, session = excluded.session
    `)

    let total = 0
    const insertBatch = this.db.transaction((batch: InsertCandleInput[]) => {
      for (const c of batch) {
        stmt.run(
          randomUUID(), symbol, timeframe, c.timestamp,
          c.open, c.high, c.low, c.close, c.volume,
          c.spread ?? 0, source, c.session ?? null,
        )
        total++
      }
    })

    for (let i = 0; i < candles.length; i += BATCH_SIZE) {
      insertBatch(candles.slice(i, i + BATCH_SIZE))
    }

    return total
  }

  getCandles(params: {
    symbol: string
    timeframe: string
    start?: string
    end?: string
    limit?: number
    offset?: number
  }): MarketCandle[] {
    const { symbol, timeframe, start, end, limit = 1000, offset = 0 } = params
    let sql = `SELECT * FROM market_data WHERE symbol = ? AND timeframe = ?`
    const args: unknown[] = [symbol, timeframe]

    if (start) { sql += ' AND timestamp >= ?'; args.push(start) }
    if (end) { sql += ' AND timestamp <= ?'; args.push(end) }
    sql += ' ORDER BY timestamp ASC LIMIT ? OFFSET ?'
    args.push(limit, offset)

    return (this.db.prepare(sql).all(...args) as MarketDataRow[]).map(this.mapRow)
  }

  getLatest(symbol: string, timeframe: string): MarketCandle | null {
    const row = this.db.prepare(`
      SELECT * FROM market_data WHERE symbol = ? AND timeframe = ?
      ORDER BY timestamp DESC LIMIT 1
    `).get(symbol, timeframe) as MarketDataRow | undefined
    return row ? this.mapRow(row) : null
  }

  getRange(symbol: string, timeframe: string) {
    const row = this.db.prepare(`
      SELECT COUNT(*) as count, MIN(timestamp) as start, MAX(timestamp) as end
      FROM market_data WHERE symbol = ? AND timeframe = ?
    `).get(symbol, timeframe) as { count: number; start: string | null; end: string | null }
    return { count: row.count, start: row.start, end: row.end }
  }

  getPrevious(symbol: string, timeframe: string, timestamp: string): MarketCandle | null {
    const row = this.db.prepare(`
      SELECT * FROM market_data WHERE symbol = ? AND timeframe = ? AND timestamp < ?
      ORDER BY timestamp DESC LIMIT 1
    `).get(symbol, timeframe, timestamp) as MarketDataRow | undefined
    return row ? this.mapRow(row) : null
  }

  getNext(symbol: string, timeframe: string, timestamp: string): MarketCandle | null {
    const row = this.db.prepare(`
      SELECT * FROM market_data WHERE symbol = ? AND timeframe = ? AND timestamp > ?
      ORDER BY timestamp ASC LIMIT 1
    `).get(symbol, timeframe, timestamp) as MarketDataRow | undefined
    return row ? this.mapRow(row) : null
  }

  createImportJob(job: Omit<ImportJob, 'errors'> & { errors?: ImportError[] }): ImportJob {
    const id = job.id || randomUUID()
    this.db.prepare(`
      INSERT INTO import_jobs (id, file_name, source, symbol, timeframe, status, rows_imported, rows_rejected, duration_ms, quality_score, errors, started_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, job.fileName, job.source, job.symbol, job.timeframe, job.status,
      job.rowsImported, job.rowsRejected, job.durationMs, job.qualityScore,
      JSON.stringify(job.errors ?? []), job.startedAt, job.completedAt,
    )
    return { ...job, id, errors: job.errors ?? [] }
  }

  updateImportJob(id: string, update: Partial<ImportJob>): void {
    const fields: string[] = []
    const values: unknown[] = []

    if (update.status !== undefined) { fields.push('status = ?'); values.push(update.status) }
    if (update.rowsImported !== undefined) { fields.push('rows_imported = ?'); values.push(update.rowsImported) }
    if (update.rowsRejected !== undefined) { fields.push('rows_rejected = ?'); values.push(update.rowsRejected) }
    if (update.durationMs !== undefined) { fields.push('duration_ms = ?'); values.push(update.durationMs) }
    if (update.qualityScore !== undefined) { fields.push('quality_score = ?'); values.push(update.qualityScore) }
    if (update.errors !== undefined) { fields.push('errors = ?'); values.push(JSON.stringify(update.errors)) }
    if (update.completedAt !== undefined) { fields.push('completed_at = ?'); values.push(update.completedAt) }

    if (fields.length === 0) return
    values.push(id)
    this.db.prepare(`UPDATE import_jobs SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  }

  getImportJob(id: string): ImportJob | null {
    const row = this.db.prepare('SELECT * FROM import_jobs WHERE id = ?').get(id) as Record<string, unknown> | undefined
    return row ? this.mapImportJob(row) : null
  }

  listImportJobs(limit = 50): ImportJob[] {
    const rows = this.db.prepare('SELECT * FROM import_jobs ORDER BY created_at DESC LIMIT ?').all(limit) as Record<string, unknown>[]
    return rows.map((r) => this.mapImportJob(r))
  }

  saveQualityReport(report: Omit<DataQualityReport, 'id' | 'createdAt'>): DataQualityReport {
    const id = randomUUID()
    this.db.prepare(`
      INSERT INTO data_quality (id, symbol, timeframe, quality_score, missing_candles, duplicate_candles, invalid_ohlc, negative_prices, timezone_issues, weekend_gaps, report, import_job_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, report.symbol, report.timeframe, report.qualityScore,
      report.missingCandles, report.duplicateCandles, report.invalidOhlc,
      report.negativePrices, report.timezoneIssues, report.weekendGaps,
      JSON.stringify(report.report), report.importJobId,
    )
    return { ...report, id, createdAt: new Date().toISOString() }
  }

  getLatestQuality(symbol: string, timeframe: string): DataQualityReport | null {
    const row = this.db.prepare(`
      SELECT * FROM data_quality WHERE symbol = ? AND timeframe = ?
      ORDER BY created_at DESC LIMIT 1
    `).get(symbol, timeframe) as Record<string, unknown> | undefined
    return row ? this.mapQuality(row) : null
  }

  getSessions(): MarketSession[] {
    const rows = this.db.prepare('SELECT * FROM market_sessions ORDER BY start_utc').all() as Array<Record<string, string>>
    return rows.map((r) => ({
      id: r.id, name: r.name, type: r.type as MarketSession['type'],
      startUtc: r.start_utc, endUtc: r.end_utc, timezone: r.timezone,
    }))
  }

  getSymbols() {
    return (this.db.prepare('SELECT id, name, display_name, asset_class FROM symbols ORDER BY name').all() as Array<Record<string, string>>)
      .map((r) => ({ id: r.id, name: r.name, displayName: r.display_name, assetClass: r.asset_class }))
  }

  getTimeframes() {
    return (this.db.prepare('SELECT id, code, minutes, label FROM timeframes ORDER BY minutes').all() as Array<Record<string, unknown>>)
      .map((r) => ({ id: r.id as string, code: r.code as string, minutes: r.minutes as number, label: r.label as string }))
  }

  private mapRow(row: MarketDataRow): MarketCandle {
    return {
      id: row.id, symbol: row.symbol, timeframe: row.timeframe,
      timestamp: row.timestamp, open: row.open, high: row.high,
      low: row.low, close: row.close, volume: row.volume,
      spread: row.spread, source: row.source as MarketDataSource,
      session: row.session as MarketCandle['session'], createdAt: row.created_at,
    }
  }

  private mapImportJob(row: Record<string, unknown>): ImportJob {
    return {
      id: row.id as string,
      fileName: row.file_name as string | null,
      source: row.source as ImportJob['source'],
      symbol: row.symbol as string,
      timeframe: row.timeframe as string,
      status: row.status as ImportJob['status'],
      rowsImported: row.rows_imported as number,
      rowsRejected: row.rows_rejected as number,
      durationMs: row.duration_ms as number | null,
      qualityScore: row.quality_score as number | null,
      errors: this.parseJson(row.errors as string, []),
      startedAt: row.started_at as string | null,
      completedAt: row.completed_at as string | null,
      createdAt: row.created_at as string,
    }
  }

  private mapQuality(row: Record<string, unknown>): DataQualityReport {
    return {
      id: row.id as string,
      symbol: row.symbol as string,
      timeframe: row.timeframe as string,
      qualityScore: row.quality_score as number,
      missingCandles: row.missing_candles as number,
      duplicateCandles: row.duplicate_candles as number,
      invalidOhlc: row.invalid_ohlc as number,
      negativePrices: row.negative_prices as number,
      timezoneIssues: row.timezone_issues as number,
      weekendGaps: row.weekend_gaps as number,
      report: this.parseJson<QualityReportDetails>(row.report as string, { totalRows: 0, validRows: 0, rejectedRows: 0, dateRange: { start: null, end: null }, issues: [] }),
      importJobId: row.import_job_id as string | null,
      createdAt: row.created_at as string,
    }
  }
}

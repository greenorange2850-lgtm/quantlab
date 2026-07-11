import type { Candle, CandleStats, ParsedCandle, Symbol as TradingSymbol, Timeframe } from '@trading-os/shared'
import { BaseRepository } from './base.js'
import { randomUUID } from 'crypto'

interface SymbolRow {
  id: string
  name: string
  display_name: string
  asset_class: string
  pip_size: number
  tick_size: number
  created_at: string
}

interface TimeframeRow {
  id: string
  code: string
  minutes: number
  label: string
}

interface CandleRow {
  id: string
  symbol_id: string
  timeframe_id: string
  timestamp: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface CandleQuery {
  symbolId: string
  timeframeId: string
  startDate?: string
  endDate?: string
  limit?: number
  offset?: number
}

export class MarketDataRepository extends BaseRepository {
  findAllSymbols(): TradingSymbol[] {
    const rows = this.db.prepare('SELECT * FROM symbols ORDER BY name').all() as SymbolRow[]
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      displayName: row.display_name,
      assetClass: row.asset_class as TradingSymbol['assetClass'],
      pipSize: row.pip_size,
      tickSize: row.tick_size,
      createdAt: row.created_at,
    }))
  }

  findAllTimeframes(): Timeframe[] {
    const rows = this.db.prepare('SELECT * FROM timeframes ORDER BY minutes').all() as TimeframeRow[]
    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      minutes: row.minutes,
      label: row.label,
    }))
  }

  findCandles(query: CandleQuery): Candle[] {
    const { symbolId, timeframeId, startDate, endDate, limit = 500, offset = 0 } = query

    let sql = `
      SELECT * FROM candles
      WHERE symbol_id = ? AND timeframe_id = ?
    `
    const params: unknown[] = [symbolId, timeframeId]

    if (startDate) {
      sql += ' AND timestamp >= ?'
      params.push(startDate)
    }
    if (endDate) {
      sql += ' AND timestamp <= ?'
      params.push(endDate)
    }

    sql += ' ORDER BY timestamp ASC LIMIT ? OFFSET ?'
    params.push(limit, offset)

    const rows = this.db.prepare(sql).all(...params) as CandleRow[]
    return rows.map(this.mapCandle)
  }

  getCandleStats(symbolId: string, timeframeId: string): CandleStats {
    const count = this.getCandleCount(symbolId, timeframeId)
    if (count === 0) return { count: 0, startDate: null, endDate: null }

    const range = this.db.prepare(`
      SELECT MIN(timestamp) as startDate, MAX(timestamp) as endDate
      FROM candles WHERE symbol_id = ? AND timeframe_id = ?
    `).get(symbolId, timeframeId) as { startDate: string; endDate: string }

    return { count, startDate: range.startDate, endDate: range.endDate }
  }

  getCandleCount(symbolId: string, timeframeId: string): number {
    const row = this.db
      .prepare('SELECT COUNT(*) as count FROM candles WHERE symbol_id = ? AND timeframe_id = ?')
      .get(symbolId, timeframeId) as { count: number }
    return row.count
  }

  insertCandles(symbolId: string, timeframeId: string, candles: ParsedCandle[]): { imported: number; skipped: number } {
    const stmt = this.db.prepare(`
      INSERT INTO candles (id, symbol_id, timeframe_id, timestamp, open, high, low, close, volume)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(symbol_id, timeframe_id, timestamp) DO UPDATE SET
        open = excluded.open,
        high = excluded.high,
        low = excluded.low,
        close = excluded.close,
        volume = excluded.volume
    `)

    const insertMany = this.db.transaction((items: ParsedCandle[]) => {
      let imported = 0
      for (const c of items) {
        stmt.run(randomUUID(), symbolId, timeframeId, c.timestamp, c.open, c.high, c.low, c.close, c.volume)
        imported++
      }
      return imported
    })

    const imported = insertMany(candles)
    return { imported, skipped: 0 }
  }

  private mapCandle(row: CandleRow): Candle {
    return {
      id: row.id,
      symbolId: row.symbol_id,
      timeframeId: row.timeframe_id,
      timestamp: row.timestamp,
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      volume: row.volume,
    }
  }
}

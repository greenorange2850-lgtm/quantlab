import type { Backtest, BacktestSummary, Trade } from '@trading-os/shared'
import { BaseRepository } from './base.js'

interface BacktestRow {
  id: string
  strategy_version_id: string
  symbol_id: string
  timeframe_id: string
  status: string
  start_date: string
  end_date: string
  initial_capital: number
  metrics: string
  equity_curve: string
  created_at: string
  completed_at: string | null
}

type BacktestSummaryRow = BacktestRow & {
  version: string
  symbol_name: string
  timeframe_code: string
}

export class BacktestRepository extends BaseRepository {
  findAll(limit = 50): BacktestSummary[] {
    const rows = this.db.prepare(`
      SELECT b.*, sv.version, s.name as symbol_name, tf.code as timeframe_code
      FROM backtests b
      JOIN strategy_versions sv ON b.strategy_version_id = sv.id
      JOIN symbols s ON b.symbol_id = s.id
      JOIN timeframes tf ON b.timeframe_id = tf.id
      ORDER BY b.created_at DESC
      LIMIT ?
    `).all(limit) as BacktestSummaryRow[]

    return rows.map((row) => this.mapSummary(row))
  }

  findSummaryById(id: string): BacktestSummary | null {
    const row = this.db.prepare(`
      SELECT b.*, sv.version, s.name as symbol_name, tf.code as timeframe_code
      FROM backtests b
      JOIN strategy_versions sv ON b.strategy_version_id = sv.id
      JOIN symbols s ON b.symbol_id = s.id
      JOIN timeframes tf ON b.timeframe_id = tf.id
      WHERE b.id = ?
    `).get(id) as BacktestSummaryRow | undefined

    return row ? this.mapSummary(row) : null
  }

  findById(id: string): Backtest | null {
    const row = this.db.prepare('SELECT * FROM backtests WHERE id = ?').get(id) as BacktestRow | undefined
    return row ? this.mapBacktest(row) : null
  }

  /**
   * Insert or update a completed backtest row (single storage: `backtests` table).
   */
  create(backtest: Backtest): BacktestSummary {
    this.db
      .prepare(
        `INSERT INTO backtests (
          id, strategy_version_id, symbol_id, timeframe_id, status,
          start_date, end_date, initial_capital, metrics, equity_curve,
          created_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          strategy_version_id = excluded.strategy_version_id,
          symbol_id = excluded.symbol_id,
          timeframe_id = excluded.timeframe_id,
          status = excluded.status,
          start_date = excluded.start_date,
          end_date = excluded.end_date,
          initial_capital = excluded.initial_capital,
          metrics = excluded.metrics,
          equity_curve = excluded.equity_curve,
          completed_at = excluded.completed_at`,
      )
      .run(
        backtest.id,
        backtest.strategyVersionId,
        backtest.symbolId,
        backtest.timeframeId,
        backtest.status,
        backtest.startDate,
        backtest.endDate,
        backtest.initialCapital,
        this.stringifyJson(backtest.metrics),
        this.stringifyJson(backtest.equityCurve),
        backtest.createdAt,
        backtest.completedAt,
      )

    const summary = this.findSummaryById(backtest.id)
    if (!summary) {
      throw new Error(`Failed to read persisted backtest summary "${backtest.id}"`)
    }
    return summary
  }

  findTrades(backtestId: string): Trade[] {
    const rows = this.db
      .prepare('SELECT * FROM trades WHERE backtest_id = ? ORDER BY entry_time')
      .all(backtestId) as Array<Record<string, unknown>>

    return rows.map((row) => ({
      id: row.id as string,
      backtestId: row.backtest_id as string,
      symbolId: row.symbol_id as string,
      direction: row.direction as Trade['direction'],
      result: row.result as Trade['result'],
      entryTime: row.entry_time as string,
      exitTime: row.exit_time as string,
      entryPrice: row.entry_price as number,
      exitPrice: row.exit_price as number,
      stopLoss: row.stop_loss as number,
      takeProfit: row.take_profit as number,
      riskReward: row.risk_reward as number,
      pnl: row.pnl as number,
      pnlPercent: row.pnl_percent as number,
      session: row.session as Trade['session'],
      timeframe: row.timeframe as string,
      patterns: this.parseJson(row.patterns as string, []),
      metadata: this.parseJson(row.metadata as string, {}),
    }))
  }

  private mapSummary(row: BacktestSummaryRow): BacktestSummary {
    const metrics = this.parseJson<Backtest['metrics']>(row.metrics, {} as Backtest['metrics'])
    const createdDate = row.created_at.includes('T')
      ? row.created_at.split('T')[0]
      : row.created_at.split(' ')[0]

    return {
      id: row.id,
      version: row.version,
      date: createdDate,
      market: row.symbol_name,
      timeframe: row.timeframe_code,
      trades: metrics.totalTrades ?? 0,
      winRate: metrics.winRate ?? 0,
      profitFactor: metrics.profitFactor ?? 0,
      maxDrawdown: metrics.maxDrawdown ?? 0,
      netProfit: metrics.netProfit ?? 0,
      status: row.status as BacktestSummary['status'],
    }
  }

  private mapBacktest(row: BacktestRow): Backtest {
    return {
      id: row.id,
      strategyVersionId: row.strategy_version_id,
      symbolId: row.symbol_id,
      timeframeId: row.timeframe_id,
      status: row.status as Backtest['status'],
      startDate: row.start_date,
      endDate: row.end_date,
      initialCapital: row.initial_capital,
      metrics: this.parseJson(row.metrics, {} as Backtest['metrics']),
      equityCurve: this.parseJson(row.equity_curve, []),
      createdAt: row.created_at,
      completedAt: row.completed_at,
    }
  }
}

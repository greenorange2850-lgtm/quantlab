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
    `).all(limit) as Array<BacktestRow & { version: string; symbol_name: string; timeframe_code: string }>

    return rows.map((row) => {
      const metrics = this.parseJson<Backtest['metrics']>(row.metrics, {} as Backtest['metrics'])
      return {
        id: row.id,
        version: row.version,
        date: row.created_at.split('T')[0],
        market: row.symbol_name,
        timeframe: row.timeframe_code,
        trades: metrics.totalTrades ?? 0,
        winRate: metrics.winRate ?? 0,
        profitFactor: metrics.profitFactor ?? 0,
        maxDrawdown: metrics.maxDrawdown ?? 0,
        netProfit: metrics.netProfit ?? 0,
        status: row.status as BacktestSummary['status'],
      }
    })
  }

  findById(id: string): Backtest | null {
    const row = this.db.prepare('SELECT * FROM backtests WHERE id = ?').get(id) as BacktestRow | undefined
    return row ? this.mapBacktest(row) : null
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

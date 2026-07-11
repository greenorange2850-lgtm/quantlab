import type {
  Backtest,
  EquityPoint,
  RunBacktestRequest,
  StrategyMetrics,
  StrategyVersion,
  Trade,
} from '@trading-os/shared'
import { BaseEngine } from '../core/base-engine.js'

export interface IBacktestEngine {
  readonly name: string
  run(request: RunBacktestRequest): Promise<Backtest>
  replay(backtestId: string): AsyncGenerator<Trade>
  compare(backtestIds: string[]): Promise<ComparisonResult>
  calculateMetrics(trades: Trade[], initialCapital: number): StrategyMetrics
}

export interface ComparisonResult {
  backtests: Backtest[]
  winner: string
  metrics: Record<string, StrategyMetrics>
  equityCurves: Record<string, EquityPoint[]>
}

/**
 * Backtest Engine — historical strategy testing with full statistics.
 */
export class BacktestEngine extends BaseEngine implements IBacktestEngine {
  readonly name = 'backtest'

  async run(request: RunBacktestRequest): Promise<Backtest> {
    const result = await this.execute(async () => {
      const emptyMetrics: StrategyMetrics = {
        winRate: 0, profitFactor: 0, maxDrawdown: 0, netProfit: 0,
        totalTrades: 0, averageRR: 0, expectedValue: 0, sharpeRatio: 0,
        recoveryFactor: 0, maxWinStreak: 0, maxLossStreak: 0,
      }

      return {
        id: `bt-${Date.now()}`,
        strategyVersionId: request.strategyVersionId,
        symbolId: request.symbolId,
        timeframeId: request.timeframeId,
        status: 'queued' as const,
        startDate: request.startDate,
        endDate: request.endDate,
        initialCapital: request.initialCapital ?? 10000,
        metrics: emptyMetrics,
        equityCurve: [],
        createdAt: new Date().toISOString(),
        completedAt: null,
      } satisfies Backtest
    })

    if (!result.success || !result.data) {
      throw new Error(result.error ?? 'Backtest failed')
    }
    return result.data
  }

  async *replay(_backtestId: string): AsyncGenerator<Trade> {
    // Stub: will stream trades chronologically for replay UI
    return
  }

  async compare(backtestIds: string[]): Promise<ComparisonResult> {
    return {
      backtests: [],
      winner: backtestIds[0] ?? '',
      metrics: {},
      equityCurves: {},
    }
  }

  calculateMetrics(trades: Trade[], initialCapital: number): StrategyMetrics {
    if (trades.length === 0) {
      return {
        winRate: 0, profitFactor: 0, maxDrawdown: 0, netProfit: 0,
        totalTrades: 0, averageRR: 0, expectedValue: 0, sharpeRatio: 0,
        recoveryFactor: 0, maxWinStreak: 0, maxLossStreak: 0,
      }
    }

    const wins = trades.filter((t) => t.result === 'win')
    const losses = trades.filter((t) => t.result === 'loss')
    const grossProfit = wins.reduce((s, t) => s + t.pnl, 0)
    const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0))
    const netProfit = trades.reduce((s, t) => s + t.pnl, 0)

    return {
      winRate: (wins.length / trades.length) * 100,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
      maxDrawdown: 0, // computed from equity curve
      netProfit,
      totalTrades: trades.length,
      averageRR: trades.reduce((s, t) => s + t.riskReward, 0) / trades.length,
      expectedValue: netProfit / trades.length,
      sharpeRatio: 0,
      recoveryFactor: 0,
      maxWinStreak: this.calcStreak(trades, 'win'),
      maxLossStreak: this.calcStreak(trades, 'loss'),
    }
  }

  private calcStreak(trades: Trade[], target: 'win' | 'loss'): number {
    let max = 0
    let current = 0
    for (const t of trades) {
      if (t.result === target) {
        current++
        max = Math.max(max, current)
      } else {
        current = 0
      }
    }
    return max
  }
}

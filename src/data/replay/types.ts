import type { Candle } from '../candles.js'
import type { Trade } from '../../core/backtest/Trade.js'
import type { BacktestExecutionEvent } from '../../core/backtest/execution-events.js'
import type { MovingAverageCrossParams } from '../../core/strategy/MovingAverageCrossStrategy.js'
import type { BacktestReport } from '../../core/analytics/types.js'

export interface BacktestReplayMetadata {
  backtestId: string
  symbol: string
  timeframe: string
  strategyName: string
  strategyVersion: string
  strategyParams: MovingAverageCrossParams | null
  initialCapital: number
  finalEquity: number
  candleCount: number
  tradeCount: number
  eventCount: number
  /** When candles reference a local dataset instead of being duplicated. */
  datasetId: string | null
  datasetTimeframe: string | null
  researchStartMs: number | null
  researchEndMs: number | null
  savedAt: number
  schemaVersion: number
}

export interface BacktestReplayCandleRecord {
  backtestId: string
  candles: Candle[]
}

export interface BacktestReplayTradeRecord {
  backtestId: string
  trades: Trade[]
}

export interface BacktestReplayEventRecord {
  backtestId: string
  events: BacktestExecutionEvent[]
}

export interface BacktestReplayBundle {
  metadata: BacktestReplayMetadata
  candles: Candle[]
  trades: Trade[]
  events: BacktestExecutionEvent[]
  reportSummary: Pick<
    BacktestReport['summary'],
    'netProfit' | 'totalTrades' | 'winRate' | 'profitFactor' | 'maxDrawdown' | 'finalBalance'
  > | null
}

export const REPLAY_SCHEMA_VERSION = 1

export interface BacktestReplayStore {
  putBundle(bundle: BacktestReplayBundle): Promise<void>
  getMetadata(backtestId: string): Promise<BacktestReplayMetadata | null>
  getCandles(backtestId: string): Promise<Candle[] | null>
  getTrades(backtestId: string): Promise<Trade[] | null>
  getEvents(backtestId: string): Promise<BacktestExecutionEvent[] | null>
  getBundle(backtestId: string): Promise<BacktestReplayBundle | null>
  listMetadata(): Promise<BacktestReplayMetadata[]>
  deleteBundle(backtestId: string): Promise<void>
  clear(): Promise<void>
}

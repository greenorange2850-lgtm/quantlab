import type { Candle } from '../candles.js'

export type CandleInterval =
  | '1m'
  | '3m'
  | '5m'
  | '15m'
  | '30m'
  | '1h'
  | '2h'
  | '4h'
  | '6h'
  | '8h'
  | '12h'
  | '1d'
  | '3d'
  | '1w'
  | '1M'
  | (string & {})

export interface GetCandlesParams {
  symbol: string
  interval: CandleInterval
  /**
   * Per-request page size when paginating (1–1000), or total candles for
   * limit-only (legacy) fetches without startTime/endTime.
   */
  limit: number
  /** Inclusive range start (ms). When set with endTime, provider paginates. */
  startTime?: number
  /** Inclusive range end (ms). When set with startTime, provider paginates. */
  endTime?: number
  /**
   * Hard ceiling on total candles for a calendar-range fetch.
   * Defaults to RESEARCH_PERIOD_MAX_CANDLES in BinanceProvider.
   */
  maxCandles?: number
  signal?: AbortSignal
}

export interface MarketDataProvider {
  getCandles(params: GetCandlesParams): Promise<Candle[]>
}

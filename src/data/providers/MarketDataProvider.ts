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
  limit: number
  signal?: AbortSignal
}

export interface MarketDataProvider {
  getCandles(params: GetCandlesParams): Promise<Candle[]>
}

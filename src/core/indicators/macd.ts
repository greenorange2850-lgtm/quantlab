import type { CandleSeries, MultiLineIndicatorSeries } from './types.js'

export interface MacdParams {
  fastPeriod: number
  slowPeriod: number
  signalPeriod: number
}

export function macd(_candles: CandleSeries, _params: MacdParams): MultiLineIndicatorSeries {
  throw new Error('Not implemented')
}

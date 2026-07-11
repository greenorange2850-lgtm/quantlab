import type { CandleSeries, MultiLineIndicatorSeries } from './types.js'

export interface BollingerParams {
  period: number
  stdDev: number
}

export function bollinger(_candles: CandleSeries, _params: BollingerParams): MultiLineIndicatorSeries {
  throw new Error('Not implemented')
}

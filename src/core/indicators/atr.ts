import type { CandleSeries, IndicatorSeries } from './types.js'

export interface AtrParams {
  period: number
}

export function atr(_candles: CandleSeries, _params: AtrParams): IndicatorSeries {
  throw new Error('Not implemented')
}

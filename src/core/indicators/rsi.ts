import type { CandleSeries, IndicatorSeries } from './types.js'

export interface RsiParams {
  period: number
}

export function rsi(_candles: CandleSeries, _params: RsiParams): IndicatorSeries {
  throw new Error('Not implemented')
}

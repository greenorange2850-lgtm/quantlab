import type { CandleSeries, IndicatorSeries } from './types.js'

export interface EmaParams {
  period: number
}

export function ema(_candles: CandleSeries, _params: EmaParams): IndicatorSeries {
  throw new Error('Not implemented')
}

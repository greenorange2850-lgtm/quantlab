import type { CandleSeries, IndicatorSeries } from './types.js'

export interface VwapParams {
  /** Optional session anchor timestamp (ISO). If omitted, VWAP spans full series. */
  sessionStart?: string
}

export function vwap(_candles: CandleSeries, _params?: VwapParams): IndicatorSeries {
  throw new Error('Not implemented')
}

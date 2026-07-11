export interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type NumericSeries = number[]

export interface IndicatorResult {
  values: number[]
}

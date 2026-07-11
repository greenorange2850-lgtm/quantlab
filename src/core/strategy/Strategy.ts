import type { Candle } from '../../data/candles.js'
import type { Signal } from '../signals/Signal.js'

export interface Strategy {
  readonly name: string
  evaluate(candles: Candle[], symbol: string): Signal
}

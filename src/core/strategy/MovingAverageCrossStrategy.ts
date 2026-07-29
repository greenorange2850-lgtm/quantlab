import { extractClosePrices, type Candle } from '../../data/candles.js'
import { calculateEMA } from '../indicators/ema.js'
import { calculateRSI } from '../indicators/rsi.js'
import { SignalType } from '../signals/SignalType.js'
import type { Signal } from '../signals/Signal.js'
import type { Strategy } from './Strategy.js'

export interface MovingAverageCrossParams {
  fastPeriod: number
  slowPeriod: number
  rsiPeriod: number
}

/** Defaults preserve the original hardcoded strategy behavior. */
export const DEFAULT_MA_CROSS_PARAMS: MovingAverageCrossParams = {
  fastPeriod: 20,
  slowPeriod: 50,
  rsiPeriod: 14,
}

export class MovingAverageCrossStrategy implements Strategy {
  readonly name = 'MovingAverageCross'
  readonly params: MovingAverageCrossParams

  constructor(params: Partial<MovingAverageCrossParams> = {}) {
    this.params = {
      ...DEFAULT_MA_CROSS_PARAMS,
      ...params,
    }
  }

  evaluate(candles: Candle[], symbol: string): Signal {
    const { fastPeriod, slowPeriod, rsiPeriod } = this.params
    const minCandles = slowPeriod + 1
    const timestamp = candles.at(-1)?.time ?? Date.now()

    if (candles.length < minCandles) {
      return this.hold(symbol, timestamp, 0, `Insufficient candle history (need at least ${minCandles})`)
    }

    const closes = extractClosePrices(candles)
    const emaFast = calculateEMA(closes, fastPeriod)
    const emaSlow = calculateEMA(closes, slowPeriod)
    const rsi = calculateRSI(closes, rsiPeriod)

    const i = closes.length - 1
    const prev = i - 1

    const fastNow = emaFast[i]
    const slowNow = emaSlow[i]
    const fastPrev = emaFast[prev]
    const slowPrev = emaSlow[prev]
    const rsiNow = rsi[i]

    if (
      [fastNow, slowNow, fastPrev, slowPrev, rsiNow].some((value) => Number.isNaN(value))
    ) {
      return this.hold(symbol, timestamp, 0, 'Indicators not ready')
    }

    const bullishCross = fastPrev <= slowPrev && fastNow > slowNow
    const bearishCross = fastPrev >= slowPrev && fastNow < slowNow

    if (bullishCross && rsiNow > 50) {
      return {
        signal: SignalType.BUY,
        confidence: this.confidenceFromRsi(rsiNow),
        reason: `EMA${fastPeriod} crossed above EMA${slowPeriod} with RSI confirmation (${rsiNow.toFixed(2)})`,
        timestamp,
        symbol,
        stopLossPrice: slowNow,
      }
    }

    if (bearishCross && rsiNow < 50) {
      return {
        signal: SignalType.SELL,
        confidence: this.confidenceFromRsi(100 - rsiNow),
        reason: `EMA${fastPeriod} crossed below EMA${slowPeriod} with RSI confirmation (${rsiNow.toFixed(2)})`,
        timestamp,
        symbol,
        stopLossPrice: slowNow,
      }
    }

    if (bullishCross || bearishCross) {
      return this.hold(
        symbol,
        timestamp,
        0.3,
        `EMA crossover detected but RSI did not confirm (RSI=${rsiNow.toFixed(2)})`,
      )
    }

    return this.hold(
      symbol,
      timestamp,
      0.5,
      `No EMA crossover (EMA${fastPeriod}=${fastNow.toFixed(2)}, EMA${slowPeriod}=${slowNow.toFixed(2)})`,
    )
  }

  getIndicators(candles: Candle[]): {
    ema20: number
    ema50: number
    rsi: number
  } | null {
    const { fastPeriod, slowPeriod, rsiPeriod } = this.params
    const minCandles = slowPeriod + 1
    if (candles.length < minCandles) {
      return null
    }

    const closes = extractClosePrices(candles)
    const ema20 = calculateEMA(closes, fastPeriod)
    const ema50 = calculateEMA(closes, slowPeriod)
    const rsi = calculateRSI(closes, rsiPeriod)
    const i = closes.length - 1

    const values = { ema20: ema20[i], ema50: ema50[i], rsi: rsi[i] }
    if (Object.values(values).some((value) => Number.isNaN(value))) {
      return null
    }

    return values
  }

  private hold(symbol: string, timestamp: number, confidence: number, reason: string): Signal {
    return {
      signal: SignalType.HOLD,
      confidence,
      reason,
      timestamp,
      symbol,
    }
  }

  private confidenceFromRsi(rsiDistance: number): number {
    return Math.min(0.95, 0.65 + Math.abs(rsiDistance - 50) / 100)
  }
}

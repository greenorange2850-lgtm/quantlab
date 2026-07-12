import { extractClosePrices, type Candle } from '../../data/candles.js'
import { calculateEMA } from '../indicators/ema.js'
import { calculateRSI } from '../indicators/rsi.js'
import { SignalType } from '../signals/SignalType.js'
import type { Signal } from '../signals/Signal.js'
import type { Strategy } from './Strategy.js'

const FAST_PERIOD = 20
const SLOW_PERIOD = 50
const RSI_PERIOD = 14
const MIN_CANDLES = SLOW_PERIOD + 1

export class MovingAverageCrossStrategy implements Strategy {
  readonly name = 'MovingAverageCross'

  evaluate(candles: Candle[], symbol: string): Signal {
    const timestamp = candles.at(-1)?.time ?? Date.now()

    if (candles.length < MIN_CANDLES) {
      return this.hold(symbol, timestamp, 0, `Insufficient candle history (need at least ${MIN_CANDLES})`)
    }

    const closes = extractClosePrices(candles)
    const emaFast = calculateEMA(closes, FAST_PERIOD)
    const emaSlow = calculateEMA(closes, SLOW_PERIOD)
    const rsi = calculateRSI(closes, RSI_PERIOD)

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
        reason: `EMA${FAST_PERIOD} crossed above EMA${SLOW_PERIOD} with RSI confirmation (${rsiNow.toFixed(2)})`,
        timestamp,
        symbol,
        stopLossPrice: slowNow,
      }
    }

    if (bearishCross && rsiNow < 50) {
      return {
        signal: SignalType.SELL,
        confidence: this.confidenceFromRsi(100 - rsiNow),
        reason: `EMA${FAST_PERIOD} crossed below EMA${SLOW_PERIOD} with RSI confirmation (${rsiNow.toFixed(2)})`,
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
      `No EMA crossover (EMA${FAST_PERIOD}=${fastNow.toFixed(2)}, EMA${SLOW_PERIOD}=${slowNow.toFixed(2)})`,
    )
  }

  getIndicators(candles: Candle[]): {
    ema20: number
    ema50: number
    rsi: number
  } | null {
    if (candles.length < MIN_CANDLES) {
      return null
    }

    const closes = extractClosePrices(candles)
    const ema20 = calculateEMA(closes, FAST_PERIOD)
    const ema50 = calculateEMA(closes, SLOW_PERIOD)
    const rsi = calculateRSI(closes, RSI_PERIOD)
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

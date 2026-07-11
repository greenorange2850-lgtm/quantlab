import { describe, expect, it } from 'vitest'
import type { Candle } from '../../../data/candles.js'
import { SignalType } from '../../signals/SignalType.js'
import { MovingAverageCrossStrategy } from '../MovingAverageCrossStrategy.js'

const SYMBOL = 'BTCUSDT'
const strategy = new MovingAverageCrossStrategy()

function buildCandles(closes: number[]): Candle[] {
  return closes.map((close, index) => {
    const open = index === 0 ? close : closes[index - 1]
    return {
      time: 1_700_000_000_000 + index * 3_600_000,
      open,
      high: Math.max(open, close) + 1,
      low: Math.min(open, close) - 1,
      close,
      volume: 100,
    }
  })
}

function findBullishCrossCloses(): number[] {
  for (let tail = 3; tail <= 10; tail++) {
    for (let step = 2; step <= 30; step++) {
      const head = Array.from({ length: 58 }, (_, index) => 200 - index * 1.2)
      const tailValues = Array.from({ length: tail }, (_, index) => 130 + (index + 1) * step)
      const closes = [...head, ...tailValues]
      const signal = strategy.evaluate(buildCandles(closes), SYMBOL)
      if (signal.signal === SignalType.BUY) {
        return closes
      }
    }
  }

  throw new Error('Unable to build bullish cross fixture')
}

function findBearishCrossCloses(): number[] {
  for (let tail = 3; tail <= 10; tail++) {
    for (let step = 2; step <= 30; step++) {
      const head = Array.from({ length: 58 }, (_, index) => 50 + index * 1.2)
      const start = head.at(-1)!
      const tailValues = Array.from({ length: tail }, (_, index) => start - (index + 1) * step)
      const closes = [...head, ...tailValues]
      const signal = strategy.evaluate(buildCandles(closes), SYMBOL)
      if (signal.signal === SignalType.SELL) {
        return closes
      }
    }
  }

  throw new Error('Unable to build bearish cross fixture')
}

describe('MovingAverageCrossStrategy', () => {
  it('returns HOLD when candle history is insufficient', () => {
    const candles = buildCandles(Array.from({ length: 30 }, (_, index) => 100 + index))
    const signal = strategy.evaluate(candles, SYMBOL)

    expect(signal.signal).toBe(SignalType.HOLD)
    expect(signal.reason).toContain('Insufficient candle history')
    expect(signal.confidence).toBe(0)
  })

  it('emits BUY on bullish EMA cross with RSI confirmation', () => {
    const closes = findBullishCrossCloses()
    const signal = strategy.evaluate(buildCandles(closes), SYMBOL)

    expect(signal.signal).toBe(SignalType.BUY)
    expect(signal.reason).toContain('crossed above')
    expect(signal.confidence).toBeGreaterThan(0.6)
  })

  it('emits SELL on bearish EMA cross with RSI confirmation', () => {
    const closes = findBearishCrossCloses()
    const signal = strategy.evaluate(buildCandles(closes), SYMBOL)

    expect(signal.signal).toBe(SignalType.SELL)
    expect(signal.reason).toContain('crossed below')
    expect(signal.confidence).toBeGreaterThan(0.6)
  })

  it('returns HOLD when crossover lacks RSI confirmation', () => {
    const closes = [
      ...Array.from({ length: 58 }, (_, index) => 200 - index * 1.2),
      130,
      145,
    ]
    const signal = strategy.evaluate(buildCandles(closes), SYMBOL)

    expect(signal.signal).toBe(SignalType.HOLD)
    expect(signal.reason).toMatch(/RSI did not confirm|No EMA crossover/)
  })

  it('returns HOLD when no crossover is present in a steady trend', () => {
    const candles = buildCandles(Array.from({ length: 70 }, (_, index) => 100 + index * 0.2))
    const signal = strategy.evaluate(candles, SYMBOL)

    expect(signal.signal).toBe(SignalType.HOLD)
    expect(signal.reason).toContain('No EMA crossover')
  })

  it('includes symbol and timestamp in the signal', () => {
    const candles = buildCandles(Array.from({ length: 60 }, (_, index) => 100 + index * 0.5))
    const signal = strategy.evaluate(candles, SYMBOL)

    expect(signal.symbol).toBe(SYMBOL)
    expect(signal.timestamp).toBe(candles.at(-1)?.time)
  })

  it('exposes latest indicator values', () => {
    const candles = buildCandles(Array.from({ length: 70 }, (_, index) => 100 + index * 0.5))
    const indicators = strategy.getIndicators(candles)

    expect(indicators).not.toBeNull()
    expect(indicators?.ema20).toBeGreaterThan(0)
    expect(indicators?.ema50).toBeGreaterThan(0)
    expect(indicators?.rsi).toBeGreaterThan(0)
  })
})

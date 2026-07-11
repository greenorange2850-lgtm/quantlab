import { describe, expect, it } from 'vitest'
import type { Candle } from '../../../data/candles.js'
import { SignalType, type SignalType as SignalTypeValue } from '../../signals/SignalType.js'
import type { Strategy } from '../../strategy/Strategy.js'
import { MockMarketDataProvider } from '../../../data/providers/MockMarketDataProvider.js'
import { BacktestEngine } from '../BacktestEngine.js'

const SYMBOL = 'BTCUSDT'

class ScriptedStrategy implements Strategy {
  readonly name = 'Scripted'
  private readonly sequence: SignalTypeValue[]

  constructor(sequence: SignalTypeValue[]) {
    this.sequence = sequence
  }

  evaluate(candles: Candle[], symbol: string) {
    const index = candles.length - 1
    const signal = this.sequence[index] ?? SignalType.HOLD

    return {
      signal,
      confidence: 1,
      reason: `scripted:${signal}`,
      timestamp: candles[index]?.time ?? Date.now(),
      symbol,
    }
  }
}

class HoldStrategy implements Strategy {
  readonly name = 'HoldOnly'

  evaluate(candles: Candle[], symbol: string) {
    return {
      signal: SignalType.HOLD,
      confidence: 0.5,
      reason: 'always hold',
      timestamp: candles.at(-1)?.time ?? Date.now(),
      symbol,
    }
  }
}

function buildConfig() {
  return {
    initialCapital: 10_000,
    commissionPercent: 0.1,
    positionSizePercent: 100,
    symbol: SYMBOL,
  }
}

describe('BacktestEngine', () => {
  const engine = new BacktestEngine()

  it('executes LONG trades on BUY then SELL signals at next candle open', async () => {
    const candles = await new MockMarketDataProvider({ seed: 11, basePrice: 100 }).getCandles({
      symbol: SYMBOL,
      interval: '1h',
      limit: 6,
    })

    const strategy = new ScriptedStrategy([
      SignalType.HOLD,
      SignalType.BUY,
      SignalType.HOLD,
      SignalType.HOLD,
      SignalType.SELL,
      SignalType.HOLD,
    ])

    const result = engine.run(candles, strategy, buildConfig())

    expect(result.trades).toHaveLength(1)
    expect(result.trades[0].direction).toBe('LONG')
    expect(result.trades[0].entryPrice).toBe(candles[2].open)
    expect(result.trades[0].exitPrice).toBe(candles[5].open)
    expect(result.statistics.totalTrades).toBe(1)
  })

  it('executes SHORT trades on SELL then BUY signals', async () => {
    const candles = await new MockMarketDataProvider({ seed: 12, basePrice: 100 }).getCandles({
      symbol: SYMBOL,
      interval: '1h',
      limit: 6,
    })

    const strategy = new ScriptedStrategy([
      SignalType.HOLD,
      SignalType.SELL,
      SignalType.HOLD,
      SignalType.HOLD,
      SignalType.BUY,
      SignalType.HOLD,
    ])

    const result = engine.run(candles, strategy, buildConfig())

    expect(result.trades).toHaveLength(1)
    expect(result.trades[0].direction).toBe('SHORT')
    expect(result.trades[0].entryPrice).toBe(candles[2].open)
    expect(result.trades[0].exitPrice).toBe(candles[5].open)
  })

  it('applies commission to completed trades', async () => {
    const candles = await new MockMarketDataProvider({ seed: 13, basePrice: 100 }).getCandles({
      symbol: SYMBOL,
      interval: '1h',
      limit: 6,
    })

    const strategy = new ScriptedStrategy([
      SignalType.HOLD,
      SignalType.BUY,
      SignalType.HOLD,
      SignalType.HOLD,
      SignalType.SELL,
      SignalType.HOLD,
    ])

    const result = engine.run(candles, strategy, buildConfig())

    expect(result.trades[0].commission).toBeGreaterThan(0)
  })

  it('produces no trades when strategy always returns HOLD', async () => {
    const candles = await new MockMarketDataProvider({ seed: 14 }).getCandles({
      symbol: SYMBOL,
      interval: '1h',
      limit: 20,
    })

    const result = engine.run(candles, new HoldStrategy(), buildConfig())

    expect(result.trades).toHaveLength(0)
    expect(result.statistics.totalTrades).toBe(0)
    expect(result.statistics.finalBalance).toBeCloseTo(10_000, 5)
  })

  it('evaluates strategy without future candles', async () => {
    const candles = await new MockMarketDataProvider({ seed: 15, basePrice: 100 }).getCandles({
      symbol: SYMBOL,
      interval: '1h',
      limit: 4,
    })

    const seenLengths: number[] = []
    const strategy: Strategy = {
      name: 'LengthTracker',
      evaluate(history) {
        seenLengths.push(history.length)
        return {
          signal: SignalType.HOLD,
          confidence: 0,
          reason: 'track',
          timestamp: history.at(-1)?.time ?? 0,
          symbol: SYMBOL,
        }
      },
    }

    engine.run(candles, strategy, buildConfig())
    expect(seenLengths).toEqual([1, 2, 3, 4])
  })

  it('does not execute a signal generated on the final candle', async () => {
    const candles = await new MockMarketDataProvider({ seed: 16, basePrice: 100 }).getCandles({
      symbol: SYMBOL,
      interval: '1h',
      limit: 3,
    })

    const strategy = new ScriptedStrategy([
      SignalType.HOLD,
      SignalType.HOLD,
      SignalType.BUY,
    ])

    const result = engine.run(candles, strategy, buildConfig())
    expect(result.trades).toHaveLength(0)
    expect(result.equityCurve).toHaveLength(3)
  })

  it('throws when candles are empty', () => {
    expect(() => engine.run([], new HoldStrategy(), buildConfig())).toThrow('candles must not be empty')
  })
})

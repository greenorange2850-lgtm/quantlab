import { describe, expect, it } from 'vitest'
import type { Candle } from '../../../data/candles.js'
import { SignalType, type SignalType as SignalTypeValue } from '../../signals/SignalType.js'
import type { Strategy } from '../../strategy/Strategy.js'
import { MockMarketDataProvider } from '../../../data/providers/MockMarketDataProvider.js'
import { defaultRiskConfig } from '../../risk/config.js'
import { HistoricalFeed } from '../../market/historical-feed.js'
import { BacktestEngine } from '../BacktestEngine.js'

const SYMBOL = 'BTCUSDT'
const TIMEFRAME = '1h'

class ScriptedStrategy implements Strategy {
  readonly name = 'Scripted'
  private readonly sequence: SignalTypeValue[]

  constructor(sequence: SignalTypeValue[]) {
    this.sequence = sequence
  }

  evaluate(candles: Candle[], symbol: string) {
    const index = candles.length - 1
    const signal = this.sequence[index] ?? SignalType.HOLD
    const close = candles[index]?.close ?? 0

    return {
      signal,
      confidence: 1,
      reason: `scripted:${signal}`,
      timestamp: candles[index]?.time ?? Date.now(),
      symbol,
      stopLossPrice:
        signal === SignalType.BUY
          ? close * 0.9
          : signal === SignalType.SELL
            ? close * 1.1
            : undefined,
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
    riskConfig: defaultRiskConfig,
  }
}

async function runWithHistoricalData(
  seed: number,
  limit: number,
  strategy: Strategy,
  basePrice = 100,
) {
  const feed = new HistoricalFeed(new MockMarketDataProvider({ seed, basePrice }))
  const engine = new BacktestEngine()
  const result = await engine.runWithHistoricalFeed(
    feed,
    { symbol: SYMBOL, timeframe: TIMEFRAME, limit },
    strategy,
    buildConfig(),
  )

  return {
    result,
    candles: [...feed.getHistory(SYMBOL)],
  }
}

describe('BacktestEngine', () => {
  const engine = new BacktestEngine()

  it('executes LONG trades on BUY then SELL signals at next candle open', async () => {
    const strategy = new ScriptedStrategy([
      SignalType.HOLD,
      SignalType.BUY,
      SignalType.HOLD,
      SignalType.HOLD,
      SignalType.SELL,
      SignalType.HOLD,
    ])

    const { result, candles } = await runWithHistoricalData(11, 6, strategy)

    expect(result.trades).toHaveLength(1)
    expect(result.trades[0].direction).toBe('LONG')
    expect(result.trades[0].entryPrice).toBe(candles[2].open)
    expect(result.trades[0].exitPrice).toBe(candles[5].open)
    expect(result.statistics.totalTrades).toBe(1)
  })

  it('executes SHORT trades on SELL then BUY signals', async () => {
    const strategy = new ScriptedStrategy([
      SignalType.HOLD,
      SignalType.SELL,
      SignalType.HOLD,
      SignalType.HOLD,
      SignalType.BUY,
      SignalType.HOLD,
    ])

    const { result, candles } = await runWithHistoricalData(12, 6, strategy)

    expect(result.trades).toHaveLength(1)
    expect(result.trades[0].direction).toBe('SHORT')
    expect(result.trades[0].entryPrice).toBe(candles[2].open)
    expect(result.trades[0].exitPrice).toBe(candles[5].open)
  })

  it('applies commission to completed trades', async () => {
    const strategy = new ScriptedStrategy([
      SignalType.HOLD,
      SignalType.BUY,
      SignalType.HOLD,
      SignalType.HOLD,
      SignalType.SELL,
      SignalType.HOLD,
    ])

    const { result } = await runWithHistoricalData(13, 6, strategy)

    expect(result.trades[0].commission).toBeGreaterThan(0)
  })

  it('produces no trades when strategy always returns HOLD', async () => {
    const { result } = await runWithHistoricalData(14, 20, new HoldStrategy())

    expect(result.trades).toHaveLength(0)
    expect(result.statistics.totalTrades).toBe(0)
    expect(result.statistics.finalBalance).toBeCloseTo(10_000, 5)
  })

  it('evaluates strategy without future candles', async () => {
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

    await runWithHistoricalData(15, 4, strategy)
    expect(seenLengths).toEqual([1, 2, 3, 4])
  })

  it('does not execute a signal generated on the final candle', async () => {
    const strategy = new ScriptedStrategy([
      SignalType.HOLD,
      SignalType.HOLD,
      SignalType.BUY,
    ])

    const { result } = await runWithHistoricalData(16, 3, strategy)
    expect(result.trades).toHaveLength(0)
    expect(result.equityCurve).toHaveLength(3)
  })

  it('throws when candles are empty', () => {
    expect(() => engine.run([], new HoldStrategy(), buildConfig())).toThrow('candles must not be empty')
  })
})

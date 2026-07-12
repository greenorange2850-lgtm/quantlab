import { describe, expect, it } from 'vitest'
import type { Candle } from '../../../data/candles.js'
import { SignalType } from '../../signals/SignalType.js'
import type { Signal } from '../../signals/Signal.js'
import type { Strategy } from '../../strategy/Strategy.js'
import { defaultRiskConfig } from '../../risk/config.js'
import { OrderSide } from '../../models/order.js'
import { BacktestEngine } from '../BacktestEngine.js'
import { Portfolio } from '../Portfolio.js'
import { buildOrderRequestFromSignal } from '../order-sizing.js'

const SYMBOL = 'BTCUSDT'

function buildConfig(initialCapital = 10_000) {
  return {
    initialCapital,
    commissionPercent: 0,
    positionSizePercent: 100,
    slippagePercent: 0,
    symbol: SYMBOL,
    riskConfig: { ...defaultRiskConfig, riskPercent: 1 },
  }
}

function buildCandle(index: number, open: number, close: number): Candle {
  return {
    time: index * 3_600_000,
    open,
    high: Math.max(open, close) + 1,
    low: Math.min(open, close) - 1,
    close,
    volume: 100,
  }
}

class SequenceStrategy implements Strategy {
  readonly name = 'Sequence'
  private readonly sequence: Array<{
    signal: (typeof SignalType)[keyof typeof SignalType]
    stopLossPrice?: number
  }>

  constructor(
    sequence: Array<{
      signal: (typeof SignalType)[keyof typeof SignalType]
      stopLossPrice?: number
    }>,
  ) {
    this.sequence = sequence
  }

  evaluate(candles: Candle[], symbol: string): Signal {
    const index = candles.length - 1
    const step = this.sequence[index] ?? { signal: SignalType.HOLD }

    return {
      signal: step.signal,
      confidence: 1,
      reason: `step-${index}`,
      timestamp: candles[index]?.time ?? 0,
      symbol,
      stopLossPrice: step.stopLossPrice,
    }
  }
}

describe('risk-based order sizing integration', () => {
  it('rejects entry signals without a stop loss', () => {
    const portfolio = new Portfolio(10_000)
    const request = buildOrderRequestFromSignal(
      portfolio,
      {
        signal: SignalType.BUY,
        confidence: 1,
        reason: 'test',
        timestamp: 0,
        symbol: SYMBOL,
      },
      100,
      buildConfig(),
    )

    expect(request).toBeNull()
  })

  it('rejects entry signals with an invalid stop loss', () => {
    const portfolio = new Portfolio(10_000)
    const request = buildOrderRequestFromSignal(
      portfolio,
      {
        signal: SignalType.BUY,
        confidence: 1,
        reason: 'test',
        timestamp: 0,
        symbol: SYMBOL,
        stopLossPrice: 105,
      },
      100,
      buildConfig(),
    )

    expect(request).toBeNull()
  })

  it('rejects sizing when equity is zero', () => {
    const portfolio = new Portfolio(0)
    const request = buildOrderRequestFromSignal(
      portfolio,
      {
        signal: SignalType.BUY,
        confidence: 1,
        reason: 'test',
        timestamp: 0,
        symbol: SYMBOL,
        stopLossPrice: 95,
      },
      100,
      buildConfig(0),
    )

    expect(request).toBeNull()
  })

  it('sizes a larger quantity after a winning trade increases equity', () => {
    const portfolio = new Portfolio(10_000)
    const config = buildConfig()

    const firstEntry = buildOrderRequestFromSignal(
      portfolio,
      {
        signal: SignalType.BUY,
        confidence: 1,
        reason: 'entry-1',
        timestamp: 0,
        symbol: SYMBOL,
        stopLossPrice: 95,
      },
      100,
      config,
    )

    expect(firstEntry?.quantity).toBeCloseTo(20, 5)

    portfolio.applyFill({
      orderId: 'order-1',
      symbol: SYMBOL,
      side: OrderSide.BUY,
      fillPrice: 100,
      fillQuantity: firstEntry!.quantity,
      commission: 0,
      slippage: 0,
      timestamp: 1,
    })

    portfolio.applyFill({
      orderId: 'order-2',
      symbol: SYMBOL,
      side: OrderSide.SELL,
      fillPrice: 110,
      fillQuantity: firstEntry!.quantity,
      commission: 0,
      slippage: 0,
      timestamp: 2,
    })

    const secondEntry = buildOrderRequestFromSignal(
      portfolio,
      {
        signal: SignalType.BUY,
        confidence: 1,
        reason: 'entry-2',
        timestamp: 3,
        symbol: SYMBOL,
        stopLossPrice: 105,
      },
      110,
      config,
    )

    expect(secondEntry?.quantity).toBeGreaterThan(firstEntry!.quantity)
  })

  it('sizes a smaller quantity after a losing trade reduces equity', () => {
    const portfolio = new Portfolio(10_000)
    const config = buildConfig()

    const firstEntry = buildOrderRequestFromSignal(
      portfolio,
      {
        signal: SignalType.BUY,
        confidence: 1,
        reason: 'entry-1',
        timestamp: 0,
        symbol: SYMBOL,
        stopLossPrice: 95,
      },
      100,
      config,
    )

    portfolio.applyFill({
      orderId: 'order-1',
      symbol: SYMBOL,
      side: OrderSide.BUY,
      fillPrice: 100,
      fillQuantity: firstEntry!.quantity,
      commission: 0,
      slippage: 0,
      timestamp: 1,
    })

    portfolio.applyFill({
      orderId: 'order-2',
      symbol: SYMBOL,
      side: OrderSide.SELL,
      fillPrice: 90,
      fillQuantity: firstEntry!.quantity,
      commission: 0,
      slippage: 0,
      timestamp: 2,
    })

    const secondEntry = buildOrderRequestFromSignal(
      portfolio,
      {
        signal: SignalType.BUY,
        confidence: 1,
        reason: 'entry-2',
        timestamp: 3,
        symbol: SYMBOL,
        stopLossPrice: 85,
      },
      90,
      config,
    )

    expect(secondEntry?.quantity).toBeLessThan(firstEntry!.quantity)
  })

  it('executes two consecutive winning trades with increasing position size', () => {
    const candles = [
      buildCandle(0, 100, 100),
      buildCandle(1, 100, 100),
      buildCandle(2, 100, 100),
      buildCandle(3, 100, 100),
      buildCandle(4, 100, 100),
      buildCandle(5, 110, 110),
      buildCandle(6, 110, 110),
      buildCandle(7, 110, 110),
      buildCandle(8, 110, 110),
      buildCandle(9, 120, 120),
      buildCandle(10, 120, 120),
    ]

    const strategy = new SequenceStrategy([
      { signal: SignalType.HOLD },
      { signal: SignalType.BUY, stopLossPrice: 95 },
      { signal: SignalType.HOLD },
      { signal: SignalType.HOLD },
      { signal: SignalType.SELL },
      { signal: SignalType.HOLD },
      { signal: SignalType.BUY, stopLossPrice: 105 },
      { signal: SignalType.HOLD },
      { signal: SignalType.HOLD },
      { signal: SignalType.SELL },
      { signal: SignalType.HOLD },
    ])

    const result = new BacktestEngine().run(candles, strategy, buildConfig())

    expect(result.trades).toHaveLength(2)
    expect(result.trades[0]?.pnl).toBeGreaterThan(0)
    expect(result.trades[1]?.pnl).toBeGreaterThan(0)
    expect(result.trades[1]!.quantity).toBeGreaterThan(result.trades[0]!.quantity)
  })
})

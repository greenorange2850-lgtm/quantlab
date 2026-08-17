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

describe('configurable riskPercent integration', () => {
  const EQUITY = 10_000
  const ENTRY = 100
  const STOP = 95 // $5 stop distance
  const SYMBOL = 'BTCUSDT'

  function buildConfigWithRisk(riskPercent: number) {
    return {
      initialCapital: EQUITY,
      commissionPercent: 0,
      positionSizePercent: 100,
      slippagePercent: 0,
      symbol: SYMBOL,
      riskConfig: { ...defaultRiskConfig, riskPercent },
    }
  }

  function sizeEntry(riskPercent: number): number {
    const portfolio = new Portfolio(EQUITY)
    const request = buildOrderRequestFromSignal(
      portfolio,
      {
        signal: SignalType.BUY,
        confidence: 1,
        reason: 'test',
        timestamp: 0,
        symbol: SYMBOL,
        stopLossPrice: STOP,
      },
      ENTRY,
      buildConfigWithRisk(riskPercent),
    )
    if (!request) throw new Error(`No order request for riskPercent=${riskPercent}`)
    return request.quantity
  }

  it('lower risk-per-trade produces a smaller position size', () => {
    const lowRisk = sizeEntry(0.5)
    const highRisk = sizeEntry(2)
    expect(lowRisk).toBeLessThan(highRisk)
  })

  it('higher risk-per-trade produces a larger position size under identical candles/signals', () => {
    const baseline = sizeEntry(1)
    const larger = sizeEntry(5)
    expect(larger).toBeGreaterThan(baseline)
  })

  it('position size scales linearly with riskPercent', () => {
    const size1 = sizeEntry(1)
    const size2 = sizeEntry(2)
    expect(size2).toBeCloseTo(size1 * 2, 5)
  })

  it('sizing respects available equity/cash constraints (cash < uncapped quantity)', () => {
    // With riskPercent=50, uncapped qty = (10000*0.5/100)/5 = 10 units at $100 = $1000 notional
    // That fits in cash. Test with a very large riskPercent so notional would exceed cash.
    const portfolio = new Portfolio(1_000)
    // riskPercent=100 => riskAmount=1000 / stopDistance=5 => qty=200, notional=200*100=$20000 >> $1000
    const request = buildOrderRequestFromSignal(
      portfolio,
      {
        signal: SignalType.BUY,
        confidence: 1,
        reason: 'test',
        timestamp: 0,
        symbol: SYMBOL,
        stopLossPrice: STOP,
      },
      ENTRY,
      {
        initialCapital: 1_000,
        commissionPercent: 0,
        positionSizePercent: 100,
        slippagePercent: 0,
        symbol: SYMBOL,
        riskConfig: { ...defaultRiskConfig, riskPercent: 100 },
      },
    )
    expect(request).not.toBeNull()
    // quantity must not exceed available cash / price
    expect(request!.quantity * ENTRY).toBeLessThanOrEqual(1_000)
  })

  it('existing default behavior remains compatible (riskPercent=1, stop=$5 => qty≈20)', () => {
    const portfolio = new Portfolio(10_000)
    const request = buildOrderRequestFromSignal(
      portfolio,
      {
        signal: SignalType.BUY,
        confidence: 1,
        reason: 'test',
        timestamp: 0,
        symbol: SYMBOL,
        stopLossPrice: STOP,
      },
      ENTRY,
      buildConfig(), // uses defaultRiskConfig with riskPercent=1
    )
    // riskAmount = 10000*1/100 = 100, stopDist=5, qty=100/5=20
    expect(request?.quantity).toBeCloseTo(20, 5)
  })
})

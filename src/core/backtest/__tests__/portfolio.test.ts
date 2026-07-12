import { describe, expect, it } from 'vitest'
import { OrderSide } from '../../models/order.js'
import { Portfolio } from '../Portfolio.js'
import { TradeDirection } from '../Trade.js'
import type { Fill } from '../../execution/fill.js'

const SYMBOL = 'BTCUSDT'

function buildFill(overrides: Partial<Fill> = {}): Fill {
  return {
    orderId: 'order-1',
    symbol: SYMBOL,
    side: OrderSide.BUY,
    fillPrice: 100,
    fillQuantity: 10,
    commission: 1,
    slippage: 0,
    timestamp: 1_000,
    ...overrides,
  }
}

describe('Portfolio', () => {
  it('opens and closes a LONG position from fills', () => {
    const portfolio = new Portfolio(10_000)
    portfolio.applyFill(buildFill({ side: OrderSide.BUY, fillQuantity: 10 }))
    const position = portfolio.getPosition()

    expect(position?.direction).toBe(TradeDirection.LONG)
    expect(position?.quantity).toBe(10)

    const trade = portfolio.applyFill(
      buildFill({
        side: OrderSide.SELL,
        fillPrice: 110,
        fillQuantity: 10,
        timestamp: 2_000,
        orderId: 'order-2',
      }),
    )

    expect(trade?.direction).toBe(TradeDirection.LONG)
    expect(trade?.pnl).toBeGreaterThan(0)
    expect(portfolio.hasOpenPosition()).toBe(false)
  })

  it('opens and closes a SHORT position from fills', () => {
    const portfolio = new Portfolio(10_000)
    portfolio.applyFill(buildFill({ side: OrderSide.SELL, fillQuantity: 10 }))
    const position = portfolio.getPosition()

    expect(position?.direction).toBe(TradeDirection.SHORT)
    expect(position?.quantity).toBe(10)

    const trade = portfolio.applyFill(
      buildFill({
        side: OrderSide.BUY,
        fillPrice: 90,
        fillQuantity: 10,
        timestamp: 2_000,
        orderId: 'order-2',
      }),
    )

    expect(trade?.direction).toBe(TradeDirection.SHORT)
    expect(trade?.pnl).toBeGreaterThan(0)
    expect(portfolio.hasOpenPosition()).toBe(false)
  })

  it('tracks equity for open LONG and SHORT positions', () => {
    const longPortfolio = new Portfolio(10_000)
    longPortfolio.applyFill(buildFill({ side: OrderSide.BUY, fillQuantity: 100, commission: 0 }))
    expect(longPortfolio.getEquity(110)).toBeGreaterThan(10_000)

    const shortPortfolio = new Portfolio(10_000)
    shortPortfolio.applyFill(buildFill({ side: OrderSide.SELL, fillQuantity: 100, commission: 0 }))
    expect(shortPortfolio.getEquity(90)).toBeGreaterThan(10_000)
  })

  it('throws when applying a conflicting fill while a position is open', () => {
    const portfolio = new Portfolio(10_000)
    portfolio.applyFill(buildFill({ side: OrderSide.BUY, fillQuantity: 10 }))

    expect(() =>
      portfolio.applyFill(
        buildFill({ side: OrderSide.BUY, fillQuantity: 5, orderId: 'order-2' }),
      ),
    ).toThrow('Cannot apply BUY fill while a LONG position is open')
  })
})

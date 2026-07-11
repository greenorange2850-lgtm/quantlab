import { describe, expect, it } from 'vitest'
import { Portfolio } from '../Portfolio.js'
import { TradeDirection } from '../Trade.js'

const SYMBOL = 'BTCUSDT'

describe('Portfolio', () => {
  it('opens and closes a LONG position', () => {
    const portfolio = new Portfolio(10_000)
    portfolio.openLong(SYMBOL, 100, 1_000, 0.1, 10)
    const position = portfolio.getPosition()

    expect(position?.direction).toBe(TradeDirection.LONG)
    expect(position?.quantity).toBeCloseTo(9.99, 1)

    const trade = portfolio.close(SYMBOL, 110, 2_000, 0.1)
    expect(trade.direction).toBe(TradeDirection.LONG)
    expect(trade.pnl).toBeGreaterThan(0)
    expect(portfolio.hasOpenPosition()).toBe(false)
  })

  it('opens and closes a SHORT position', () => {
    const portfolio = new Portfolio(10_000)
    portfolio.openShort(SYMBOL, 100, 1_000, 0.1, 10)
    const position = portfolio.getPosition()

    expect(position?.direction).toBe(TradeDirection.SHORT)
    expect(position?.quantity).toBeCloseTo(10, 1)

    const trade = portfolio.close(SYMBOL, 90, 2_000, 0.1)
    expect(trade.direction).toBe(TradeDirection.SHORT)
    expect(trade.pnl).toBeGreaterThan(0)
    expect(portfolio.hasOpenPosition()).toBe(false)
  })

  it('tracks equity for open LONG and SHORT positions', () => {
    const longPortfolio = new Portfolio(10_000)
    longPortfolio.openLong(SYMBOL, 100, 1_000, 0, 100)
    expect(longPortfolio.getEquity(110)).toBeGreaterThan(10_000)

    const shortPortfolio = new Portfolio(10_000)
    shortPortfolio.openShort(SYMBOL, 100, 1_000, 0, 100)
    expect(shortPortfolio.getEquity(90)).toBeGreaterThan(10_000)
  })

  it('throws when opening while a position is already open', () => {
    const portfolio = new Portfolio(10_000)
    portfolio.openLong(SYMBOL, 100, 1_000, 0.1, 100)

    expect(() => portfolio.openShort(SYMBOL, 100, 2_000, 0.1, 100)).toThrow(
      'Cannot open SHORT while a position is already open',
    )
  })
})

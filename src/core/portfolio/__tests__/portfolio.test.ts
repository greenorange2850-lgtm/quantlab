import { describe, expect, it } from 'vitest'
import { PositionSide } from '../../models/position.js'
import { calculateBuyingPower, PortfolioAccountType } from '../account.js'
import { calculateAllocation } from '../allocation.js'
import { calculateExposure } from '../exposure.js'
import { calculatePortfolioPnL, calculatePositionUnrealizedPnL } from '../performance.js'
import {
  buildPortfolio,
  buildPortfolioFromBacktestBalances,
  calculatePortfolioValue,
  type MarkedPosition,
} from '../portfolio.js'

const longBtc: MarkedPosition = {
  symbol: 'BTCUSDT',
  quantity: 2,
  side: PositionSide.LONG,
  entryPrice: 100,
  markPrice: 110,
}

const shortEth: MarkedPosition = {
  symbol: 'ETHUSDT',
  quantity: 5,
  side: PositionSide.SHORT,
  entryPrice: 50,
  markPrice: 45,
  realizedPnL: 10,
}

describe('calculatePortfolioValue', () => {
  it('returns cash for an empty portfolio', () => {
    expect(calculatePortfolioValue({ cash: 10_000, positions: [] })).toBe(10_000)
  })

  it('values a single long position', () => {
    expect(
      calculatePortfolioValue({
        cash: 8_000,
        positions: [longBtc],
      }),
    ).toBe(8_220)
  })

  it('values long and short positions together', () => {
    expect(
      calculatePortfolioValue({
        cash: 10_000,
        positions: [longBtc, shortEth],
      }),
    ).toBe(9_995)
  })

  it('handles zero cash with open positions', () => {
    expect(
      calculatePortfolioValue({
        cash: 0,
        positions: [longBtc],
      }),
    ).toBe(220)
  })
})

describe('calculateExposure', () => {
  it('returns zero for an empty portfolio', () => {
    expect(calculateExposure([])).toBe(0)
  })

  it('sums absolute market values across positions', () => {
    expect(calculateExposure([longBtc, shortEth])).toBe(445)
  })
})

describe('calculatePortfolioPnL', () => {
  it('returns zero pnl for an empty portfolio', () => {
    expect(calculatePortfolioPnL([])).toEqual({
      realizedPnL: 0,
      unrealizedPnL: 0,
    })
  })

  it('calculates unrealized pnl for a single position', () => {
    expect(calculatePortfolioPnL([longBtc])).toEqual({
      realizedPnL: 0,
      unrealizedPnL: 20,
    })
  })

  it('aggregates realized and unrealized pnl across positions', () => {
    expect(calculatePortfolioPnL([longBtc, shortEth])).toEqual({
      realizedPnL: 10,
      unrealizedPnL: 45,
    })
  })

  it('handles negative unrealized pnl', () => {
    const losingLong: MarkedPosition = {
      ...longBtc,
      markPrice: 90,
    }

    expect(calculatePositionUnrealizedPnL(losingLong)).toBe(-20)
    expect(calculatePortfolioPnL([losingLong]).unrealizedPnL).toBe(-20)
  })
})

describe('calculateAllocation', () => {
  it('returns zero weights when equity is zero', () => {
    expect(calculateAllocation([longBtc], 0)).toEqual([
      {
        symbol: 'BTCUSDT',
        quantity: 2,
        marketValue: 220,
        costBasis: 200,
        unrealizedPnL: 20,
        realizedPnL: 0,
        weight: 0,
      },
    ])
  })

  it('allocates weights for multiple positions', () => {
    const allocation = calculateAllocation([longBtc, shortEth], 9_995)

    expect(allocation[0]?.weight).toBeCloseTo(2.201, 2)
    expect(allocation[1]?.weight).toBeCloseTo(2.251, 2)
  })
})

describe('buildPortfolio', () => {
  it('builds a complete portfolio snapshot', () => {
    const portfolio = buildPortfolio({
      cash: 10_000,
      positions: [longBtc, shortEth],
    })

    expect(portfolio.equity).toBe(9_995)
    expect(portfolio.totalExposure).toBe(445)
    expect(portfolio.realizedPnL).toBe(10)
    expect(portfolio.unrealizedPnL).toBe(45)
    expect(portfolio.buyingPower).toBe(10_000)
    expect(portfolio.positions).toHaveLength(2)
  })

  it('supports margin buying power', () => {
    const buyingPower = calculateBuyingPower({
      cash: 5_000,
      equity: 10_000,
      marginUsed: 2_000,
      accountType: PortfolioAccountType.MARGIN,
      marginMultiplier: 2,
    })

    expect(buyingPower).toBe(18_000)
  })
})

describe('buildPortfolioFromBacktestBalances', () => {
  it('maps closed backtest balances without open positions', () => {
    const portfolio = buildPortfolioFromBacktestBalances({
      cash: 10_500,
      equity: 10_500,
      realizedPnL: 500,
      positions: [],
    })

    expect(portfolio.cash).toBe(10_500)
    expect(portfolio.equity).toBe(10_500)
    expect(portfolio.realizedPnL).toBe(500)
    expect(portfolio.unrealizedPnL).toBe(0)
    expect(portfolio.totalExposure).toBe(0)
    expect(portfolio.positions).toEqual([])
  })

  it('includes open positions from a backtest snapshot', () => {
    const portfolio = buildPortfolioFromBacktestBalances({
      cash: 8_000,
      equity: 8_220,
      realizedPnL: 120,
      positions: [longBtc],
    })

    expect(portfolio.equity).toBe(8_220)
    expect(portfolio.realizedPnL).toBe(120)
    expect(portfolio.unrealizedPnL).toBe(20)
    expect(portfolio.positions[0]?.symbol).toBe('BTCUSDT')
  })
})

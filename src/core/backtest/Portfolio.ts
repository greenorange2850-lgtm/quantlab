import { TradeDirection, type Trade } from './Trade.js'
import type { Position } from './Position.js'
import {
  calculateCommission,
  calculatePnL,
  calculatePositionQuantity,
  calculateTradeDuration,
} from './trade-math.js'

export class Portfolio {
  private cash: number
  private position: Position | null = null
  private readonly closedTrades: Trade[] = []
  private tradeCounter = 0

  constructor(initialCapital: number) {
    this.cash = initialCapital
  }

  getCash(): number {
    return this.cash
  }

  getPosition(): Position | null {
    return this.position
  }

  getClosedTrades(): Trade[] {
    return [...this.closedTrades]
  }

  hasOpenPosition(): boolean {
    return this.position !== null
  }

  getEquity(markPrice: number): number {
    if (!this.position) {
      return this.cash
    }

    if (this.position.direction === TradeDirection.LONG) {
      return this.cash + this.position.quantity * markPrice
    }

    return this.cash - this.position.quantity * markPrice
  }

  openLong(
    symbol: string,
    price: number,
    time: number,
    commissionPercent: number,
    positionSizePercent: number,
  ): void {
    if (this.position) {
      throw new Error('Cannot open LONG while a position is already open')
    }

    const equity = this.getEquity(price)
    const allocation = (equity * positionSizePercent) / 100
    const spendable = Math.min(allocation, this.cash)
    const quantity = spendable / (price * (1 + commissionPercent / 100))
    const entryCommission = calculateCommission(price * quantity, commissionPercent)
    const cost = price * quantity + entryCommission

    if (quantity <= 0 || cost > this.cash + 1e-9) {
      throw new Error('Insufficient cash to open LONG position')
    }

    this.cash -= cost
    this.position = {
      symbol,
      direction: TradeDirection.LONG,
      quantity,
      entryPrice: price,
      entryTime: time,
      entryCommission,
    }
  }

  openShort(
    symbol: string,
    price: number,
    time: number,
    commissionPercent: number,
    positionSizePercent: number,
  ): void {
    if (this.position) {
      throw new Error('Cannot open SHORT while a position is already open')
    }

    const equity = this.getEquity(price)
    const quantity = calculatePositionQuantity(equity, price, positionSizePercent)
    const entryCommission = calculateCommission(price * quantity, commissionPercent)
    const proceeds = price * quantity - entryCommission

    this.cash += proceeds
    this.position = {
      symbol,
      direction: TradeDirection.SHORT,
      quantity,
      entryPrice: price,
      entryTime: time,
      entryCommission,
    }
  }

  close(symbol: string, price: number, time: number, commissionPercent: number): Trade {
    if (!this.position) {
      throw new Error('Cannot close position when none is open')
    }

    if (this.position.symbol !== symbol) {
      throw new Error('Cannot close position for a different symbol')
    }

    const exitCommission = calculateCommission(price * this.position.quantity, commissionPercent)
    const totalCommission = this.position.entryCommission + exitCommission
    const pnl = calculatePnL(
      this.position.direction,
      this.position.entryPrice,
      price,
      this.position.quantity,
      this.position.entryCommission,
      exitCommission,
    )

    if (this.position.direction === TradeDirection.LONG) {
      this.cash += price * this.position.quantity - exitCommission
    } else {
      this.cash -= price * this.position.quantity + exitCommission
    }

    const trade: Trade = {
      id: `trade-${++this.tradeCounter}`,
      symbol,
      entryTime: this.position.entryTime,
      exitTime: time,
      entryPrice: this.position.entryPrice,
      exitPrice: price,
      quantity: this.position.quantity,
      direction: this.position.direction,
      pnl,
      commission: totalCommission,
      duration: calculateTradeDuration(this.position.entryTime, time),
    }

    this.position = null
    this.closedTrades.push(trade)
    return trade
  }
}

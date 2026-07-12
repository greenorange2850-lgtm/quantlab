import { OrderSide } from '../models/order.js'
import type { Fill } from '../execution/fill.js'
import { TradeDirection, type Trade } from './Trade.js'
import type { Position } from './Position.js'
import {
  calculatePnL,
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

  /**
   * Applies an execution fill as the only path for cash and position updates.
   */
  applyFill(fill: Fill): Trade | null {
    if (fill.side === OrderSide.BUY) {
      if (this.position?.direction === TradeDirection.SHORT) {
        return this.closePosition(fill)
      }

      if (!this.position) {
        this.openPosition(fill, TradeDirection.LONG)
        return null
      }

      throw new Error('Cannot apply BUY fill while a LONG position is open')
    }

    if (this.position?.direction === TradeDirection.LONG) {
      return this.closePosition(fill)
    }

    if (!this.position) {
      this.openPosition(fill, TradeDirection.SHORT)
      return null
    }

    throw new Error('Cannot apply SELL fill while a SHORT position is open')
  }

  private openPosition(fill: Fill, direction: TradeDirection): void {
    if (this.position) {
      throw new Error('Cannot open a position while another position is open')
    }

    if (direction === TradeDirection.LONG) {
      const cost = fill.fillPrice * fill.fillQuantity + fill.commission
      if (cost > this.cash + 1e-9) {
        throw new Error('Insufficient cash to apply BUY fill')
      }

      this.cash -= cost
    } else {
      const proceeds = fill.fillPrice * fill.fillQuantity - fill.commission
      this.cash += proceeds
    }

    this.position = {
      symbol: fill.symbol,
      direction,
      quantity: fill.fillQuantity,
      entryPrice: fill.fillPrice,
      entryTime: fill.timestamp,
      entryCommission: fill.commission,
    }
  }

  private closePosition(fill: Fill): Trade {
    if (!this.position) {
      throw new Error('Cannot close position when none is open')
    }

    if (this.position.symbol !== fill.symbol) {
      throw new Error('Cannot close position for a different symbol')
    }

    const exitCommission = fill.commission
    const totalCommission = this.position.entryCommission + exitCommission
    const pnl = calculatePnL(
      this.position.direction,
      this.position.entryPrice,
      fill.fillPrice,
      fill.fillQuantity,
      this.position.entryCommission,
      exitCommission,
    )

    if (this.position.direction === TradeDirection.LONG) {
      this.cash += fill.fillPrice * fill.fillQuantity - exitCommission
    } else {
      this.cash -= fill.fillPrice * fill.fillQuantity + exitCommission
    }

    const trade: Trade = {
      id: `trade-${++this.tradeCounter}`,
      symbol: fill.symbol,
      entryTime: this.position.entryTime,
      exitTime: fill.timestamp,
      entryPrice: this.position.entryPrice,
      exitPrice: fill.fillPrice,
      quantity: fill.fillQuantity,
      direction: this.position.direction,
      pnl,
      commission: totalCommission,
      duration: calculateTradeDuration(this.position.entryTime, fill.timestamp),
    }

    this.position = null
    this.closedTrades.push(trade)
    return trade
  }
}

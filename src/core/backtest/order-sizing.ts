import type { Portfolio } from './Portfolio.js'
import type { BacktestConfig } from './BacktestConfig.js'
import { calculatePositionQuantity } from './trade-math.js'
import { OrderSide, OrderType } from '../models/order.js'
import { estimateFillPrice } from '../execution/execution-engine.js'
import { SignalType } from '../signals/SignalType.js'
import type { Signal } from '../signals/Signal.js'
import { TradeDirection } from './Trade.js'
import type { OrderRequest } from '../execution/order-request.js'

export function buildOrderRequestFromSignal(
  portfolio: Portfolio,
  signal: Signal,
  price: number,
  config: BacktestConfig,
): OrderRequest | null {
  const position = portfolio.getPosition()

  if (signal.signal === SignalType.BUY) {
    if (position?.direction === TradeDirection.SHORT) {
      return {
        symbol: config.symbol,
        side: OrderSide.BUY,
        quantity: position.quantity,
        orderType: OrderType.MARKET,
      }
    }

    if (!position) {
      const quantity = calculateLongOpenQuantity(portfolio, price, config)
      if (quantity <= 0) {
        return null
      }

      return {
        symbol: config.symbol,
        side: OrderSide.BUY,
        quantity,
        orderType: OrderType.MARKET,
      }
    }

    return null
  }

  if (signal.signal === SignalType.SELL) {
    if (position?.direction === TradeDirection.LONG) {
      return {
        symbol: config.symbol,
        side: OrderSide.SELL,
        quantity: position.quantity,
        orderType: OrderType.MARKET,
      }
    }

    if (!position) {
      const quantity = calculateShortOpenQuantity(portfolio, price, config)
      if (quantity <= 0) {
        return null
      }

      return {
        symbol: config.symbol,
        side: OrderSide.SELL,
        quantity,
        orderType: OrderType.MARKET,
      }
    }

    return null
  }

  return null
}

function calculateLongOpenQuantity(
  portfolio: Portfolio,
  price: number,
  config: BacktestConfig,
): number {
  const equity = portfolio.getEquity(price)
  const allocation = (equity * config.positionSizePercent) / 100
  const spendable = Math.min(allocation, portfolio.getCash())
  const fillPrice = estimateFillPrice(price, OrderSide.BUY, config.slippagePercent ?? 0)
  const costPerUnit = fillPrice * (1 + config.commissionPercent / 100)

  if (costPerUnit <= 0) {
    return 0
  }

  return spendable / costPerUnit
}

function calculateShortOpenQuantity(
  portfolio: Portfolio,
  price: number,
  config: BacktestConfig,
): number {
  const fillPrice = estimateFillPrice(price, OrderSide.SELL, config.slippagePercent ?? 0)

  return calculatePositionQuantity(
    portfolio.getEquity(price),
    fillPrice,
    config.positionSizePercent,
  )
}

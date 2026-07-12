import type { Portfolio } from './Portfolio.js'
import type { BacktestConfig } from './BacktestConfig.js'
import { OrderSide, OrderType } from '../models/order.js'
import { estimateFillPrice } from '../execution/execution-engine.js'
import { SignalType } from '../signals/SignalType.js'
import type { Signal } from '../signals/Signal.js'
import { TradeDirection } from './Trade.js'
import type { OrderRequest } from '../execution/order-request.js'
import { defaultRiskConfig, type RiskConfig } from '../risk/config.js'
import { calculatePositionSize } from '../risk/position-sizing.js'

export function buildOrderRequestFromSignal(
  portfolio: Portfolio,
  signal: Signal,
  price: number,
  config: BacktestConfig,
): OrderRequest | null {
  const riskConfig = config.riskConfig ?? defaultRiskConfig
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
      if (!riskConfig.allowLong) {
        return null
      }

      const quantity = calculateRiskBasedEntryQuantity(
        portfolio,
        price,
        signal.stopLossPrice,
        config,
        riskConfig,
        OrderSide.BUY,
      )

      if (quantity === null) {
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
      if (!riskConfig.allowShort) {
        return null
      }

      const quantity = calculateRiskBasedEntryQuantity(
        portfolio,
        price,
        signal.stopLossPrice,
        config,
        riskConfig,
        OrderSide.SELL,
      )

      if (quantity === null) {
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

function calculateRiskBasedEntryQuantity(
  portfolio: Portfolio,
  entryPrice: number,
  stopLossPrice: number | undefined,
  config: BacktestConfig,
  riskConfig: RiskConfig,
  side: OrderSide,
): number | null {
  if (stopLossPrice === undefined || !isValidStopLoss(entryPrice, stopLossPrice, side)) {
    return null
  }

  const equity = portfolio.getEquity(entryPrice)
  if (equity <= 0) {
    return null
  }

  const fillPrice = estimateFillPrice(entryPrice, side, config.slippagePercent ?? 0)

  let quantity: number

  try {
    const sized = calculatePositionSize({
      accountEquity: equity,
      riskPercent: riskConfig.riskPercent,
      entryPrice: fillPrice,
      stopLossPrice,
    })

    if (sized.quantity <= 0) {
      return null
    }

    quantity = sized.quantity
  } catch {
    return null
  }

  const maxNotional = equity * (riskConfig.maxPositionSize / 100)
  if (quantity * fillPrice > maxNotional) {
    quantity = maxNotional / fillPrice
  }

  if (side === OrderSide.BUY) {
    const costPerUnit = fillPrice * (1 + config.commissionPercent / 100)
    if (costPerUnit <= 0) {
      return null
    }

    quantity = Math.min(quantity, portfolio.getCash() / costPerUnit)
  }

  return quantity > 0 ? quantity : null
}

function isValidStopLoss(entryPrice: number, stopLossPrice: number, side: OrderSide): boolean {
  if (!Number.isFinite(stopLossPrice) || stopLossPrice <= 0) {
    return false
  }

  if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
    return false
  }

  if (entryPrice === stopLossPrice) {
    return false
  }

  if (side === OrderSide.BUY) {
    return stopLossPrice < entryPrice
  }

  return stopLossPrice > entryPrice
}

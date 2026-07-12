import { OrderSide, OrderType } from '../models/order.js'

/**
 * Instruction submitted to the execution engine before routing to a venue.
 */
export interface OrderRequest {
  id?: string
  symbol: string
  side: OrderSide
  quantity: number
  orderType: OrderType
  limitPrice?: number
  stopPrice?: number
}

export function validateOrderRequest(request: OrderRequest): void {
  if (!request.symbol.trim()) {
    throw new Error('symbol must be a non-empty string')
  }

  if (!Number.isFinite(request.quantity) || request.quantity <= 0) {
    throw new Error('quantity must be a positive finite number')
  }

  if (request.orderType === OrderType.LIMIT || request.orderType === OrderType.STOP_LIMIT) {
    if (request.limitPrice === undefined || !Number.isFinite(request.limitPrice) || request.limitPrice <= 0) {
      throw new Error('limitPrice is required for limit orders')
    }
  }

  if (request.orderType === OrderType.STOP || request.orderType === OrderType.STOP_LIMIT) {
    if (request.stopPrice === undefined || !Number.isFinite(request.stopPrice) || request.stopPrice <= 0) {
      throw new Error('stopPrice is required for stop orders')
    }
  }
}

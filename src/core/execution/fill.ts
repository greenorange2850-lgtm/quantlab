import type { OrderSide } from '../models/order.js'

/**
 * A single execution fill against an order.
 */
export interface Fill {
  orderId: string
  symbol: string
  side: OrderSide
  fillPrice: number
  fillQuantity: number
  commission: number
  slippage: number
  timestamp: number
}

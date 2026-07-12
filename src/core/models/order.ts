/**
 * Order side relative to the instrument.
 */
export const OrderSide = {
  BUY: 'BUY',
  SELL: 'SELL',
} as const

export type OrderSide = (typeof OrderSide)[keyof typeof OrderSide]

/**
 * Supported order types for the execution layer.
 */
export const OrderType = {
  MARKET: 'MARKET',
  LIMIT: 'LIMIT',
  STOP: 'STOP',
  STOP_LIMIT: 'STOP_LIMIT',
} as const

export type OrderType = (typeof OrderType)[keyof typeof OrderType]

/**
 * Order lifecycle status.
 */
export const OrderStatus = {
  PENDING: 'PENDING',
  OPEN: 'OPEN',
  PARTIALLY_FILLED: 'PARTIALLY_FILLED',
  FILLED: 'FILLED',
  CANCELLED: 'CANCELLED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
} as const

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus]

/**
 * Time-in-force policy for an order.
 */
export const TimeInForce = {
  GTC: 'GTC',
  IOC: 'IOC',
  FOK: 'FOK',
  GTD: 'GTD',
} as const

export type TimeInForce = (typeof TimeInForce)[keyof typeof TimeInForce]

/**
 * Instruction to buy or sell an instrument.
 * Represents intent before or during execution.
 */
export interface Order {
  /** Unique order identifier. */
  id: string
  /** Owning account identifier. */
  accountId: string
  /** Trading pair or instrument symbol. */
  symbol: string
  /** Buy or sell side. */
  side: OrderSide
  /** Order type (market, limit, etc.). */
  type: OrderType
  /** Requested quantity in base asset units. */
  quantity: number
  /** Limit price (required for limit and stop-limit orders). */
  limitPrice?: number
  /** Trigger price (required for stop and stop-limit orders). */
  stopPrice?: number
  /** Current order status. */
  status: OrderStatus
  /** Time-in-force policy. */
  timeInForce: TimeInForce
  /** Quantity filled so far. */
  filledQuantity: number
  /** Volume-weighted average fill price. */
  averageFillPrice?: number
  /** Submission timestamp (epoch ms). */
  createdAt: number
  /** Last status change timestamp (epoch ms). */
  updatedAt: number
  /** Expiration timestamp for GTD orders (epoch ms). */
  expiresAt?: number
  /** Optional client-supplied correlation id. */
  clientOrderId?: string
}

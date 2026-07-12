/**
 * Direction of an open position.
 */
export const PositionSide = {
  LONG: 'LONG',
  SHORT: 'SHORT',
} as const

export type PositionSide = (typeof PositionSide)[keyof typeof PositionSide]

/**
 * Lifecycle state of a position.
 */
export const PositionStatus = {
  OPEN: 'OPEN',
  CLOSING: 'CLOSING',
  CLOSED: 'CLOSED',
} as const

export type PositionStatus = (typeof PositionStatus)[keyof typeof PositionStatus]

/**
 * An open or recently closed exposure in a single instrument.
 * Tracks entry details and mark-to-market metrics.
 */
export interface Position {
  /** Unique position identifier. */
  id: string
  /** Owning account identifier. */
  accountId: string
  /** Trading pair or instrument symbol. */
  symbol: string
  /** Long or short direction. */
  side: PositionSide
  /** Current lifecycle status. */
  status: PositionStatus
  /** Position size in base asset units. */
  quantity: number
  /** Average entry price. */
  entryPrice: number
  /** Latest mark price used for PnL (optional until priced). */
  markPrice?: number
  /** Unrealized profit and loss at mark price. */
  unrealizedPnl: number
  /** Realized profit and loss accumulated on partial closes. */
  realizedPnl: number
  /** Margin allocated to this position. */
  marginUsed: number
  /** Position open timestamp (epoch ms). */
  openedAt: number
  /** Last update timestamp (epoch ms). */
  updatedAt: number
  /** Close timestamp when status is CLOSED (epoch ms). */
  closedAt?: number
}

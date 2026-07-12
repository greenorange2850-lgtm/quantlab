/**
 * Direction of a completed round-trip trade.
 */
export const TradeSide = {
  LONG: 'LONG',
  SHORT: 'SHORT',
} as const

export type TradeSide = (typeof TradeSide)[keyof typeof TradeSide]

/**
 * A completed trade record linking entry and exit execution.
 * Immutable snapshot used for analytics, reporting, and risk review.
 */
export interface Trade {
  /** Unique trade identifier. */
  id: string
  /** Owning account identifier. */
  accountId: string
  /** Trading pair or instrument symbol. */
  symbol: string
  /** Associated position identifier (if applicable). */
  positionId?: string
  /** Entry order identifier. */
  entryOrderId?: string
  /** Exit order identifier. */
  exitOrderId?: string
  /** Long or short direction. */
  side: TradeSide
  /** Entry fill price. */
  entryPrice: number
  /** Exit fill price. */
  exitPrice: number
  /** Traded quantity in base asset units. */
  quantity: number
  /** Net realized profit and loss after fees. */
  realizedPnl: number
  /** Total commission paid for entry and exit. */
  commission: number
  /** Entry execution timestamp (epoch ms). */
  openedAt: number
  /** Exit execution timestamp (epoch ms). */
  closedAt: number
  /** Holding period duration (epoch ms). */
  duration: number
}

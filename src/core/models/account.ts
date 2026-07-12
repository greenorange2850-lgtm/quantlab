/**
 * Lifecycle state of a trading account.
 */
export const AccountStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  CLOSED: 'CLOSED',
} as const

export type AccountStatus = (typeof AccountStatus)[keyof typeof AccountStatus]

/**
 * Account funding and margin model.
 */
export const AccountType = {
  CASH: 'CASH',
  MARGIN: 'MARGIN',
} as const

export type AccountType = (typeof AccountType)[keyof typeof AccountType]

/**
 * Portfolio account used by the risk and execution layers.
 * Tracks balances and aggregate exposure for a single currency denomination.
 */
export interface Account {
  /** Unique account identifier. */
  id: string
  /** Human-readable label (optional). */
  name?: string
  /** ISO 4217 currency code (e.g. `USD`). */
  currency: string
  /** Account classification (cash or margin). */
  type: AccountType
  /** Current lifecycle status. */
  status: AccountStatus
  /** Settled cash available for new orders. */
  cashBalance: number
  /** Mark-to-market equity (cash + unrealized PnL). */
  equity: number
  /** Buying power available after margin rules. */
  buyingPower: number
  /** Margin currently allocated to open positions. */
  marginUsed: number
  /** Aggregate unrealized profit and loss. */
  unrealizedPnl: number
  /** Cumulative realized profit and loss. */
  realizedPnl: number
  /** Account creation timestamp (epoch ms). */
  createdAt: number
  /** Last balance update timestamp (epoch ms). */
  updatedAt: number
}

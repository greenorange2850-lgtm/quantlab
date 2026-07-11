export const TradeDirection = {
  LONG: 'LONG',
  SHORT: 'SHORT',
} as const

export type TradeDirection = (typeof TradeDirection)[keyof typeof TradeDirection]

export interface Trade {
  id: string
  symbol: string
  entryTime: number
  exitTime: number
  entryPrice: number
  exitPrice: number
  quantity: number
  direction: TradeDirection
  pnl: number
  commission: number
  duration: number
}

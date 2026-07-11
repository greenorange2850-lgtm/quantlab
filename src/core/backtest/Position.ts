import type { TradeDirection } from './Trade.js'

export interface Position {
  symbol: string
  direction: TradeDirection
  quantity: number
  entryPrice: number
  entryTime: number
  entryCommission: number
}

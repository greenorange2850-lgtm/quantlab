import type { Candle } from '../../data/candles.js'

export interface MarketFeedSubscription {
  symbol: string
  timeframe: string
}

export interface MarketFeed {
  readonly id: string
  connect(): Promise<void>
  disconnect(): Promise<void>
  subscribe(subscription: MarketFeedSubscription): void
  unsubscribe(symbol: string): void
  getCurrentBar(symbol: string): Candle | null
  getHistory(symbol: string): readonly Candle[]
}

export function assertConnected(connected: boolean): void {
  if (!connected) {
    throw new Error('feed is not connected')
  }
}

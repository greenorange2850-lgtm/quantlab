import type { Candle } from '../../data/candles.js'
import { CandleStream } from './candle-stream.js'
import type { MarketFeed, MarketFeedSubscription } from './market-feed.js'

/**
 * Live market feed interface for future exchange adapters.
 * Intentionally not connected to any venue yet.
 */
export class LiveFeed implements MarketFeed {
  readonly id: string
  private readonly streams = new Map<string, CandleStream>()
  private connected = false

  constructor(id?: string) {
    this.id = id ?? `live-${Date.now()}`
  }

  async connect(): Promise<void> {
    throw new Error('LiveFeed is not implemented yet')
  }

  async disconnect(): Promise<void> {
    this.connected = false
    this.streams.clear()
  }

  subscribe(subscription: MarketFeedSubscription): void {
    if (!this.streams.has(subscription.symbol)) {
      this.streams.set(subscription.symbol, new CandleStream())
    }
  }

  unsubscribe(symbol: string): void {
    this.streams.delete(symbol)
  }

  getCurrentBar(symbol: string): Candle | null {
    return this.streams.get(symbol)?.getCurrentBar() ?? null
  }

  getHistory(symbol: string): readonly Candle[] {
    return this.streams.get(symbol)?.getHistory() ?? []
  }

  isConnected(): boolean {
    return this.connected
  }
}

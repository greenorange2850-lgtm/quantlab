import type { Candle } from '../../data/candles.js'
import type { MarketDataProvider } from '../../data/providers/MarketDataProvider.js'
import { CandleStream } from './candle-stream.js'
import { MarketEventType, type MarketEventListener } from './events.js'
import { assertConnected, type MarketFeed, type MarketFeedSubscription } from './market-feed.js'

export interface HistoricalLoadParams {
  symbol: string
  timeframe: string
  startDate?: number
  endDate?: number
  limit?: number
}

export interface HistoricalFeedOptions {
  id?: string
}

function filterByDateRange(
  candles: Candle[],
  startDate?: number,
  endDate?: number,
): Candle[] {
  return candles.filter((candle) => {
    if (startDate !== undefined && candle.time < startDate) {
      return false
    }

    if (endDate !== undefined && candle.time > endDate) {
      return false
    }

    return true
  })
}

/**
 * Loads historical candles for backtesting and analytics.
 */
export class HistoricalFeed implements MarketFeed {
  readonly id: string
  private readonly provider: MarketDataProvider
  private readonly streams = new Map<string, CandleStream>()
  private readonly subscriptions = new Map<string, MarketFeedSubscription>()
  private readonly loadedCandles = new Map<string, Candle[]>()
  private connected = false
  private emitEvent: MarketEventListener = () => undefined

  constructor(provider: MarketDataProvider, options: HistoricalFeedOptions = {}) {
    this.provider = provider
    this.id = options.id ?? `historical-${Date.now()}`
  }

  bindEmitter(listener: MarketEventListener): void {
    this.emitEvent = listener
  }

  async connect(): Promise<void> {
    this.connected = true
    for (const subscription of this.subscriptions.values()) {
      this.emitEvent({
        type: MarketEventType.FEED_CONNECTED,
        feedId: this.id,
        symbol: subscription.symbol,
        timestamp: Date.now(),
      })
    }
  }

  async disconnect(): Promise<void> {
    for (const subscription of this.subscriptions.values()) {
      this.emitEvent({
        type: MarketEventType.FEED_DISCONNECTED,
        feedId: this.id,
        symbol: subscription.symbol,
        timestamp: Date.now(),
      })
    }

    this.connected = false
  }

  subscribe(subscription: MarketFeedSubscription): void {
    this.subscriptions.set(subscription.symbol, subscription)
    if (!this.streams.has(subscription.symbol)) {
      this.streams.set(subscription.symbol, new CandleStream())
    }
  }

  unsubscribe(symbol: string): void {
    this.subscriptions.delete(symbol)
    this.streams.delete(symbol)
    this.loadedCandles.delete(symbol)
  }

  getCurrentBar(symbol: string): Candle | null {
    return this.streams.get(symbol)?.getCurrentBar() ?? null
  }

  getHistory(symbol: string): readonly Candle[] {
    const loaded = this.loadedCandles.get(symbol)
    if (loaded) {
      return loaded
    }

    return this.streams.get(symbol)?.getHistory() ?? []
  }

  async loadHistorical(params: HistoricalLoadParams): Promise<Candle[]> {
    assertConnected(this.connected)

    if (!this.subscriptions.has(params.symbol)) {
      throw new Error(`symbol ${params.symbol} is not subscribed`)
    }

    const limit = params.limit ?? 500
    const rawCandles = await this.provider.getCandles({
      symbol: params.symbol,
      interval: params.timeframe,
      limit,
    })

    const candles = filterByDateRange(rawCandles, params.startDate, params.endDate)
    this.loadedCandles.set(params.symbol, candles)

    const stream = this.streams.get(params.symbol)
    stream?.reset()

    for (const candle of candles) {
      stream?.openBar(candle)
      this.emitEvent({
        type: MarketEventType.BAR_CLOSED,
        symbol: params.symbol,
        timeframe: params.timeframe,
        bar: candle,
        timestamp: candle.time,
      })
    }

    return candles
  }
}

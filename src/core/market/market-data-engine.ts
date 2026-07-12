import type { Candle } from '../../data/candles.js'
import type { MarketDataProvider } from '../../data/providers/MarketDataProvider.js'
import type { MarketEvent, MarketEventListener } from './events.js'
import { HistoricalFeed, type HistoricalFeedOptions } from './historical-feed.js'
import { LiveFeed } from './live-feed.js'
import type { MarketFeed } from './market-feed.js'
import { ReplayFeed, type ReplayFeedOptions } from './replay-feed.js'

/**
 * Coordinates market feeds and centralizes event distribution.
 */
export class MarketDataEngine {
  private readonly listeners = new Set<MarketEventListener>()
  private readonly feeds = new Map<string, MarketFeed>()
  private activeFeedId: string | null = null

  subscribe(listener: MarketEventListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  emit(event: MarketEvent): void {
    for (const listener of this.listeners) {
      listener(event)
    }
  }

  getActiveFeed(): MarketFeed | null {
    if (!this.activeFeedId) {
      return null
    }

    return this.feeds.get(this.activeFeedId) ?? null
  }

  getFeed(feedId: string): MarketFeed | null {
    return this.feeds.get(feedId) ?? null
  }

  createHistoricalFeed(
    provider: MarketDataProvider,
    options: HistoricalFeedOptions = {},
  ): HistoricalFeed {
    const feed = new HistoricalFeed(provider, options)
    this.registerFeed(feed, (event) => this.emit(event))
    return feed
  }

  createReplayFeed(options: ReplayFeedOptions): ReplayFeed {
    const feed = new ReplayFeed(options)
    this.registerFeed(feed, (event) => this.emit(event))
    return feed
  }

  createLiveFeed(id?: string): LiveFeed {
    const feed = new LiveFeed(id)
    this.registerFeed(feed, () => undefined)
    return feed
  }

  setActiveFeed(feedId: string): void {
    if (!this.feeds.has(feedId)) {
      throw new Error(`unknown feed id: ${feedId}`)
    }

    this.activeFeedId = feedId
  }

  async loadHistoricalCandles(
    feed: HistoricalFeed,
    params: {
      symbol: string
      timeframe: string
      startDate?: number
      endDate?: number
      limit?: number
    },
  ): Promise<Candle[]> {
    this.setActiveFeed(feed.id)

    if (feed.getHistory(params.symbol).length === 0) {
      feed.subscribe({ symbol: params.symbol, timeframe: params.timeframe })
    }

    await feed.connect()
    return feed.loadHistorical(params)
  }

  private registerFeed(
    feed: MarketFeed & { bindEmitter?: (listener: MarketEventListener) => void },
    listener: MarketEventListener,
  ): void {
    feed.bindEmitter?.(listener)
    this.feeds.set(feed.id, feed)
    this.activeFeedId = feed.id
  }
}

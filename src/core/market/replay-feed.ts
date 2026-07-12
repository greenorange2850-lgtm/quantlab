import type { Candle } from '../../data/candles.js'
import { CandleStream } from './candle-stream.js'
import {
  MarketEventType,
  type MarketEventListener,
  type ReplaySpeed,
} from './events.js'
import { assertConnected, type MarketFeed, type MarketFeedSubscription } from './market-feed.js'

export interface ReplayFeedOptions {
  id?: string
  symbol: string
  timeframe: string
  candles: readonly Candle[]
}

/**
 * Replays historical candles bar-by-bar for trade replay mode.
 */
export class ReplayFeed implements MarketFeed {
  readonly id: string
  private readonly symbol: string
  private readonly timeframe: string
  private readonly candles: readonly Candle[]
  private readonly stream = new CandleStream()
  private connected = false
  private playing = false
  private cursor = -1
  private speed: ReplaySpeed = 1
  private emitEvent: MarketEventListener = () => undefined

  constructor(options: ReplayFeedOptions) {
    this.id = options.id ?? `replay-${Date.now()}`
    this.symbol = options.symbol
    this.timeframe = options.timeframe
    this.candles = [...options.candles]
  }

  bindEmitter(listener: MarketEventListener): void {
    this.emitEvent = listener
  }

  async connect(): Promise<void> {
    this.connected = true
    this.emitEvent({
      type: MarketEventType.FEED_CONNECTED,
      feedId: this.id,
      symbol: this.symbol,
      timestamp: Date.now(),
    })
  }

  async disconnect(): Promise<void> {
    this.pause()
    this.emitEvent({
      type: MarketEventType.FEED_DISCONNECTED,
      feedId: this.id,
      symbol: this.symbol,
      timestamp: Date.now(),
    })
    this.connected = false
  }

  subscribe(subscription: MarketFeedSubscription): void {
    if (subscription.symbol !== this.symbol) {
      throw new Error(`replay feed only supports symbol ${this.symbol}`)
    }
  }

  unsubscribe(symbol: string): void {
    if (symbol === this.symbol) {
      this.pause()
      this.stream.reset()
      this.cursor = -1
    }
  }

  getCurrentBar(symbol: string): Candle | null {
    if (symbol !== this.symbol) {
      return null
    }

    return this.stream.getCurrentBar()
  }

  getHistory(symbol: string): readonly Candle[] {
    if (symbol !== this.symbol) {
      return []
    }

    return this.stream.getHistory()
  }

  play(): void {
    assertConnected(this.connected)

    if (this.cursor >= this.candles.length - 1) {
      return
    }

    this.playing = true
    this.emitEvent({
      type: MarketEventType.REPLAY_STARTED,
      feedId: this.id,
      symbol: this.symbol,
      speed: this.speed,
      timestamp: Date.now(),
    })
  }

  pause(): void {
    if (!this.playing) {
      return
    }

    this.playing = false
    this.emitEvent({
      type: MarketEventType.REPLAY_PAUSED,
      feedId: this.id,
      symbol: this.symbol,
      timestamp: Date.now(),
    })
  }

  step(): Candle | null {
    assertConnected(this.connected)

    const steps = Math.max(1, this.speed)
    let lastBar: Candle | null = null

    for (let index = 0; index < steps; index++) {
      const nextIndex = this.cursor + 1
      if (nextIndex >= this.candles.length) {
        this.pause()
        this.emitEvent({
          type: MarketEventType.REPLAY_FINISHED,
          feedId: this.id,
          symbol: this.symbol,
          timestamp: Date.now(),
        })
        break
      }

      const previous = this.stream.getCurrentBar()
      const bar = this.candles[nextIndex]
      this.cursor = nextIndex

      if (!previous) {
        this.stream.openBar(bar)
        this.emitEvent({
          type: MarketEventType.BAR_OPENED,
          symbol: this.symbol,
          timeframe: this.timeframe,
          bar,
          timestamp: bar.time,
        })
      } else {
        this.emitEvent({
          type: MarketEventType.BAR_CLOSED,
          symbol: this.symbol,
          timeframe: this.timeframe,
          bar: previous,
          timestamp: previous.time,
        })
        this.stream.openBar(bar)
        this.emitEvent({
          type: MarketEventType.BAR_OPENED,
          symbol: this.symbol,
          timeframe: this.timeframe,
          bar,
          timestamp: bar.time,
        })
      }

      this.stream.updateBar(bar)
      this.emitEvent({
        type: MarketEventType.BAR_UPDATED,
        symbol: this.symbol,
        timeframe: this.timeframe,
        bar,
        timestamp: bar.time,
      })

      lastBar = bar
    }

    return lastBar
  }

  seek(index: number): Candle | null {
    assertConnected(this.connected)

    if (index < 0 || index >= this.candles.length) {
      throw new Error('seek index is out of range')
    }

    this.pause()
    this.stream.reset()
    this.cursor = index

    for (let cursor = 0; cursor <= index; cursor++) {
      const bar = this.candles[cursor]
      this.stream.openBar(bar)
      this.emitEvent({
        type: MarketEventType.BAR_CLOSED,
        symbol: this.symbol,
        timeframe: this.timeframe,
        bar,
        timestamp: bar.time,
      })
    }

    return this.stream.getCurrentBar()
  }

  setSpeed(speed: ReplaySpeed): void {
    this.speed = speed
  }

  getSpeed(): ReplaySpeed {
    return this.speed
  }

  isPlaying(): boolean {
    return this.playing
  }

  getCursor(): number {
    return this.cursor
  }
}

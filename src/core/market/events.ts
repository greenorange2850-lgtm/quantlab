import type { Candle } from '../../data/candles.js'

export const MarketEventType = {
  BAR_OPENED: 'BAR_OPENED',
  BAR_UPDATED: 'BAR_UPDATED',
  BAR_CLOSED: 'BAR_CLOSED',
  FEED_CONNECTED: 'FEED_CONNECTED',
  FEED_DISCONNECTED: 'FEED_DISCONNECTED',
  REPLAY_STARTED: 'REPLAY_STARTED',
  REPLAY_PAUSED: 'REPLAY_PAUSED',
  REPLAY_FINISHED: 'REPLAY_FINISHED',
} as const

export type MarketEventType = (typeof MarketEventType)[keyof typeof MarketEventType]

export interface BarOpenedEvent {
  type: typeof MarketEventType.BAR_OPENED
  symbol: string
  timeframe: string
  bar: Candle
  timestamp: number
}

export interface BarUpdatedEvent {
  type: typeof MarketEventType.BAR_UPDATED
  symbol: string
  timeframe: string
  bar: Candle
  timestamp: number
}

export interface BarClosedEvent {
  type: typeof MarketEventType.BAR_CLOSED
  symbol: string
  timeframe: string
  bar: Candle
  timestamp: number
}

export interface FeedConnectedEvent {
  type: typeof MarketEventType.FEED_CONNECTED
  feedId: string
  symbol: string
  timestamp: number
}

export interface FeedDisconnectedEvent {
  type: typeof MarketEventType.FEED_DISCONNECTED
  feedId: string
  symbol: string
  timestamp: number
}

export interface ReplayStartedEvent {
  type: typeof MarketEventType.REPLAY_STARTED
  feedId: string
  symbol: string
  speed: ReplaySpeed
  timestamp: number
}

export interface ReplayPausedEvent {
  type: typeof MarketEventType.REPLAY_PAUSED
  feedId: string
  symbol: string
  timestamp: number
}

export interface ReplayFinishedEvent {
  type: typeof MarketEventType.REPLAY_FINISHED
  feedId: string
  symbol: string
  timestamp: number
}

export type ReplaySpeed = 1 | 2 | 5 | 10

export type MarketEvent =
  | BarOpenedEvent
  | BarUpdatedEvent
  | BarClosedEvent
  | FeedConnectedEvent
  | FeedDisconnectedEvent
  | ReplayStartedEvent
  | ReplayPausedEvent
  | ReplayFinishedEvent

export type MarketEventListener = (event: MarketEvent) => void

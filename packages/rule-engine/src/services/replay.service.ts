import type { MarketEvent, IEventRepository, ICandleProvider } from '../types/index.js'

export interface ReplayFrame {
  event: MarketEvent
  candles: Array<{
    timestamp: string
    open: number
    high: number
    low: number
    close: number
    volume: number
  }>
  contextWindow: number
}

export class ReplayService {
  constructor(
    private readonly eventRepository: IEventRepository,
    private readonly candleProvider: ICandleProvider,
    private readonly contextWindow = 20,
  ) {}

  getEvent(eventId: string): MarketEvent | null {
    return this.eventRepository.getEventById(eventId)
  }

  replay(eventId: string): ReplayFrame | null {
    const event = this.eventRepository.getEventById(eventId)
    if (!event) return null

    const candles = this.candleProvider.getCandles(event.symbol, event.timeframe)
    const eventTime = new Date(event.timestamp).getTime()
    const idx = candles.findIndex((c) => new Date(c.timestamp).getTime() === eventTime)

    const center = idx >= 0 ? idx : (event.candleIndex ?? 0)
    const start = Math.max(0, center - this.contextWindow)
    const end = Math.min(candles.length, center + this.contextWindow + 1)

    return {
      event,
      candles: candles.slice(start, end),
      contextWindow: this.contextWindow,
    }
  }

  replayRange(params: {
    symbol: string
    timeframe: string
    start?: string
    end?: string
    ruleName?: string
    limit?: number
  }): ReplayFrame[] {
    const events = this.eventRepository.getEvents(params)
    return events
      .map((e) => this.replay(e.id))
      .filter((f): f is ReplayFrame => f !== null)
  }
}

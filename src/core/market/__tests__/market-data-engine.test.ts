import { describe, expect, it } from 'vitest'
import { MockMarketDataProvider } from '../../../data/providers/MockMarketDataProvider.js'
import { MarketEventType } from '../events.js'
import type { MarketEvent } from '../events.js'
import { HistoricalFeed } from '../historical-feed.js'
import { MarketDataEngine } from '../market-data-engine.js'
import { ReplayFeed } from '../replay-feed.js'

const SYMBOL = 'BTCUSDT'
const TIMEFRAME = '1h'

function buildCandles(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    time: 1_700_000_000_000 + index * 3_600_000,
    open: 100 + index,
    high: 101 + index,
    low: 99 + index,
    close: 100.5 + index,
    volume: 100 + index,
  }))
}

describe('HistoricalFeed', () => {
  it('loads historical candles for a subscribed symbol', async () => {
    const feed = new HistoricalFeed(new MockMarketDataProvider({ seed: 3, basePrice: 100 }))
    feed.subscribe({ symbol: SYMBOL, timeframe: TIMEFRAME })
    await feed.connect()

    const candles = await feed.loadHistorical({
      symbol: SYMBOL,
      timeframe: TIMEFRAME,
      limit: 10,
    })

    expect(candles).toHaveLength(10)
    expect(feed.getHistory(SYMBOL)).toHaveLength(10)
    await feed.disconnect()
  })

  it('filters candles by start and end date', async () => {
    const provider = new MockMarketDataProvider({ seed: 4, basePrice: 100, startTime: 1_000 })
    const feed = new HistoricalFeed(provider)
    feed.subscribe({ symbol: SYMBOL, timeframe: TIMEFRAME })
    await feed.connect()

    const candles = await feed.loadHistorical({
      symbol: SYMBOL,
      timeframe: TIMEFRAME,
      limit: 5,
      startDate: 1_000 + 3_600_000,
      endDate: 1_000 + 3 * 3_600_000,
    })

    expect(candles).toHaveLength(3)
    expect(candles[0]?.time).toBe(1_000 + 3_600_000)
    expect(candles.at(-1)?.time).toBe(1_000 + 3 * 3_600_000)
  })

  it('propagates calendar start/end into the provider fetch (not limit-only)', async () => {
    const calls: unknown[] = []
    const provider = {
      getCandles: async (params: unknown) => {
        calls.push(params)
        return [
          {
            time: 2_000,
            open: 1,
            high: 1,
            low: 1,
            close: 1,
            volume: 1,
          },
          {
            time: 5_000,
            open: 1,
            high: 1,
            low: 1,
            close: 1,
            volume: 1,
          },
        ]
      },
    }
    const feed = new HistoricalFeed(provider)
    feed.subscribe({ symbol: SYMBOL, timeframe: '15m' })
    await feed.connect()

    await feed.loadHistorical({
      symbol: SYMBOL,
      timeframe: '15m',
      limit: 1000,
      startDate: 2_000,
      endDate: 5_000,
    })

    expect(calls).toEqual([
      {
        symbol: SYMBOL,
        interval: '15m',
        limit: 1000,
        startTime: 2_000,
        endTime: 5_000,
      },
    ])
    await feed.disconnect()
  })
})

describe('ReplayFeed', () => {
  const candles = buildCandles(5)

  it('steps through candles and emits bar events', async () => {
    const events: MarketEvent[] = []
    const feed = new ReplayFeed({ symbol: SYMBOL, timeframe: TIMEFRAME, candles })
    feed.bindEmitter((event) => events.push(event))
    feed.subscribe({ symbol: SYMBOL, timeframe: TIMEFRAME })
    await feed.connect()

    feed.play()
    const bar = feed.step()

    expect(bar).not.toBeNull()
    expect(feed.getCursor()).toBe(0)
    expect(events.some((event) => event.type === MarketEventType.BAR_OPENED)).toBe(true)
    expect(events.some((event) => event.type === MarketEventType.BAR_UPDATED)).toBe(true)
  })

  it('pauses and resumes replay', async () => {
    const events: MarketEvent[] = []
    const feed = new ReplayFeed({ symbol: SYMBOL, timeframe: TIMEFRAME, candles })
    feed.bindEmitter((event) => events.push(event))
    feed.subscribe({ symbol: SYMBOL, timeframe: TIMEFRAME })
    await feed.connect()

    feed.play()
    feed.step()
    feed.pause()

    expect(feed.isPlaying()).toBe(false)
    expect(events.some((event) => event.type === MarketEventType.REPLAY_PAUSED)).toBe(true)

    feed.play()
    feed.step()
    expect(feed.getCursor()).toBe(1)
  })

  it('seeks to a specific bar index', async () => {
    const feed = new ReplayFeed({ symbol: SYMBOL, timeframe: TIMEFRAME, candles })
    feed.subscribe({ symbol: SYMBOL, timeframe: TIMEFRAME })
    await feed.connect()

    const bar = feed.seek(2)

    expect(bar?.time).toBe(candles[2].time)
    expect(feed.getHistory(SYMBOL)).toHaveLength(3)
  })

  it('changes replay speed', () => {
    const feed = new ReplayFeed({ symbol: SYMBOL, timeframe: TIMEFRAME, candles })

    feed.setSpeed(5)
    expect(feed.getSpeed()).toBe(5)
  })

  it('finishes replay at the end of the series', async () => {
    const events: MarketEvent[] = []
    const feed = new ReplayFeed({ symbol: SYMBOL, timeframe: TIMEFRAME, candles })
    feed.bindEmitter((event) => events.push(event))
    feed.subscribe({ symbol: SYMBOL, timeframe: TIMEFRAME })
    await feed.connect()

    feed.setSpeed(10)
    feed.play()
    feed.step()

    expect(events.at(-1)?.type).toBe(MarketEventType.REPLAY_FINISHED)
    expect(feed.getCursor()).toBe(candles.length - 1)
  })
})

describe('MarketDataEngine', () => {
  it('coordinates feeds and preserves event ordering', async () => {
    const engine = new MarketDataEngine()
    const events: MarketEvent[] = []
    engine.subscribe((event) => events.push(event))

    const feed = engine.createHistoricalFeed(new MockMarketDataProvider({ seed: 8 }))
    feed.subscribe({ symbol: SYMBOL, timeframe: TIMEFRAME })

    await engine.loadHistoricalCandles(feed, {
      symbol: SYMBOL,
      timeframe: TIMEFRAME,
      limit: 3,
    })

    expect(events[0]?.type).toBe(MarketEventType.FEED_CONNECTED)
    expect(events.filter((event) => event.type === MarketEventType.BAR_CLOSED)).toHaveLength(3)
    expect(engine.getActiveFeed()?.id).toBe(feed.id)
  })
})

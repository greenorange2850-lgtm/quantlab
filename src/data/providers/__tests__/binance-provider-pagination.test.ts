import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { BinanceProvider, BINANCE_MARKET_DATA_BASE_URL } from '../BinanceProvider'
import type { BinanceKlineRaw } from '../../candles'
import { BINANCE_KLINES_PAGE_LIMIT } from '../../research-period'

function kline(time: number, close = '100'): BinanceKlineRaw {
  return [
    time,
    '100',
    '101',
    '99',
    close,
    '10',
    time + 899_999,
    '1000',
    5,
    '5',
    '500',
    '0',
  ]
}

function page(times: number[]): BinanceKlineRaw[] {
  return times.map((time) => kline(time))
}

describe('BinanceProvider calendar-range pagination', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('fetches multiple pages, merges chronologically, and deduplicates', async () => {
    const start = 1_000
    const step = 900_000
    const firstPageTimes = Array.from({ length: BINANCE_KLINES_PAGE_LIMIT }, (_, i) => start + i * step)
    const secondPageTimes = [
      firstPageTimes[firstPageTimes.length - 1]!, // duplicate overlap
      ...Array.from({ length: 50 }, (_, i) => start + (BINANCE_KLINES_PAGE_LIMIT + i) * step),
    ]
    const end = secondPageTimes[secondPageTimes.length - 1]!

    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify(page(firstPageTimes)), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(page(secondPageTimes)), { status: 200 }))

    const provider = new BinanceProvider(BINANCE_MARKET_DATA_BASE_URL)
    const candles = await provider.getCandles({
      symbol: 'BTCUSDT',
      interval: '15m',
      limit: BINANCE_KLINES_PAGE_LIMIT,
      startTime: start,
      endTime: end,
    })

    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(2)
    expect(candles).toHaveLength(BINANCE_KLINES_PAGE_LIMIT + 50)
    expect(candles[0]?.time).toBe(start)
    expect(candles.at(-1)?.time).toBe(end)
    // Strictly increasing — no duplicate open times.
    for (let i = 1; i < candles.length; i++) {
      expect(candles[i]!.time).toBeGreaterThan(candles[i - 1]!.time)
    }

    const firstUrl = String(vi.mocked(globalThis.fetch).mock.calls[0]![0])
    expect(firstUrl).toContain(`startTime=${start}`)
    expect(firstUrl).toContain(`endTime=${end}`)
    expect(firstUrl).toContain(`limit=${BINANCE_KLINES_PAGE_LIMIT}`)
  })

  it('clips exactly to startTime/endTime and does not silently return latest-N', async () => {
    const start = 10_000
    const end = 10_000 + 3 * 900_000
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(
        JSON.stringify(
          page([
            start - 900_000,
            start,
            start + 900_000,
            start + 1_800_000,
            start + 2_700_000,
            end + 900_000,
          ]),
        ),
        { status: 200 },
      ),
    )

    const provider = new BinanceProvider()
    const candles = await provider.getCandles({
      symbol: 'BTCUSDT',
      interval: '15m',
      limit: 1000,
      startTime: start,
      endTime: end,
    })

    expect(candles.map((c) => c.time)).toEqual([
      start,
      start + 900_000,
      start + 1_800_000,
      start + 2_700_000,
    ])
    expect(candles.every((c) => c.time >= start && c.time <= end)).toBe(true)
  })

  it('propagates API failures without inventing candles', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response('nope', { status: 500, statusText: 'Server Error' }),
    )

    const provider = new BinanceProvider()
    await expect(
      provider.getCandles({
        symbol: 'BTCUSDT',
        interval: '15m',
        limit: 1000,
        startTime: 1,
        endTime: 2,
      }),
    ).rejects.toThrow(/Binance API error: 500/)
  })

  it('refuses to silently truncate when the period exceeds the safety ceiling', async () => {
    // One huge page that already exceeds maxCandles after merge.
    const times = Array.from({ length: 5 }, (_, i) => 1_000 + i * 60_000)
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify(page(times)), { status: 200 }),
    )

    const provider = new BinanceProvider()
    await expect(
      provider.getCandles({
        symbol: 'BTCUSDT',
        interval: '1m',
        limit: 1000,
        startTime: 1_000,
        endTime: 1_000 + 4 * 60_000,
        maxCandles: 3,
      }),
    ).rejects.toThrow(/more than 3 candles/i)
  })

  it('keeps legacy limit-only fetches as a single latest-N request', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify(page([1, 2, 3])), { status: 200 }),
    )

    const provider = new BinanceProvider()
    const candles = await provider.getCandles({
      symbol: 'BTCUSDT',
      interval: '1h',
      limit: 3,
    })

    expect(candles).toHaveLength(3)
    const url = String(vi.mocked(globalThis.fetch).mock.calls[0]![0])
    expect(url).not.toContain('startTime=')
    expect(url).not.toContain('endTime=')
    expect(url).toContain('limit=3')
  })
})

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { binanceMarketKeys } from '@/api/queries/binance-market'
import { BinanceProvider, BINANCE_MARKET_DATA_BASE_URL } from '@/data/providers/BinanceProvider'
import type { BinanceKlineRaw } from '@/data/candles'

const sampleKline: BinanceKlineRaw = [
  1704067200000,
  '42283.58000000',
  '42554.57000000',
  '42261.02000000',
  '42475.23000000',
  '1234.56789000',
  1704070799999,
  '52345678.90123456',
  15234,
  '678.90123400',
  '28765432.10987654',
  '0',
]

describe('binanceMarketKeys', () => {
  it('changes kline query key when symbol or timeframe changes', () => {
    const a = binanceMarketKeys.klines('BTCUSDT', '1h', 500)
    const b = binanceMarketKeys.klines('ETHUSDT', '1h', 500)
    const c = binanceMarketKeys.klines('BTCUSDT', '4h', 500)
    const d = binanceMarketKeys.klines('BTCUSDT', '1h', 200)

    expect(a).not.toEqual(b)
    expect(a).not.toEqual(c)
    expect(a).not.toEqual(d)
    expect(a).toEqual(['binance-market', 'klines', 'BTCUSDT', '1h', 500])
  })
})

describe('BinanceProvider kline mapping', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('maps klines into the canonical Candle type', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify([sampleKline]), { status: 200 }),
    )

    const provider = new BinanceProvider(BINANCE_MARKET_DATA_BASE_URL)
    const candles = await provider.getCandles({
      symbol: 'BTCUSDT',
      interval: '1h',
      limit: 1,
    })

    expect(candles).toEqual([
      {
        time: 1704067200000,
        open: 42283.58,
        high: 42554.57,
        low: 42261.02,
        close: 42475.23,
        volume: 1234.56789,
      },
    ])

    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
      expect.stringContaining(`${BINANCE_MARKET_DATA_BASE_URL}/api/v3/klines?`),
      expect.objectContaining({ signal: undefined }),
    )
  })

  it('forwards AbortSignal and does not invent candles on failure', async () => {
    const controller = new AbortController()
    controller.abort()

    vi.mocked(globalThis.fetch).mockImplementation((_url, init) => {
      const signal = init?.signal
      if (signal?.aborted) {
        return Promise.reject(new DOMException('Aborted', 'AbortError'))
      }
      return Promise.resolve(new Response('[]', { status: 200 }))
    })

    const provider = new BinanceProvider()
    await expect(
      provider.getCandles({
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 10,
        signal: controller.signal,
      }),
    ).rejects.toThrow()
  })
})

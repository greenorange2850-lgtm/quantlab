import { describe, expect, it } from 'vitest'
import { parseBinanceKlinesResponse } from '../binance.js'
import type { BinanceKlineRaw } from '../candles.js'

const samplePayload: BinanceKlineRaw[] = [
  [
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
  ],
]

describe('parseBinanceKlinesResponse', () => {
  it('parses a valid Binance klines payload', () => {
    const candles = parseBinanceKlinesResponse(samplePayload)

    expect(candles).toHaveLength(1)
    expect(candles[0]).toEqual({
      time: 1704067200000,
      open: 42283.58,
      high: 42554.57,
      low: 42261.02,
      close: 42475.23,
      volume: 1234.56789,
    })
  })

  it('throws on invalid payload shape', () => {
    expect(() => parseBinanceKlinesResponse(null)).toThrow(
      'Invalid Binance klines response: expected an array',
    )
    expect(() => parseBinanceKlinesResponse([['bad', '1', '2', '3', '4', '5']])).toThrow(
      'Invalid Binance kline field "open time"',
    )
  })

  it('throws on empty payload', () => {
    expect(() => parseBinanceKlinesResponse([])).toThrow('Binance API returned no candle data')
  })
})

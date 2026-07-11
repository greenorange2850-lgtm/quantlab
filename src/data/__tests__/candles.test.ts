import { describe, expect, it } from 'vitest'
import {
  extractClosePrices,
  normalizeBinanceKline,
  normalizeBinanceKlines,
  type BinanceKlineRaw,
} from '../candles.js'

const sampleKline: BinanceKlineRaw = [
  1499040000000,
  '0.01634790',
  '0.80000000',
  '0.01575800',
  '0.01577100',
  '148976.11427815',
  1499644799999,
  '2434.19055334',
  308,
  '1756.87402397',
  '28.46694368',
  '17928899.62484339',
]

const samplePayload: BinanceKlineRaw[] = [
  sampleKline,
  [
    1499644800000,
    '0.01577100',
    '0.01577101',
    '0.01576403',
    '0.01576403',
    '38.26707327',
    1499731199999,
    '0.60374445',
    14,
    '9.58264634',
    '0.15118565',
    '0',
  ],
]

describe('normalizeBinanceKline', () => {
  it('converts a Binance kline tuple into a Candle', () => {
    const candle = normalizeBinanceKline(sampleKline)

    expect(candle).toEqual({
      time: 1499040000000,
      open: 0.0163479,
      high: 0.8,
      low: 0.015758,
      close: 0.015771,
      volume: 148976.11427815,
    })
  })

  it('throws on malformed kline arrays', () => {
    expect(() => normalizeBinanceKline(['not-a-number', '1', '2', '3', '4', '5'])).toThrow(
      'Invalid Binance kline field "open time"',
    )
    expect(() => normalizeBinanceKline([1, 2, 3])).toThrow(
      'Invalid Binance kline: expected an array with at least 6 elements',
    )
  })
})

describe('normalizeBinanceKlines', () => {
  it('normalizes an array of klines', () => {
    const candles = normalizeBinanceKlines(samplePayload)

    expect(candles).toHaveLength(2)
    expect(candles[0].close).toBe(0.015771)
    expect(candles[1].time).toBe(1499644800000)
  })

  it('throws when response is not an array', () => {
    expect(() => normalizeBinanceKlines({})).toThrow(
      'Invalid Binance klines response: expected an array',
    )
  })

  it('throws on empty response', () => {
    expect(() => normalizeBinanceKlines([])).toThrow('Binance API returned no candle data')
  })
})

describe('extractClosePrices', () => {
  it('returns close prices from candles', () => {
    const candles = normalizeBinanceKlines(samplePayload)
    expect(extractClosePrices(candles)).toEqual([0.015771, 0.01576403])
  })
})

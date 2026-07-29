import { describe, expect, it } from 'vitest'
import {
  DEFAULT_BINANCE_QUOTE,
  filterTradingPairs,
  getSymbolSelectViewState,
  mapExchangeInfoToTradingPairs,
  type BinanceTradingPair,
} from '../binance-exchange-info.js'

const sampleExchangeInfo = {
  symbols: [
    {
      symbol: 'BTCUSDT',
      status: 'TRADING',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      isSpotTradingAllowed: true,
    },
    {
      symbol: 'ETHUSDT',
      status: 'TRADING',
      baseAsset: 'ETH',
      quoteAsset: 'USDT',
      isSpotTradingAllowed: true,
    },
    {
      symbol: 'ETHBTC',
      status: 'TRADING',
      baseAsset: 'ETH',
      quoteAsset: 'BTC',
      isSpotTradingAllowed: true,
    },
    {
      symbol: 'SOLUSDC',
      status: 'TRADING',
      baseAsset: 'SOL',
      quoteAsset: 'USDC',
      isSpotTradingAllowed: true,
    },
    {
      symbol: 'XRPBNB',
      status: 'TRADING',
      baseAsset: 'XRP',
      quoteAsset: 'BNB',
      isSpotTradingAllowed: true,
    },
    {
      symbol: 'ADAUSDT',
      status: 'BREAK',
      baseAsset: 'ADA',
      quoteAsset: 'USDT',
      isSpotTradingAllowed: true,
    },
    {
      symbol: 'DOGEUSDT',
      status: 'TRADING',
      baseAsset: 'DOGE',
      quoteAsset: 'USDT',
      isSpotTradingAllowed: false,
      permissions: [],
    },
    {
      symbol: 'LINKUSDT',
      status: 'TRADING',
      baseAsset: 'LINK',
      quoteAsset: 'USDT',
      isSpotTradingAllowed: false,
      permissions: ['SPOT'],
    },
  ],
}

describe('mapExchangeInfoToTradingPairs', () => {
  it('keeps trading spot pairs with allowed quote assets', () => {
    const pairs = mapExchangeInfoToTradingPairs(sampleExchangeInfo)
    const symbols = pairs.map((pair) => pair.symbol)

    expect(symbols).toEqual(['BTCUSDT', 'ETHBTC', 'ETHUSDT', 'LINKUSDT', 'SOLUSDC'])
    expect(pairs.find((pair) => pair.symbol === 'BTCUSDT')).toMatchObject({
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      label: 'BTC / USDT',
    })
  })

  it('rejects invalid payloads', () => {
    expect(() => mapExchangeInfoToTradingPairs(null)).toThrow('expected an object')
    expect(() => mapExchangeInfoToTradingPairs({})).toThrow('expected symbols array')
  })
})

describe('filterTradingPairs', () => {
  const pairs: BinanceTradingPair[] = mapExchangeInfoToTradingPairs(sampleExchangeInfo)

  it('defaults to the selected quote asset', () => {
    const usdt = filterTradingPairs(pairs, { quoteAsset: DEFAULT_BINANCE_QUOTE })
    expect(usdt.every((pair) => pair.quoteAsset === 'USDT')).toBe(true)
    expect(usdt.map((pair) => pair.symbol)).toEqual(['BTCUSDT', 'ETHUSDT', 'LINKUSDT'])
  })

  it('searches by symbol or base asset', () => {
    expect(
      filterTradingPairs(pairs, { quoteAsset: 'USDT', search: 'eth' }).map((pair) => pair.symbol),
    ).toEqual(['ETHUSDT'])

    expect(
      filterTradingPairs(pairs, { quoteAsset: 'BTC', search: 'ETHBTC' }).map((pair) => pair.symbol),
    ).toEqual(['ETHBTC'])
  })
})

describe('getSymbolSelectViewState', () => {
  it('maps loading, error, empty, and ready states', () => {
    expect(getSymbolSelectViewState({ isLoading: true, isError: false, filteredCount: 0 })).toBe(
      'loading',
    )
    expect(getSymbolSelectViewState({ isLoading: false, isError: true, filteredCount: 0 })).toBe(
      'error',
    )
    expect(getSymbolSelectViewState({ isLoading: false, isError: false, filteredCount: 0 })).toBe(
      'empty',
    )
    expect(getSymbolSelectViewState({ isLoading: false, isError: false, filteredCount: 3 })).toBe(
      'ready',
    )
  })
})

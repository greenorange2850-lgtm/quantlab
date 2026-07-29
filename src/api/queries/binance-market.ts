import { useQuery } from '@tanstack/react-query'
import {
  DEFAULT_BINANCE_QUOTE,
  fetchBinanceExchangeInfo,
  filterTradingPairs,
  mapExchangeInfoToTradingPairs,
  type BinanceQuoteAsset,
  type BinanceTradingPair,
} from '@/data/binance-exchange-info'
import {
  BINANCE_MARKET_DATA_BASE_URL,
  BinanceProvider,
} from '@/data/providers/BinanceProvider'
import type { Candle } from '@/data/candles'
import type { CandleInterval } from '@/data/providers/MarketDataProvider'

const EXCHANGE_INFO_STALE_MS = 30 * 60 * 1000

const binanceProvider = new BinanceProvider(BINANCE_MARKET_DATA_BASE_URL)

export const binanceMarketKeys = {
  all: ['binance-market'] as const,
  exchangeInfo: () => [...binanceMarketKeys.all, 'exchangeInfo'] as const,
  tradingPairs: () => [...binanceMarketKeys.all, 'tradingPairs'] as const,
  klines: (symbol: string, interval: string, limit: number) =>
    [...binanceMarketKeys.all, 'klines', symbol, interval, limit] as const,
}

async function loadTradingPairs(signal?: AbortSignal): Promise<BinanceTradingPair[]> {
  const raw = await fetchBinanceExchangeInfo(BINANCE_MARKET_DATA_BASE_URL, signal)
  return mapExchangeInfoToTradingPairs(raw)
}

export function useBinanceTradingPairs() {
  return useQuery({
    queryKey: binanceMarketKeys.tradingPairs(),
    queryFn: ({ signal }) => loadTradingPairs(signal),
    staleTime: EXCHANGE_INFO_STALE_MS,
    gcTime: EXCHANGE_INFO_STALE_MS * 2,
    retry: 2,
  })
}

export function useFilteredBinanceTradingPairs(
  quoteAsset: BinanceQuoteAsset = DEFAULT_BINANCE_QUOTE,
  search = '',
) {
  const query = useBinanceTradingPairs()
  const filtered = filterTradingPairs(query.data ?? [], { quoteAsset, search })

  return {
    ...query,
    pairs: query.data ?? [],
    filtered,
  }
}

export function useBinanceKlines(
  symbol: string | null,
  interval: CandleInterval | string | null,
  limit: number,
) {
  const enabled = Boolean(symbol?.trim() && interval?.trim() && Number.isInteger(limit) && limit > 0)

  return useQuery({
    queryKey: binanceMarketKeys.klines(symbol ?? '', interval ?? '', limit),
    queryFn: ({ signal }): Promise<Candle[]> =>
      binanceProvider.getCandles({
        symbol: symbol!,
        interval: interval as CandleInterval,
        limit,
        signal,
      }),
    enabled,
    staleTime: 60_000,
    retry: 1,
    // Abort in-flight request when key changes (TanStack Query cancels via signal).
    refetchOnWindowFocus: false,
  })
}

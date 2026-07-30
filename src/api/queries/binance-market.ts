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
import { BINANCE_KLINES_PAGE_LIMIT } from '@/data/research-period'

const EXCHANGE_INFO_STALE_MS = 30 * 60 * 1000

const binanceProvider = new BinanceProvider(BINANCE_MARKET_DATA_BASE_URL)

export interface BinanceKlinesQueryParams {
  symbol: string
  interval: string
  /** Inclusive start (ms). Pair with endTime for calendar-range fetch. */
  startTime?: number
  /** Inclusive end (ms). Pair with startTime for calendar-range fetch. */
  endTime?: number
  /**
   * Legacy latest-N fetch size when start/end are omitted.
   * Also used as per-request page size for ranged fetches (≤1000).
   */
  limit?: number
}

export const binanceMarketKeys = {
  all: ['binance-market'] as const,
  exchangeInfo: () => [...binanceMarketKeys.all, 'exchangeInfo'] as const,
  tradingPairs: () => [...binanceMarketKeys.all, 'tradingPairs'] as const,
  klines: (
    symbol: string,
    interval: string,
    startTime: number | null,
    endTime: number | null,
    limit: number,
  ) =>
    [...binanceMarketKeys.all, 'klines', symbol, interval, startTime, endTime, limit] as const,
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

/**
 * Load Binance klines for Strategy Lab / Optimizer.
 * Prefer calendar start/end — provider paginates; never silently falls back to latest 500.
 */
export function useBinanceKlines(
  symbol: string | null,
  interval: CandleInterval | string | null,
  range: {
    startTime: number | null
    endTime: number | null
    /** Legacy limit-only mode when start/end are null. */
    limit?: number
  },
) {
  const startTime = range.startTime
  const endTime = range.endTime
  const hasRange =
    startTime !== null &&
    endTime !== null &&
    Number.isFinite(startTime) &&
    Number.isFinite(endTime)
  const legacyLimit = range.limit ?? 500
  const pageLimit = BINANCE_KLINES_PAGE_LIMIT

  const enabled =
    Boolean(symbol?.trim() && interval?.trim()) &&
    (hasRange || (Number.isInteger(legacyLimit) && legacyLimit > 0))

  return useQuery({
    queryKey: binanceMarketKeys.klines(
      symbol ?? '',
      interval ?? '',
      hasRange ? startTime : null,
      hasRange ? endTime : null,
      hasRange ? pageLimit : legacyLimit,
    ),
    queryFn: ({ signal }): Promise<Candle[]> => {
      if (hasRange) {
        return binanceProvider.getCandles({
          symbol: symbol!,
          interval: interval as CandleInterval,
          limit: pageLimit,
          startTime: startTime!,
          endTime: endTime!,
          signal,
        })
      }
      return binanceProvider.getCandles({
        symbol: symbol!,
        interval: interval as CandleInterval,
        limit: legacyLimit,
        signal,
      })
    },
    enabled,
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  })
}

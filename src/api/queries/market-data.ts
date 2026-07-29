import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  Candle,
  CandleStats,
  ImportMarketDataResult,
  ImportSource,
  Symbol,
  Timeframe,
} from '@trading-os/shared'
import { api } from '../client.js'
import { getApiBaseUrl } from '../base-url.js'

export const marketDataKeys = {
  symbols: ['market-data', 'symbols'] as const,
  timeframes: ['market-data', 'timeframes'] as const,
  stats: (symbolId: string, timeframeId: string) =>
    ['market-data', 'stats', symbolId, timeframeId] as const,
  candles: (symbolId: string, timeframeId: string) =>
    ['market-data', 'candles', symbolId, timeframeId] as const,
}

export function useSymbols() {
  return useQuery({
    queryKey: marketDataKeys.symbols,
    queryFn: () => api.get<Symbol[]>('/market-data/symbols'),
  })
}

export function useTimeframes() {
  return useQuery({
    queryKey: marketDataKeys.timeframes,
    queryFn: () => api.get<Timeframe[]>('/market-data/timeframes'),
  })
}

export function useCandleStats(symbolId: string | null, timeframeId: string | null) {
  return useQuery({
    queryKey: marketDataKeys.stats(symbolId ?? '', timeframeId ?? ''),
    queryFn: () =>
      api.get<CandleStats>(`/market-data/stats?symbolId=${symbolId}&timeframeId=${timeframeId}`),
    enabled: !!symbolId && !!timeframeId,
  })
}

export function useCandles(symbolId: string | null, timeframeId: string | null, limit = 200) {
  return useQuery({
    queryKey: [...marketDataKeys.candles(symbolId ?? '', timeframeId ?? ''), limit],
    queryFn: () =>
      api.get<Candle[]>(
        `/market-data/candles?symbolId=${symbolId}&timeframeId=${timeframeId}&limit=${limit}`,
      ),
    enabled: !!symbolId && !!timeframeId,
  })
}

export function useImportMarketData() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      file,
      source,
      symbolId,
      timeframeId,
    }: {
      file: File
      source: ImportSource
      symbolId: string
      timeframeId: string
    }) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('source', source)
      formData.append('symbolId', symbolId)
      formData.append('timeframeId', timeframeId)

      const baseUrl = getApiBaseUrl()
      const response = await fetch(`${baseUrl}/market-data/import`, {
        method: 'POST',
        body: formData,
      })

      const body = await response.json()
      if (!response.ok || !body.success) {
        throw new Error(body.error?.message ?? 'Import failed')
      }
      return body.data as ImportMarketDataResult
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: marketDataKeys.stats(variables.symbolId, variables.timeframeId) })
      queryClient.invalidateQueries({ queryKey: marketDataKeys.candles(variables.symbolId, variables.timeframeId) })
    },
  })
}

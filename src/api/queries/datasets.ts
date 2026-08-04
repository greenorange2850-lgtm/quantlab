import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LocalDatasetProvider } from '@/data/datasets/LocalDatasetProvider'
import {
  getDatasetLibrary,
  type DatasetMetadata,
  type DatasetMetadataExport,
  type ImportDatasetInput,
} from '@/data/datasets'
import type { Candle } from '@/data/candles'
import type { CandleInterval } from '@/data/providers/MarketDataProvider'
import { BINANCE_KLINES_PAGE_LIMIT } from '@/data/research-period'

export const datasetKeys = {
  all: ['dataset-library'] as const,
  list: () => [...datasetKeys.all, 'list'] as const,
  detail: (id: string) => [...datasetKeys.all, 'detail', id] as const,
  candles: (
    id: string,
    interval: string,
    startTime: number | null,
    endTime: number | null,
    limit: number,
  ) =>
    [...datasetKeys.all, 'candles', id, interval, startTime, endTime, limit] as const,
}

export function useDatasetList() {
  return useQuery({
    queryKey: datasetKeys.list(),
    queryFn: () => getDatasetLibrary().list(),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
}

export function useDataset(id: string | null) {
  return useQuery({
    queryKey: datasetKeys.detail(id ?? ''),
    queryFn: () => getDatasetLibrary().get(id!),
    enabled: Boolean(id),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
}

/**
 * Load candles for research via LocalDatasetProvider.
 * Only the selected timeframe is read from IndexedDB.
 */
export function useLocalDatasetCandles(
  datasetId: string | null,
  interval: CandleInterval | string | null,
  range: {
    startTime: number | null
    endTime: number | null
    limit?: number
    /** Symbol from dataset metadata — validated by provider. */
    symbol?: string | null
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
  const symbol = range.symbol ?? ''

  const enabled =
    Boolean(datasetId?.trim() && interval?.trim()) &&
    (hasRange || (Number.isInteger(legacyLimit) && legacyLimit > 0))

  return useQuery({
    queryKey: datasetKeys.candles(
      datasetId ?? '',
      interval ?? '',
      hasRange ? startTime : null,
      hasRange ? endTime : null,
      hasRange ? pageLimit : legacyLimit,
    ),
    queryFn: ({ signal }): Promise<Candle[]> => {
      const provider = new LocalDatasetProvider({ datasetId: datasetId! })
      if (hasRange) {
        return provider.getCandles({
          symbol: symbol || 'LOCAL',
          interval: interval as CandleInterval,
          limit: pageLimit,
          startTime: startTime!,
          endTime: endTime!,
          signal,
        })
      }
      return provider.getCandles({
        symbol: symbol || 'LOCAL',
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

export function useImportDataset() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ImportDatasetInput) => getDatasetLibrary().importDataset(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: datasetKeys.all })
    },
  })
}

export function useRenameDataset() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      getDatasetLibrary().rename(id, name),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: datasetKeys.all })
    },
  })
}

export function useDeleteDataset() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => getDatasetLibrary().delete(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: datasetKeys.all })
    },
  })
}

export function useRefreshDatasetMetadata() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => getDatasetLibrary().refreshMetadata(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: datasetKeys.all })
    },
  })
}

export function useExportDatasetMetadata() {
  return useMutation({
    mutationFn: async (id: string): Promise<DatasetMetadataExport> =>
      getDatasetLibrary().exportMetadata(id),
  })
}

export type { DatasetMetadata }

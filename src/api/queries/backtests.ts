import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { BacktestSummary, CreateBacktestRequest } from '@trading-os/shared'
import { api } from '../client'
import { useBacktestStore } from '@/stores/backtest.store'

export const backtestKeys = {
  all: ['backtests'] as const,
}

export async function fetchBacktestHistory(): Promise<BacktestSummary[]> {
  return api.get<BacktestSummary[]>('/backtests')
}

export async function persistBacktestSummary(
  request: CreateBacktestRequest,
): Promise<BacktestSummary> {
  return api.post<BacktestSummary>('/backtests', request)
}

/** Load server-backed backtest history into the dashboard store. */
export function useBacktestHistory() {
  const hydrateRecentBacktests = useBacktestStore((state) => state.hydrateRecentBacktests)

  return useQuery({
    queryKey: backtestKeys.all,
    queryFn: async () => {
      const items = await fetchBacktestHistory()
      hydrateRecentBacktests(items)
      return items
    },
  })
}

export function usePersistBacktest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: persistBacktestSummary,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: backtestKeys.all })
    },
  })
}

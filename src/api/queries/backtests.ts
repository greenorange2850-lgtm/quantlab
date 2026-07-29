import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Backtest, BacktestSummary, CreateBacktestRequest } from '@trading-os/shared'
import { api } from '../client'
import { useBacktestStore } from '@/stores/backtest.store'

export const backtestKeys = {
  all: ['backtests'] as const,
  detail: (id: string) => ['backtests', id] as const,
}

export async function fetchBacktestHistory(): Promise<BacktestSummary[]> {
  return api.get<BacktestSummary[]>('/backtests')
}

export async function fetchBacktest(id: string): Promise<Backtest> {
  return api.get<Backtest>(`/backtests/${id}`)
}

export async function persistBacktestSummary(
  request: CreateBacktestRequest,
): Promise<BacktestSummary> {
  return api.post<BacktestSummary>('/backtests', request)
}

/**
 * Load persisted backtests and hydrate the dashboard presentation model.
 * Fetches the latest detail row when history exists (metrics + equity curve).
 */
export function useBacktestHistory() {
  const hydrateFromPersistedBacktests = useBacktestStore(
    (state) => state.hydrateFromPersistedBacktests,
  )

  return useQuery({
    queryKey: backtestKeys.all,
    queryFn: async () => {
      const items = await fetchBacktestHistory()
      const latestId = items[0]?.id
      const latest = latestId ? await fetchBacktest(latestId).catch(() => null) : null
      hydrateFromPersistedBacktests(items, latest)
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

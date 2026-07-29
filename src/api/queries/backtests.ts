import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { BacktestSummary, CreateBacktestRequest } from '@trading-os/shared'
import { api } from '../client'

export const backtestKeys = {
  all: ['backtests'] as const,
  detail: (id: string) => ['backtests', id] as const,
}

export async function fetchBacktestHistory(): Promise<BacktestSummary[]> {
  return api.get<BacktestSummary[]>('/backtests')
}

export async function persistBacktestSummary(
  request: CreateBacktestRequest,
): Promise<BacktestSummary> {
  return api.post<BacktestSummary>('/backtests', request)
}

/**
 * Server-owned recent backtests. TanStack Query is the source of truth —
 * do not mirror this list into the Zustand store.
 */
export function useBacktestHistory() {
  return useQuery({
    queryKey: backtestKeys.all,
    queryFn: fetchBacktestHistory,
    retry: 1,
  })
}

export function usePersistBacktest() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: persistBacktestSummary,
    onSuccess: (summary) => {
      client.setQueryData<BacktestSummary[]>(backtestKeys.all, (current = []) =>
        [summary, ...current.filter((item) => item.id !== summary.id)].slice(0, 50),
      )
    },
  })
}

import { useQuery } from '@tanstack/react-query'
import {
  fetchBacktestDetail,
  fetchLatestBacktestDetail,
  getBacktestDetail,
  getLatestBacktestDetail,
  type PersistedBacktestDetail,
} from '@/backtests/detail-archive'

export const backtestDetailKeys = {
  all: ['backtest-details'] as const,
  detail: (id: string) => [...backtestDetailKeys.all, id] as const,
  latest: () => [...backtestDetailKeys.all, 'latest'] as const,
}

export async function queryBacktestDetail(id: string): Promise<PersistedBacktestDetail> {
  return fetchBacktestDetail(id)
}

export async function queryLatestBacktestDetail(): Promise<PersistedBacktestDetail | null> {
  return fetchLatestBacktestDetail()
}

/**
 * TanStack Query owns detail fetching. The archive is the persistence backend
 * for full reports (until a server detail API stores BacktestReport blobs).
 */
export function useBacktestDetail(id: string | null) {
  return useQuery({
    queryKey: backtestDetailKeys.detail(id ?? ''),
    queryFn: () => queryBacktestDetail(id!),
    enabled: Boolean(id),
    staleTime: Infinity,
    retry: 1,
    // Prefer cached archive hit without network.
    initialData: () => (id ? getBacktestDetail(id) ?? undefined : undefined),
    initialDataUpdatedAt: () => (id && getBacktestDetail(id) ? Date.now() : undefined),
  })
}

/** Startup / refresh path — latest successful persisted report (or null). */
export function useLatestBacktestDetail(enabled = true) {
  return useQuery({
    queryKey: backtestDetailKeys.latest(),
    queryFn: queryLatestBacktestDetail,
    enabled,
    staleTime: Infinity,
    retry: 1,
    initialData: () => getLatestBacktestDetail() ?? undefined,
    initialDataUpdatedAt: () => (getLatestBacktestDetail() ? Date.now() : undefined),
  })
}

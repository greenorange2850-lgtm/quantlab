import { useQuery } from '@tanstack/react-query'
import {
  fetchLatestResearchSession,
  fetchResearchSession,
  getLatestResearchSession,
  getResearchSession,
} from '@/research/session-archive'

export const researchSessionKeys = {
  all: ['research-sessions'] as const,
  detail: (id: string) => [...researchSessionKeys.all, id] as const,
  latest: () => [...researchSessionKeys.all, 'latest'] as const,
}

export function useResearchSession(id: string | null) {
  return useQuery({
    queryKey: researchSessionKeys.detail(id ?? ''),
    queryFn: () => fetchResearchSession(id!),
    enabled: Boolean(id),
    staleTime: Infinity,
    initialData: () => (id ? getResearchSession(id) ?? undefined : undefined),
  })
}

export function useLatestResearchSession(enabled = true) {
  return useQuery({
    queryKey: researchSessionKeys.latest(),
    queryFn: fetchLatestResearchSession,
    enabled,
    staleTime: Infinity,
    retry: 1,
    initialData: () => getLatestResearchSession() ?? undefined,
    initialDataUpdatedAt: () => (getLatestResearchSession() ? Date.now() : undefined),
  })
}

import { useQuery } from '@tanstack/react-query'
import {
  fetchResearchSession,
  getResearchSession,
} from '@/research/session-archive'

export const researchSessionKeys = {
  all: ['research-sessions'] as const,
  detail: (id: string) => [...researchSessionKeys.all, id] as const,
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

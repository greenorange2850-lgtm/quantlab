import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchLatestResearchSession,
  fetchResearchSession,
  fetchResearchSessions,
  getLatestResearchSession,
  getResearchSession,
  listResearchSessionsBySavedAt,
  removeResearchSession,
} from '@/research/session-archive'

export const researchSessionKeys = {
  all: ['research-sessions'] as const,
  list: () => [...researchSessionKeys.all, 'list'] as const,
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

/** TanStack Query owns the research session list (archive-backed). */
export function useResearchSessions(enabled = true) {
  return useQuery({
    queryKey: researchSessionKeys.list(),
    queryFn: fetchResearchSessions,
    enabled,
    staleTime: Infinity,
    retry: 1,
    initialData: () => {
      const list = listResearchSessionsBySavedAt()
      return list.length > 0 ? list : undefined
    },
    initialDataUpdatedAt: () =>
      listResearchSessionsBySavedAt().length > 0 ? Date.now() : undefined,
  })
}

export function useDeleteResearchSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: removeResearchSession,
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: researchSessionKeys.all })
      queryClient.removeQueries({ queryKey: researchSessionKeys.detail(id) })
    },
  })
}

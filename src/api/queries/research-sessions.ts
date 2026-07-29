import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { appQueryClient } from '@/api/query-client'
import {
  fetchLatestResearchSession,
  fetchResearchSession,
  fetchResearchSessions,
  getLatestResearchSession,
  getResearchSession,
  listResearchSessionsBySavedAt,
  removeResearchSession,
  type PersistedResearchSession,
} from '@/research/session-archive'

export const researchSessionKeys = {
  all: ['research-sessions'] as const,
  list: () => [...researchSessionKeys.all, 'list'] as const,
  detail: (id: string) => [...researchSessionKeys.all, id] as const,
  latest: () => [...researchSessionKeys.all, 'latest'] as const,
}

/**
 * Sync TanStack Query caches from the archive (single source of truth).
 * Call after save/delete so /research-sessions reflects archive immediately.
 */
export function syncResearchSessionQueries(
  client: typeof appQueryClient = appQueryClient,
): void {
  const list = listResearchSessionsBySavedAt()
  const ids = new Set(list.map((entry) => entry.session.id))

  client.setQueryData(researchSessionKeys.list(), list)
  client.setQueryData(researchSessionKeys.latest(), list[0] ?? null)

  for (const [key] of client.getQueriesData({ queryKey: researchSessionKeys.all })) {
    const leaf = key[1]
    if (
      typeof leaf === 'string' &&
      leaf !== 'list' &&
      leaf !== 'latest' &&
      !ids.has(leaf)
    ) {
      client.removeQueries({ queryKey: key })
    }
  }

  for (const entry of list) {
    client.setQueryData(researchSessionKeys.detail(entry.session.id), entry)
  }
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
    // Always prefer archive as initial snapshot when available.
    initialData: () => listResearchSessionsBySavedAt(),
    initialDataUpdatedAt: () => Date.now(),
  })
}

export function useDeleteResearchSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: removeResearchSession,
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: researchSessionKeys.detail(id) })
      syncResearchSessionQueries(queryClient)
    },
  })
}

export type { PersistedResearchSession }

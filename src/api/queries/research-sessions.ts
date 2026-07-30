import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { appQueryClient } from '@/api/query-client'
import {
  ensureResearchSessionArchiveHydrated,
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

/**
 * Gates UI until the research archive has been hydrated from localStorage
 * and TanStack Query caches have been synced from that archive.
 * Always syncs on mount — even when another caller (e.g. diagnostics) already
 * hydrated — so Analysis/Sessions/Compare share one source of truth.
 */
export function useResearchSessionArchiveReady(): boolean {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    ensureResearchSessionArchiveHydrated()
    syncResearchSessionQueries()
    setReady(true)
  }, [])

  return ready
}

export function useResearchSession(id: string | null) {
  const archiveReady = useResearchSessionArchiveReady()

  return useQuery({
    queryKey: researchSessionKeys.detail(id ?? ''),
    queryFn: () => fetchResearchSession(id!),
    enabled: Boolean(id) && archiveReady,
    staleTime: Infinity,
    initialData: () =>
      archiveReady && id ? (getResearchSession(id) ?? undefined) : undefined,
  })
}

export function useLatestResearchSession(enabled = true) {
  const archiveReady = useResearchSessionArchiveReady()

  return useQuery({
    queryKey: researchSessionKeys.latest(),
    queryFn: fetchLatestResearchSession,
    enabled: enabled && archiveReady,
    staleTime: Infinity,
    retry: 1,
    initialData: () =>
      archiveReady ? (getLatestResearchSession() ?? undefined) : undefined,
    initialDataUpdatedAt: () =>
      archiveReady && getLatestResearchSession() ? Date.now() : undefined,
  })
}

/** TanStack Query owns the research session list (archive-backed). */
export function useResearchSessions(enabled = true) {
  const archiveReady = useResearchSessionArchiveReady()

  return useQuery({
    queryKey: researchSessionKeys.list(),
    queryFn: fetchResearchSessions,
    enabled: enabled && archiveReady,
    staleTime: Infinity,
    retry: 1,
    // Only seed from archive after hydrate — never treat pre-hydrate [] as loaded.
    initialData: () => {
      if (!archiveReady) return undefined
      const list = listResearchSessionsBySavedAt()
      return list.length > 0 ? list : undefined
    },
    initialDataUpdatedAt: () => {
      if (!archiveReady) return undefined
      return listResearchSessionsBySavedAt().length > 0 ? Date.now() : undefined
    },
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

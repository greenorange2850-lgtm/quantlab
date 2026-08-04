import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { appQueryClient } from '@/api/query-client'
import {
  deleteResearchSession,
  ensureResearchSessionArchiveHydrated,
  getResearchSession,
  listResearchSessionsBySavedAt,
  removeResearchSession,
  type PersistedResearchSession,
} from '@/research/session-archive'
import { syncResearchSessionQueries } from '@/api/queries/research-sessions'
import {
  deleteStrategyMetadata,
  ensureStrategyDraft,
  ensureStrategyMetadataArchiveHydrated,
  saveStrategy,
  toStrategyListItem,
  toStrategyViewModel,
  type StrategyListItem,
  type StrategyMetadata,
  type StrategyViewModel,
} from '@/strategies'

export const strategyKeys = {
  all: ['strategies'] as const,
  list: () => [...strategyKeys.all, 'list'] as const,
  detail: (id: string) => [...strategyKeys.all, id] as const,
}

export function syncStrategyQueries(
  client: typeof appQueryClient = appQueryClient,
): void {
  ensureResearchSessionArchiveHydrated()
  ensureStrategyMetadataArchiveHydrated()
  const list = listResearchSessionsBySavedAt().map(toStrategyListItem)
  const ids = new Set(list.map((item) => item.id))

  client.setQueryData(strategyKeys.list(), list)

  for (const [key] of client.getQueriesData({ queryKey: strategyKeys.all })) {
    const leaf = key[1]
    if (typeof leaf === 'string' && leaf !== 'list' && !ids.has(leaf)) {
      client.removeQueries({ queryKey: key })
    }
  }

  for (const entry of listResearchSessionsBySavedAt()) {
    client.setQueryData(strategyKeys.detail(entry.session.id), toStrategyViewModel(entry))
  }
}

export function useStrategyArchiveReady(): boolean {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    ensureResearchSessionArchiveHydrated()
    ensureStrategyMetadataArchiveHydrated()
    syncResearchSessionQueries()
    syncStrategyQueries()
    setReady(true)
  }, [])

  return ready
}

export async function fetchStrategies(): Promise<StrategyListItem[]> {
  ensureResearchSessionArchiveHydrated()
  ensureStrategyMetadataArchiveHydrated()
  return listResearchSessionsBySavedAt().map(toStrategyListItem)
}

export async function fetchStrategy(id: string): Promise<StrategyViewModel> {
  ensureResearchSessionArchiveHydrated()
  ensureStrategyMetadataArchiveHydrated()
  const entry = getResearchSession(id)
  if (!entry) {
    throw new Error(`Strategy not found: ${id}`)
  }
  return toStrategyViewModel(entry)
}

export function useStrategies(enabled = true) {
  const archiveReady = useStrategyArchiveReady()

  return useQuery({
    queryKey: strategyKeys.list(),
    queryFn: fetchStrategies,
    enabled: enabled && archiveReady,
    staleTime: Infinity,
    retry: 1,
    initialData: () => {
      if (!archiveReady) return undefined
      const list = listResearchSessionsBySavedAt().map(toStrategyListItem)
      return list.length > 0 ? list : undefined
    },
    initialDataUpdatedAt: () => {
      if (!archiveReady) return undefined
      return listResearchSessionsBySavedAt().length > 0 ? Date.now() : undefined
    },
  })
}

export function useStrategy(id: string | null) {
  const archiveReady = useStrategyArchiveReady()

  return useQuery({
    queryKey: strategyKeys.detail(id ?? ''),
    queryFn: () => fetchStrategy(id!),
    enabled: Boolean(id) && archiveReady,
    staleTime: Infinity,
    initialData: () => {
      if (!archiveReady || !id) return undefined
      const entry = getResearchSession(id)
      return entry ? toStrategyViewModel(entry) : undefined
    },
  })
}

export function useSaveStrategy() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      id: string
      name: string
      description?: string
      market?: string
      timeframe?: string
    }): Promise<StrategyMetadata> => {
      const meta = saveStrategy(input)
      // Rematerialize list + detail from archives so Draft → Saved is immediate.
      syncStrategyQueries(queryClient)
      return meta
    },
    onSuccess: (meta) => {
      // Patch detail optimistically in case a stale observer skipped sync.
      const existing = queryClient.getQueryData<StrategyViewModel>(
        strategyKeys.detail(meta.id),
      )
      if (existing) {
        queryClient.setQueryData(strategyKeys.detail(meta.id), {
          ...existing,
          name: meta.name,
          description: meta.description,
          lifecycle: 'saved' as const,
          updatedAt: meta.updatedAt,
          savedAt: meta.savedAt,
          metadata: meta,
        })
      }

      const list = queryClient.getQueryData<StrategyListItem[]>(strategyKeys.list())
      if (list) {
        queryClient.setQueryData(
          strategyKeys.list(),
          list.map((item) =>
            item.id === meta.id
              ? {
                  ...item,
                  name: meta.name,
                  lifecycle: 'saved' as const,
                  updatedAt: meta.updatedAt,
                }
              : item,
          ),
        )
      }
    },
  })
}

export function useDeleteStrategy() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await removeResearchSession(id)
      deleteStrategyMetadata(id)
    },
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: strategyKeys.detail(id) })
      syncResearchSessionQueries(queryClient)
      syncStrategyQueries(queryClient)
    },
  })
}

/** Called after a research run persists — creates a draft Strategy shell. */
export function registerStrategyDraftFromSession(entry: PersistedResearchSession): void {
  ensureStrategyDraft({
    id: entry.session.id,
    market: entry.session.config.symbol,
    timeframe: entry.session.config.interval.toUpperCase(),
    createdAt: entry.session.createdAt,
  })
  syncStrategyQueries()
}

export function deleteStrategyEverywhere(id: string): void {
  deleteResearchSession(id)
  deleteStrategyMetadata(id)
  syncResearchSessionQueries()
  syncStrategyQueries()
}

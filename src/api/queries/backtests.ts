import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { BacktestSummary, CreateBacktestRequest } from '@trading-os/shared'
import { api } from '../client'
import { queryClient } from '@/providers/query-client'
import {
  markEntryPersistence,
  mergeServerHistory,
  toPersistedHistoryEntry,
  toSavingHistoryEntry,
  upsertHistoryEntry,
  type BacktestHistoryEntry,
} from '@/features/dashboard/backtest-history'

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

function readHistoryEntries(): BacktestHistoryEntry[] {
  return queryClient.getQueryData<BacktestHistoryEntry[]>(backtestKeys.all) ?? []
}

function writeHistoryEntries(entries: BacktestHistoryEntry[]) {
  queryClient.setQueryData<BacktestHistoryEntry[]>(backtestKeys.all, entries)
}

/** Optimistic insert while POST /backtests is in flight. */
export function applyOptimisticHistoryEntry(
  summary: BacktestSummary,
  pendingRequest: CreateBacktestRequest,
) {
  writeHistoryEntries(
    upsertHistoryEntry(readHistoryEntries(), toSavingHistoryEntry(summary, pendingRequest)),
  )
}

/** Mark a row as not saved after POST failure (session results stay visible). */
export function markHistoryEntryNotSaved(id: string, pendingRequest: CreateBacktestRequest) {
  writeHistoryEntries(markEntryPersistence(readHistoryEntries(), id, 'not_saved', pendingRequest))
}

/** Reconcile cache from GET /backtests, keeping local unsaved rows. */
export function reconcileHistoryFromServer(summaries: BacktestSummary[]) {
  writeHistoryEntries(mergeServerHistory(summaries, readHistoryEntries()))
}

/**
 * Server-owned recent backtests as a frontend history view-model.
 * TanStack Query is the source of truth — do not mirror into Zustand.
 */
export function useBacktestHistory() {
  return useQuery({
    queryKey: backtestKeys.all,
    queryFn: async (): Promise<BacktestHistoryEntry[]> => {
      const summaries = await fetchBacktestHistory()
      const previous = queryClient.getQueryData<BacktestHistoryEntry[]>(backtestKeys.all) ?? []
      return mergeServerHistory(summaries, previous)
    },
    retry: 1,
  })
}

/** Retry POST for a row marked not_saved. */
export function useRetryPersistBacktest() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: async (entry: BacktestHistoryEntry) => {
      if (!entry.pendingRequest) {
        throw new Error('Missing pending request for retry')
      }
      client.setQueryData<BacktestHistoryEntry[]>(backtestKeys.all, (current = []) =>
        markEntryPersistence(current, entry.summary.id, 'saving', entry.pendingRequest),
      )
      return persistBacktestSummary(entry.pendingRequest)
    },
    onSuccess: async (summary) => {
      try {
        const serverHistory = await fetchBacktestHistory()
        client.setQueryData<BacktestHistoryEntry[]>(backtestKeys.all, (previous = []) =>
          mergeServerHistory(serverHistory, previous),
        )
      } catch {
        client.setQueryData<BacktestHistoryEntry[]>(backtestKeys.all, (current = []) =>
          upsertHistoryEntry(current, toPersistedHistoryEntry(summary)),
        )
      }
    },
    onError: (_error, entry) => {
      if (!entry.pendingRequest) return
      client.setQueryData<BacktestHistoryEntry[]>(backtestKeys.all, (current = []) =>
        markEntryPersistence(current, entry.summary.id, 'not_saved', entry.pendingRequest),
      )
    },
  })
}

export function usePersistBacktest() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: persistBacktestSummary,
    onSuccess: (summary) => {
      client.setQueryData<BacktestHistoryEntry[]>(backtestKeys.all, (current = []) =>
        upsertHistoryEntry(current, toPersistedHistoryEntry(summary)),
      )
    },
  })
}

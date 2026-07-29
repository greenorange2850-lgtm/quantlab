import type { BacktestSummary, CreateBacktestRequest } from '@trading-os/shared'

/** Transient persistence lifecycle for a Recent Backtests row (frontend-only). */
export type BacktestPersistenceStatus = 'persisted' | 'saving' | 'not_saved'

/**
 * View-model wrapping the server BacktestSummary with client-only persistence state.
 * Do not send this shape to the API.
 */
export interface BacktestHistoryEntry {
  summary: BacktestSummary
  persistence: BacktestPersistenceStatus
  /** Retained for retry when persistence === 'not_saved' | 'saving'. */
  pendingRequest?: CreateBacktestRequest
}

export function toPersistedHistoryEntry(summary: BacktestSummary): BacktestHistoryEntry {
  return { summary, persistence: 'persisted' }
}

export function toSavingHistoryEntry(
  summary: BacktestSummary,
  pendingRequest: CreateBacktestRequest,
): BacktestHistoryEntry {
  return { summary, persistence: 'saving', pendingRequest }
}

export function toNotSavedHistoryEntry(
  summary: BacktestSummary,
  pendingRequest: CreateBacktestRequest,
): BacktestHistoryEntry {
  return { summary, persistence: 'not_saved', pendingRequest }
}

/** Prepend/replace an entry by summary id. */
export function upsertHistoryEntry(
  entries: readonly BacktestHistoryEntry[],
  next: BacktestHistoryEntry,
  limit = 50,
): BacktestHistoryEntry[] {
  return [next, ...entries.filter((entry) => entry.summary.id !== next.summary.id)].slice(0, limit)
}

/**
 * Replace with server rows (persisted) while retaining local unsaved/saving rows
 * that are not yet acknowledged by the server.
 */
export function mergeServerHistory(
  serverSummaries: readonly BacktestSummary[],
  previous: readonly BacktestHistoryEntry[] = [],
  limit = 50,
): BacktestHistoryEntry[] {
  const serverIds = new Set(serverSummaries.map((summary) => summary.id))
  const pendingLocal = previous.filter(
    (entry) =>
      (entry.persistence === 'saving' || entry.persistence === 'not_saved') &&
      !serverIds.has(entry.summary.id),
  )
  const persisted = serverSummaries.map(toPersistedHistoryEntry)
  return [...pendingLocal, ...persisted].slice(0, limit)
}

export function markEntryPersistence(
  entries: readonly BacktestHistoryEntry[],
  id: string,
  persistence: BacktestPersistenceStatus,
  pendingRequest?: CreateBacktestRequest,
): BacktestHistoryEntry[] {
  return entries.map((entry) => {
    if (entry.summary.id !== id) return entry
    return {
      ...entry,
      persistence,
      pendingRequest: pendingRequest ?? entry.pendingRequest,
    }
  })
}

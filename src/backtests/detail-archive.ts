import type { BacktestSummary } from '@trading-os/shared'
import type { BacktestReport } from '@/core/analytics/types'
import type { DashboardViewModelContext } from '@/core/dashboard'

/** Canonical persisted detail used for restore-without-rerun. */
export interface PersistedBacktestDetail {
  id: string
  /** Original list metadata — never rewritten on restore. */
  summary: BacktestSummary
  /** Canonical analytics report — not recomputed on restore. */
  report: BacktestReport
  context: DashboardViewModelContext
  savedAt: number
}

export class BacktestDetailNotFoundError extends Error {
  readonly code = 'BACKTEST_DETAIL_NOT_FOUND' as const

  constructor(id: string) {
    super(`No saved report for backtest ${id}`)
    this.name = 'BacktestDetailNotFoundError'
  }
}

const STORAGE_KEY = 'quantlab.backtest-details.v1'

type ArchiveMap = Record<string, PersistedBacktestDetail>

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

function readStorage(): ArchiveMap {
  if (!canUseStorage()) return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as ArchiveMap
  } catch {
    return {}
  }
}

function writeStorage(map: ArchiveMap): void {
  if (!canUseStorage()) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // Quota / private mode — keep in-memory only.
  }
}

/** In-memory mirror so restores work within the same session even if storage fails. */
const memory = new Map<string, PersistedBacktestDetail>()

function hydrateMemoryFromStorage(): void {
  if (memory.size > 0) return
  const stored = readStorage()
  for (const [id, detail] of Object.entries(stored)) {
    memory.set(id, detail)
  }
}

/**
 * Persist a completed backtest detail.
 * Upserts by id — never creates a duplicate history entry.
 */
export function saveBacktestDetail(detail: PersistedBacktestDetail): void {
  hydrateMemoryFromStorage()
  memory.set(detail.id, detail)

  const stored = readStorage()
  stored[detail.id] = detail
  writeStorage(stored)
}

export function getBacktestDetail(id: string): PersistedBacktestDetail | null {
  hydrateMemoryFromStorage()
  return memory.get(id) ?? null
}

export async function fetchBacktestDetail(id: string): Promise<PersistedBacktestDetail> {
  const detail = getBacktestDetail(id)
  if (!detail) {
    throw new BacktestDetailNotFoundError(id)
  }
  return detail
}

export function listBacktestDetailIds(): string[] {
  hydrateMemoryFromStorage()
  return [...memory.keys()]
}

/** All persisted details, newest `savedAt` first. */
export function listBacktestDetailsBySavedAt(): PersistedBacktestDetail[] {
  hydrateMemoryFromStorage()
  return [...memory.values()].sort((a, b) => b.savedAt - a.savedAt)
}

/** Latest successful persisted backtest, or null when the archive is empty. */
export function getLatestBacktestDetail(): PersistedBacktestDetail | null {
  return listBacktestDetailsBySavedAt()[0] ?? null
}

export async function fetchLatestBacktestDetail(): Promise<PersistedBacktestDetail | null> {
  return getLatestBacktestDetail()
}

/** Test helper — clears memory + storage. */
export function clearBacktestDetailArchive(): void {
  memory.clear()
  if (canUseStorage()) {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }
}

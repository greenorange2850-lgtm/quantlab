import type { BacktestReport } from '@/core/analytics/types'
import type { ResearchReport, ResearchSession } from '@/core/research'

export interface PersistedResearchSession {
  session: ResearchSession
  report: ResearchReport
  savedAt: number
}

/** Stable key — never rename (preserves existing user data). */
const STORAGE_KEY = 'quantlab.research-sessions.v1'
const memory = new Map<string, PersistedResearchSession>()
let didHydrate = false

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

function readStorage(): Record<string, PersistedResearchSession> {
  if (!canUseStorage()) return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as Record<string, PersistedResearchSession>
  } catch {
    return {}
  }
}

/**
 * Strip heavy series from BacktestReport for durable research-archive storage.
 * Summary / statistics / tradeAnalysis / drawdown stay intact for list, Analysis,
 * and Compare. Full reports with equity/trades live in the backtest detail archive.
 */
function slimBacktestReport(report: BacktestReport): BacktestReport {
  return {
    ...report,
    equityCurve: [],
    trades: [],
    topTrades: [],
    monthlyReturns: {
      months: [],
      bestMonth: report.monthlyReturns.bestMonth,
      worstMonth: report.monthlyReturns.worstMonth,
    },
  }
}

/** Compact form written to localStorage (same key / shape, smaller payload). */
export function slimResearchSessionForStorage(
  entry: PersistedResearchSession,
): PersistedResearchSession {
  const slimCandidates = entry.session.candidates.map((candidate) => ({
    ...candidate,
    report: slimBacktestReport(candidate.report),
  }))

  const slimSession: ResearchSession = {
    ...entry.session,
    candidates: slimCandidates,
  }

  const slimReport: ResearchReport = {
    ...entry.report,
    bestCandidate: entry.report.bestCandidate
      ? {
          ...entry.report.bestCandidate,
          report: slimBacktestReport(entry.report.bestCandidate.report),
        }
      : null,
    topCandidates: entry.report.topCandidates.map((candidate) => ({
      ...candidate,
      report: slimBacktestReport(candidate.report),
    })),
  }

  return {
    session: slimSession,
    report: slimReport,
    savedAt: entry.savedAt,
  }
}

function writeStorage(map: Record<string, PersistedResearchSession>): boolean {
  if (!canUseStorage()) return false
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
    return true
  } catch {
    // Quota / private mode — caller may prune and retry.
    return false
  }
}

/**
 * Load localStorage into memory once per page lifetime.
 * Merges storage → memory without clobbering newer in-memory entries.
 */
export function ensureResearchSessionArchiveHydrated(): void {
  if (didHydrate) return
  for (const [id, value] of Object.entries(readStorage())) {
    if (!memory.has(id)) {
      memory.set(id, value)
    }
  }
  didHydrate = true
}

export function isResearchSessionArchiveHydrated(): boolean {
  return didHydrate
}

function hydrate(): void {
  ensureResearchSessionArchiveHydrated()
}

/**
 * Persist a research session to memory + localStorage (same STORAGE_KEY).
 * Durable write uses a slim payload so typical Random Search runs fit quota.
 * Returns whether the durable write succeeded.
 */
export function saveResearchSession(entry: PersistedResearchSession): boolean {
  hydrate()
  // Keep the full entry in memory for the current tab (Analysis / Compare).
  memory.set(entry.session.id, entry)

  const stored = readStorage()
  stored[entry.session.id] = slimResearchSessionForStorage(entry)

  if (writeStorage(stored)) return true

  // Quota exceeded: drop oldest *other* sessions and retry once.
  const ranked = Object.values(stored).sort((a, b) => a.savedAt - b.savedAt)
  for (const oldest of ranked) {
    if (oldest.session.id === entry.session.id) continue
    delete stored[oldest.session.id]
    memory.delete(oldest.session.id)
    if (writeStorage(stored)) return true
  }

  // Last resort: try writing only this slim session.
  const solo: Record<string, PersistedResearchSession> = {
    [entry.session.id]: slimResearchSessionForStorage(entry),
  }
  return writeStorage(solo)
}

export function getResearchSession(id: string): PersistedResearchSession | null {
  hydrate()
  return memory.get(id) ?? null
}

export function listResearchSessionsBySavedAt(): PersistedResearchSession[] {
  hydrate()
  return [...memory.values()].sort((a, b) => b.savedAt - a.savedAt)
}

/** Latest archived research session, or null when none exist. */
export function getLatestResearchSession(): PersistedResearchSession | null {
  return listResearchSessionsBySavedAt()[0] ?? null
}

export async function fetchLatestResearchSession(): Promise<PersistedResearchSession | null> {
  return getLatestResearchSession()
}

export async function fetchResearchSession(id: string): Promise<PersistedResearchSession> {
  const entry = getResearchSession(id)
  if (!entry) {
    throw new Error(`Research session not found: ${id}`)
  }
  return entry
}

export async function fetchResearchSessions(): Promise<PersistedResearchSession[]> {
  ensureResearchSessionArchiveHydrated()
  return listResearchSessionsBySavedAt()
}

export function deleteResearchSession(id: string): boolean {
  hydrate()
  const existed = memory.delete(id)
  const stored = readStorage()
  if (id in stored) {
    delete stored[id]
    writeStorage(stored)
    return true
  }
  return existed
}

export async function removeResearchSession(id: string): Promise<void> {
  const removed = deleteResearchSession(id)
  if (!removed) {
    throw new Error(`Research session not found: ${id}`)
  }
}

export function clearResearchSessionArchive(): void {
  memory.clear()
  didHydrate = false
  if (canUseStorage()) {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }
}

/**
 * Test helper — drop in-memory cache only (simulates page reload; storage kept).
 * Clears the hydrate flag so the next read reloads from localStorage.
 */
export function resetResearchSessionMemory(): void {
  memory.clear()
  didHydrate = false
}

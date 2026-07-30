import type { BacktestReport } from '@/core/analytics/types'
import type { ResearchReport, ResearchSession } from '@/core/research'

export interface PersistedResearchSession {
  session: ResearchSession
  report: ResearchReport
  savedAt: number
}

/** Stable key — never rename (preserves existing user data). */
export const RESEARCH_SESSION_STORAGE_KEY = 'quantlab.research-sessions.v1'
const STORAGE_KEY = RESEARCH_SESSION_STORAGE_KEY
const memory = new Map<string, PersistedResearchSession>()
let didHydrate = false
/** Last durable write failure message (quota / private mode), if any. */
let lastPersistenceError: string | null = null

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

/**
 * Canonical bag keyed by `entry.session.id`.
 * Storage object keys can drift from `session.id` (legacy / corrupt bags);
 * list UIs use `session.id` while Analysis looks up by that same id — both
 * must resolve the same entry.
 */
function canonicalizeSessionBag(
  raw: Record<string, PersistedResearchSession>,
): Record<string, PersistedResearchSession> {
  const canonical: Record<string, PersistedResearchSession> = {}
  for (const value of Object.values(raw)) {
    if (!value || typeof value !== 'object') continue
    const id = value.session?.id
    if (!id || typeof id !== 'string') continue
    const previous = canonical[id]
    if (!previous || (value.savedAt ?? 0) >= (previous.savedAt ?? 0)) {
      canonical[id] = value
    }
  }
  return canonical
}

function readStorage(): Record<string, PersistedResearchSession> {
  if (!canUseStorage()) return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    return canonicalizeSessionBag(parsed as Record<string, PersistedResearchSession>)
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
  // Keep first/last equity points so Research Period survives refresh without
  // storing the full curve (full series lives in the backtest detail archive).
  const curve = report.equityCurve
  const endpoints =
    curve.length === 0
      ? []
      : curve.length === 1
        ? [curve[0]!]
        : [curve[0]!, curve[curve.length - 1]!]

  return {
    ...report,
    equityCurve: endpoints,
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
  if (!canUseStorage()) {
    lastPersistenceError = 'localStorage is unavailable in this environment'
    return false
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
    lastPersistenceError = null
    return true
  } catch (error) {
    // Quota / private mode — caller may prune and retry.
    lastPersistenceError =
      error instanceof Error ? error.message : 'localStorage setItem failed'
    return false
  }
}

/**
 * Load localStorage into memory once per page lifetime.
 * Indexes by `session.id` (never by a divergent JSON object key).
 * Rewrites durable storage when object keys drifted from session ids.
 * Merges storage → memory without clobbering newer in-memory entries.
 */
export function ensureResearchSessionArchiveHydrated(): void {
  if (didHydrate) return

  const canonical = readStorage()
  for (const [id, value] of Object.entries(canonical)) {
    if (!memory.has(id)) {
      memory.set(id, value)
    }
  }

  // Self-heal durable bag when JSON object keys diverged from session.id.
  if (canUseStorage()) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as unknown
        if (parsed && typeof parsed === 'object') {
          const rawKeys = Object.keys(parsed as object).sort()
          const canonicalKeys = Object.keys(canonical).sort()
          const keysMatch =
            rawKeys.length === canonicalKeys.length &&
            rawKeys.every((key, index) => key === canonicalKeys[index])
          if (!keysMatch) {
            writeStorage(canonical)
          }
        }
      }
    } catch {
      // Ignore heal failures — memory is already canonical for lookups.
    }
  }

  didHydrate = true
}

/** Resolve an entry by session id, repairing divergent map keys when found. */
function resolveMemorySession(id: string): PersistedResearchSession | null {
  const direct = memory.get(id)
  if (direct) return direct

  for (const [key, value] of memory.entries()) {
    if (value.session.id !== id) continue
    memory.delete(key)
    memory.set(id, value)
    return value
  }
  return null
}

export function isResearchSessionArchiveHydrated(): boolean {
  return didHydrate
}

export function getResearchSessionLastPersistenceError(): string | null {
  return lastPersistenceError
}

/** Snapshot of durable research-session storage for preview/dev diagnostics. */
export function getResearchSessionPersistenceDiagnostics(): {
  storageKey: string
  hydrated: boolean
  memoryCount: number
  persistedCount: number
  payloadBytes: number | null
  keyPresent: boolean
  lastPersistenceError: string | null
  canUseStorage: boolean
} {
  const canUse = canUseStorage()
  let raw: string | null = null
  let persistedCount = 0
  if (canUse) {
    try {
      raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as unknown
        if (parsed && typeof parsed === 'object') {
          persistedCount = Object.keys(parsed as object).length
        }
      }
    } catch {
      raw = null
      persistedCount = 0
    }
  }

  return {
    storageKey: STORAGE_KEY,
    hydrated: didHydrate,
    memoryCount: memory.size,
    persistedCount,
    payloadBytes: raw === null ? null : raw.length,
    keyPresent: raw !== null,
    lastPersistenceError,
    canUseStorage: canUse,
  }
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
  // Drop any divergent keys that pointed at the same session id.
  for (const [key, value] of memory.entries()) {
    if (key !== entry.session.id && value.session.id === entry.session.id) {
      memory.delete(key)
    }
  }
  memory.set(entry.session.id, entry)

  // readStorage() already returns a canonical bag keyed by session.id.
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
  return resolveMemorySession(id)
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
  let existed = false
  for (const [key, value] of memory.entries()) {
    if (key === id || value.session.id === id) {
      memory.delete(key)
      existed = true
    }
  }
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
  lastPersistenceError = null
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

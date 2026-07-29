import type { ResearchReport, ResearchSession } from '@/core/research'

export interface PersistedResearchSession {
  session: ResearchSession
  report: ResearchReport
  savedAt: number
}

const STORAGE_KEY = 'quantlab.research-sessions.v1'
const memory = new Map<string, PersistedResearchSession>()

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

function writeStorage(map: Record<string, PersistedResearchSession>): void {
  if (!canUseStorage()) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // ignore quota
  }
}

function hydrate(): void {
  if (memory.size > 0) return
  for (const [id, value] of Object.entries(readStorage())) {
    memory.set(id, value)
  }
}

export function saveResearchSession(entry: PersistedResearchSession): void {
  hydrate()
  memory.set(entry.session.id, entry)
  const stored = readStorage()
  stored[entry.session.id] = entry
  writeStorage(stored)
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

export function clearResearchSessionArchive(): void {
  memory.clear()
  if (canUseStorage()) {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }
}

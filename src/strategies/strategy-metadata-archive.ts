import type { StrategyMetadata } from './types'
import { DEFAULT_STRATEGY_BASE_NAME } from './types'

/** Stable key — never rename (preserves existing user data). */
export const STRATEGY_METADATA_STORAGE_KEY = 'quantlab.strategy-metadata.v1'
const STORAGE_KEY = STRATEGY_METADATA_STORAGE_KEY

const memory = new Map<string, StrategyMetadata>()
let didHydrate = false

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

function readStorage(): Record<string, StrategyMetadata> {
  if (!canUseStorage()) return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as Record<string, StrategyMetadata>
  } catch {
    return {}
  }
}

function writeStorage(map: Record<string, StrategyMetadata>): boolean {
  if (!canUseStorage()) return false
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
    return true
  } catch {
    return false
  }
}

export function ensureStrategyMetadataArchiveHydrated(): void {
  if (didHydrate) return
  const stored = readStorage()
  for (const [id, value] of Object.entries(stored)) {
    if (!value || typeof value !== 'object' || !value.id) continue
    if (!memory.has(id)) memory.set(id, value)
  }
  didHydrate = true
}

export function isStrategyMetadataArchiveHydrated(): boolean {
  return didHydrate
}

function defaultName(market: string, timeframe: string): string {
  const marketPart = market.trim() || 'Market'
  const tfPart = timeframe.trim() || 'TF'
  return `${DEFAULT_STRATEGY_BASE_NAME} · ${marketPart} ${tfPart}`
}

/** Create draft metadata when a research run is first persisted. No-op if already present. */
export function ensureStrategyDraft(input: {
  id: string
  market: string
  timeframe: string
  createdAt?: number
}): StrategyMetadata {
  ensureStrategyMetadataArchiveHydrated()
  const existing = memory.get(input.id)
  if (existing) return existing

  const now = Date.now()
  const meta: StrategyMetadata = {
    id: input.id,
    sourceSessionId: input.id,
    name: defaultName(input.market, input.timeframe),
    description: '',
    saved: false,
    createdAt: input.createdAt ?? now,
    updatedAt: now,
    savedAt: null,
  }
  memory.set(input.id, meta)
  const stored = readStorage()
  stored[input.id] = meta
  writeStorage(stored)
  return meta
}

/**
 * Promote a draft to a saved Strategy in the library.
 * Creates metadata if missing (legacy sessions).
 */
export function saveStrategy(input: {
  id: string
  name: string
  description?: string
  market?: string
  timeframe?: string
}): StrategyMetadata {
  ensureStrategyMetadataArchiveHydrated()
  const now = Date.now()
  const previous = memory.get(input.id)
  const name = input.name.trim() || previous?.name || DEFAULT_STRATEGY_BASE_NAME
  const meta: StrategyMetadata = {
    id: input.id,
    sourceSessionId: input.id,
    name,
    description: (input.description ?? previous?.description ?? '').trim(),
    saved: true,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    savedAt: now,
  }
  memory.set(input.id, meta)
  const stored = readStorage()
  stored[input.id] = meta
  writeStorage(stored)
  return meta
}

export function getStrategyMetadata(id: string): StrategyMetadata | null {
  ensureStrategyMetadataArchiveHydrated()
  return memory.get(id) ?? null
}

export function listStrategyMetadata(): StrategyMetadata[] {
  ensureStrategyMetadataArchiveHydrated()
  return [...memory.values()].sort((a, b) => b.updatedAt - a.updatedAt)
}

export function deleteStrategyMetadata(id: string): boolean {
  ensureStrategyMetadataArchiveHydrated()
  const existed = memory.delete(id)
  const stored = readStorage()
  if (id in stored) {
    delete stored[id]
    writeStorage(stored)
    return true
  }
  return existed
}

/**
 * Legacy sessions without metadata appear as saved strategies so History → Library
 * does not hide existing user work.
 */
export function resolveStrategyMetadata(input: {
  id: string
  market: string
  timeframe: string
  createdAt: number
  savedAt: number
}): StrategyMetadata {
  const existing = getStrategyMetadata(input.id)
  if (existing) return existing

  return {
    id: input.id,
    sourceSessionId: input.id,
    name: defaultName(input.market, input.timeframe),
    description: '',
    saved: true,
    createdAt: input.createdAt || input.savedAt,
    updatedAt: input.savedAt,
    savedAt: input.savedAt,
  }
}

export function clearStrategyMetadataArchive(): void {
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

/** Test helper — drop in-memory cache only. */
export function resetStrategyMetadataMemory(): void {
  memory.clear()
  didHydrate = false
}

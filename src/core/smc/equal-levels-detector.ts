import type {
  SmcClassifiedSwingEvent,
  SmcEqualLevelEvent,
  SmcEqualLevelsConfig,
  SmcSwingEvent,
} from './types'

export interface EqualLevelsDetectionInternal {
  events: SmcEqualLevelEvent[]
}

function collectSwings(
  base: readonly SmcSwingEvent[],
  classified: readonly SmcClassifiedSwingEvent[],
  config: SmcEqualLevelsConfig,
): Array<{ id: string; kind: 'HIGH' | 'LOW'; price: number; index: number; timestamp: number }> {
  const out: Array<{
    id: string
    kind: 'HIGH' | 'LOW'
    price: number
    index: number
    timestamp: number
  }> = []

  if (config.useInternalSwings || config.useExternalSwings) {
    for (const s of classified) {
      if (s.classification === 'INTERNAL' && !config.useInternalSwings) continue
      if (s.classification === 'EXTERNAL' && !config.useExternalSwings) continue
      out.push({
        id: s.id,
        kind: s.kind.includes('HIGH') ? 'HIGH' : 'LOW',
        price: s.price,
        index: s.candleIndex,
        timestamp: s.timestamp,
      })
    }
  }

  // Fallback to base swings when classification unused/empty.
  if (out.length === 0) {
    for (const s of base) {
      out.push({
        id: s.id,
        kind: s.kind === 'SWING_HIGH' ? 'HIGH' : 'LOW',
        price: s.price,
        index: s.candleIndex,
        timestamp: s.timestamp,
      })
    }
  }

  return out.sort((a, b) => a.index - b.index)
}

/**
 * Equal High / Equal Low grouping for liquidity analysis.
 * Deterministic: leftmost seed, greedy group within tolerance + bar separation.
 */
export function detectEqualLevels(
  baseSwings: readonly SmcSwingEvent[],
  classified: readonly SmcClassifiedSwingEvent[],
  config: SmcEqualLevelsConfig,
  visibleThroughIndex: number,
): EqualLevelsDetectionInternal {
  if (!config.enabled) return { events: [] }

  const swings = collectSwings(baseSwings, classified, config).filter(
    (s) => s.index <= visibleThroughIndex,
  )
  const events: SmcEqualLevelEvent[] = []
  const used = new Set<string>()

  for (const kind of ['HIGH', 'LOW'] as const) {
    const pool = swings.filter((s) => s.kind === kind && !used.has(s.id))
    for (let i = 0; i < pool.length; i++) {
      const seed = pool[i]!
      if (used.has(seed.id)) continue
      const members = [seed]
      for (let j = i + 1; j < pool.length; j++) {
        const other = pool[j]!
        if (used.has(other.id)) continue
        const tol = Math.abs(seed.price) * (config.tolerancePercent / 100)
        if (Math.abs(other.price - seed.price) > tol + 1e-12) continue
        if (other.index - members[members.length - 1]!.index < config.minimumBarsApart) {
          continue
        }
        // None materially exceeds group tolerance before confirmation — already enforced by tol.
        members.push(other)
      }

      if (members.length < config.minimumTouches) continue
      for (const m of members) used.add(m.id)

      const prices = members.map((m) => m.price)
      const level = prices.reduce((a, b) => a + b, 0) / prices.length
      const latest = members[members.length - 1]!
      const first = members[0]!
      events.push({
        id: `eq-${kind === 'HIGH' ? 'h' : 'l'}-${first.index}-${latest.index}`,
        kind: kind === 'HIGH' ? 'EQUAL_HIGHS' : 'EQUAL_LOWS',
        candleIndex: latest.index,
        timestamp: latest.timestamp,
        level,
        minMemberPrice: Math.min(...prices),
        maxMemberPrice: Math.max(...prices),
        firstTimestamp: first.timestamp,
        latestTimestamp: latest.timestamp,
        touchCount: members.length,
        memberSwingIds: members.map((m) => m.id),
        reason: [
          `Equal ${kind === 'HIGH' ? 'Highs' : 'Lows'}: ${members.length} touches`,
          `within ${config.tolerancePercent}% tolerance, min ${config.minimumBarsApart} bars apart.`,
          `Level ≈ ${level}.`,
        ].join(' '),
        refs: members.map((m) => ({
          id: m.id,
          kind: (kind === 'HIGH' ? 'SWING_HIGH' : 'SWING_LOW') as 'SWING_HIGH' | 'SWING_LOW',
        })),
      })
    }
  }

  return { events }
}

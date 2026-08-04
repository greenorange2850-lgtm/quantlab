import type { Candle } from '@/data/candles'
import type {
  SmcClassifiedSwingEvent,
  SmcDisplacementEvent,
  SmcEqualLevelEvent,
  SmcLiquiditySweepConfig,
  SmcLiquiditySweepDiagnostics,
  SmcLiquiditySweepEvent,
  SmcSwingEvent,
} from './types'

export interface LiquiditySweepDetectionInternal {
  events: SmcLiquiditySweepEvent[]
  diagnostics: SmcLiquiditySweepDiagnostics
}

interface MemberLevel {
  id: string
  price: number
  confirmedAtIndex: number
  candleIndex: number
  scope: 'INTERNAL' | 'EXTERNAL' | 'BOTH'
  equalLevelId: string | null
}

interface CanonicalLevel {
  id: string
  side: 'HIGH' | 'LOW'
  price: number
  confirmedAtIndex: number
  candleIndex: number
  scope: 'INTERNAL' | 'EXTERNAL' | 'BOTH'
  memberIds: string[]
  equalLevelId: string | null
}

function emptyDiagnostics(): SmcLiquiditySweepDiagnostics {
  return {
    rawSweepCandidates: 0,
    canonicalLevelsConsidered: 0,
    duplicateSweepsSuppressed: 0,
    consumedLevelAttemptsIgnored: 0,
    validUniqueSweeps: 0,
  }
}

function collectMembers(
  base: readonly SmcSwingEvent[],
  classified: readonly SmcClassifiedSwingEvent[],
  equalLevels: readonly SmcEqualLevelEvent[],
  config: SmcLiquiditySweepConfig,
  side: 'HIGH' | 'LOW',
): MemberLevel[] {
  const members: MemberLevel[] = []
  const seen = new Set<string>()

  if (classified.length > 0) {
    for (const s of classified) {
      const isHigh = s.kind.includes('HIGH')
      if (side === 'HIGH' && !isHigh) continue
      if (side === 'LOW' && isHigh) continue
      if (config.structureScope === 'INTERNAL' && s.classification !== 'INTERNAL') continue
      if (config.structureScope === 'EXTERNAL' && s.classification !== 'EXTERNAL') continue
      if (seen.has(s.id)) continue
      seen.add(s.id)
      members.push({
        id: s.id,
        price: s.price,
        confirmedAtIndex: s.confirmedAtIndex,
        candleIndex: s.candleIndex,
        scope: s.classification,
        equalLevelId: null,
      })
    }
  } else {
    for (const s of base) {
      if (side === 'HIGH' && s.kind !== 'SWING_HIGH') continue
      if (side === 'LOW' && s.kind !== 'SWING_LOW') continue
      if (seen.has(s.id)) continue
      seen.add(s.id)
      members.push({
        id: s.id,
        price: s.price,
        confirmedAtIndex: s.confirmedAtIndex,
        candleIndex: s.candleIndex,
        scope: 'BOTH',
        equalLevelId: null,
      })
    }
  }

  // Equal-level groups contribute their members into the same canonical merge,
  // but do not create a separate parallel level that double-counts the same liquidity.
  for (const eq of equalLevels) {
    if (side === 'HIGH' && eq.kind !== 'EQUAL_HIGHS') continue
    if (side === 'LOW' && eq.kind !== 'EQUAL_LOWS') continue
    for (const memberId of eq.memberSwingIds) {
      if (seen.has(memberId)) {
        const existing = members.find((m) => m.id === memberId)
        if (existing && !existing.equalLevelId) existing.equalLevelId = eq.id
        continue
      }
      // Member may be classified under a different id; seed from equal-level price.
      seen.add(memberId)
      members.push({
        id: memberId,
        price: eq.level,
        confirmedAtIndex: eq.candleIndex,
        candleIndex: eq.candleIndex,
        scope: config.structureScope,
        equalLevelId: eq.id,
      })
    }
  }

  return members
}

/**
 * Merge nearby equal/swing levels within tolerance into one canonical liquidity group.
 */
export function buildCanonicalLiquidityLevels(
  members: readonly MemberLevel[],
  side: 'HIGH' | 'LOW',
  tolerancePercent: number,
): CanonicalLevel[] {
  const sorted = [...members].sort((a, b) => a.price - b.price || a.candleIndex - b.candleIndex)
  const groups: CanonicalLevel[] = []
  const used = new Set<string>()

  for (const seed of sorted) {
    if (used.has(seed.id)) continue
    const tol = Math.abs(seed.price) * (tolerancePercent / 100)
    const cluster = sorted.filter(
      (m) => !used.has(m.id) && Math.abs(m.price - seed.price) <= tol + 1e-12,
    )
    for (const m of cluster) used.add(m.id)

    const prices = cluster.map((m) => m.price)
    const level =
      prices.reduce((a, b) => a + b, 0) / Math.max(1, prices.length)
    const latest = cluster.reduce((a, b) => (b.candleIndex > a.candleIndex ? b : a))
    const confirm = Math.max(...cluster.map((m) => m.confirmedAtIndex))
    const hasExternal = cluster.some((m) => m.scope === 'EXTERNAL')
    const hasInternal = cluster.some((m) => m.scope === 'INTERNAL')
    const scope: CanonicalLevel['scope'] =
      hasExternal && hasInternal ? 'BOTH' : hasExternal ? 'EXTERNAL' : hasInternal ? 'INTERNAL' : 'BOTH'

    groups.push({
      id: `liq-${side === 'HIGH' ? 'h' : 'l'}-${cluster.map((m) => m.id).sort().join('+').slice(0, 120)}`,
      side,
      price: level,
      confirmedAtIndex: confirm,
      candleIndex: latest.candleIndex,
      scope,
      memberIds: cluster.map((m) => m.id),
      equalLevelId: cluster.find((m) => m.equalLevelId)?.equalLevelId ?? null,
    })
  }

  return groups
}

/**
 * Liquidity sweep detector with canonical-level deduplication.
 * Buy-side: trade above level + close back below (not a close-through break).
 * Sell-side: trade below level + close back above.
 * One canonical level → one successful sweep by default.
 */
export function detectLiquiditySweeps(
  candles: readonly Candle[],
  baseSwings: readonly SmcSwingEvent[],
  classified: readonly SmcClassifiedSwingEvent[],
  equalLevels: readonly SmcEqualLevelEvent[],
  displacements: readonly SmcDisplacementEvent[],
  config: SmcLiquiditySweepConfig,
  visibleThroughIndex: number,
): LiquiditySweepDetectionInternal {
  const diagnostics = emptyDiagnostics()
  if (!config.enabled || candles.length === 0) {
    return { events: [], diagnostics }
  }

  const last = Math.min(visibleThroughIndex, candles.length - 1)
  const events: SmcLiquiditySweepEvent[] = []
  const consumed = new Set<string>()

  const buyMembers = collectMembers(baseSwings, classified, equalLevels, config, 'HIGH')
  const sellMembers = collectMembers(baseSwings, classified, equalLevels, config, 'LOW')
  const buyLevels = buildCanonicalLiquidityLevels(
    buyMembers,
    'HIGH',
    config.equalLevelTolerancePercent,
  )
  const sellLevels = buildCanonicalLiquidityLevels(
    sellMembers,
    'LOW',
    config.equalLevelTolerancePercent,
  )
  diagnostics.canonicalLevelsConsidered = buyLevels.length + sellLevels.length

  const trySide = (
    levels: readonly CanonicalLevel[],
    side: 'HIGH' | 'LOW',
  ) => {
    for (let i = 0; i <= last; i++) {
      const candle = candles[i]!
      // One candle → one sweep per side against the best matching unconsumed level.
      let best: {
        level: CanonicalLevel
        penetration: number
        penetrationPercent: number
        closeBack: number
        closeBackPercent: number
        wickExtreme: number
      } | null = null
      let sameCandleDuplicates = 0

      for (const level of levels) {
        if (level.confirmedAtIndex > i) continue
        if (level.candleIndex >= i) continue

        const traded =
          side === 'HIGH' ? candle.high > level.price : candle.low < level.price
        const closeThrough =
          side === 'HIGH' ? candle.close > level.price : candle.close < level.price
        if (!traded || closeThrough) continue

        diagnostics.rawSweepCandidates += 1

        if (consumed.has(level.id) && !config.allowRepeatedSweepsOfSameLevel) {
          diagnostics.consumedLevelAttemptsIgnored += 1
          continue
        }

        const wickExtreme = side === 'HIGH' ? candle.high : candle.low
        const penetration =
          side === 'HIGH' ? wickExtreme - level.price : level.price - wickExtreme
        const penetrationPercent =
          level.price === 0 ? 0 : (penetration / Math.abs(level.price)) * 100
        if (penetrationPercent + 1e-12 < config.minimumPenetrationPercent) continue

        const closeBack =
          side === 'HIGH' ? level.price - candle.close : candle.close - level.price
        const closeBackPercent =
          level.price === 0 ? 0 : (closeBack / Math.abs(level.price)) * 100
        if (closeBackPercent > config.maximumCloseDistancePercent + 1e-12) continue

        if (config.requireSameCandleRejection) {
          if (side === 'HIGH' && !(candle.close < level.price)) continue
          if (side === 'LOW' && !(candle.close > level.price)) continue
        }

        if (config.requireDisplacementAfterSweep) {
          const end = Math.min(last, i + config.displacementConfirmationBars)
          const needKind =
            side === 'HIGH' ? 'BEARISH_DISPLACEMENT' : 'BULLISH_DISPLACEMENT'
          const disp = displacements.find(
            (d) => d.kind === needKind && d.candleIndex > i && d.candleIndex <= end,
          )
          if (!disp) continue
        }

        if (best) {
          sameCandleDuplicates += 1
          // Keep the deepest penetration for this candle/side.
          if (penetration <= best.penetration) continue
        }
        best = {
          level,
          penetration,
          penetrationPercent,
          closeBack,
          closeBackPercent,
          wickExtreme,
        }
      }

      if (!best) continue
      diagnostics.duplicateSweepsSuppressed += sameCandleDuplicates

      const { level } = best
      if (consumed.has(level.id) && !config.allowRepeatedSweepsOfSameLevel) {
        diagnostics.consumedLevelAttemptsIgnored += 1
        continue
      }
      consumed.add(level.id)

      let displacementId: string | null = null
      if (config.requireDisplacementAfterSweep) {
        const end = Math.min(last, i + config.displacementConfirmationBars)
        const needKind =
          side === 'HIGH' ? 'BEARISH_DISPLACEMENT' : 'BULLISH_DISPLACEMENT'
        displacementId =
          displacements.find(
            (d) => d.kind === needKind && d.candleIndex > i && d.candleIndex <= end,
          )?.id ?? null
      }

      const kind =
        side === 'HIGH' ? 'BUY_SIDE_LIQUIDITY_SWEEP' : 'SELL_SIDE_LIQUIDITY_SWEEP'
      events.push({
        id: `sweep-${side === 'HIGH' ? 'bsl' : 'ssl'}-${i}-${level.id}`,
        kind,
        candleIndex: i,
        timestamp: candle.time,
        sweptSwingIds: level.memberIds,
        canonicalLevelId: level.id,
        sweptLevel: level.price,
        wickExtreme: best.wickExtreme,
        close: candle.close,
        penetration: best.penetration,
        penetrationPercent: best.penetrationPercent,
        closeBackDistance: best.closeBack,
        closeBackDistancePercent: best.closeBackPercent,
        structuralScope: level.scope,
        displacementId,
        equalLevelId: level.equalLevelId,
        reason: [
          `${side === 'HIGH' ? 'BSL' : 'SSL'} Sweep at index ${i}:`,
          `canonical ${level.id} level ${level.price},`,
          `wick ${best.wickExtreme}, close ${candle.close} reclaimed.`,
          `Members: ${level.memberIds.join(', ')}.`,
        ].join(' '),
        refs: level.memberIds.map((id) => ({
          id,
          kind: (side === 'HIGH' ? 'SWING_HIGH' : 'SWING_LOW') as 'SWING_HIGH' | 'SWING_LOW',
        })),
        ruleChecks: {
          tradedBeyond: true,
          closedReclaimed:
            side === 'HIGH' ? candle.close < level.price : candle.close > level.price,
          notCloseThrough:
            side === 'HIGH' ? !(candle.close > level.price) : !(candle.close < level.price),
          penetrationOk: best.penetrationPercent >= config.minimumPenetrationPercent,
          canonicalDeduped: true,
        },
      })
    }
  }

  trySide(buyLevels, 'HIGH')
  trySide(sellLevels, 'LOW')
  diagnostics.validUniqueSweeps = events.length

  return { events, diagnostics }
}

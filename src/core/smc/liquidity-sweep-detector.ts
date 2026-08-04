import type { Candle } from '@/data/candles'
import type {
  SmcClassifiedSwingEvent,
  SmcDisplacementEvent,
  SmcEqualLevelEvent,
  SmcLiquiditySweepConfig,
  SmcLiquiditySweepEvent,
  SmcSwingEvent,
} from './types'

export interface LiquiditySweepDetectionInternal {
  events: SmcLiquiditySweepEvent[]
}

interface SweepLevel {
  id: string
  price: number
  confirmedAtIndex: number
  candleIndex: number
  scope: 'INTERNAL' | 'EXTERNAL' | 'BOTH'
  equalLevelId: string | null
}

function collectLevels(
  base: readonly SmcSwingEvent[],
  classified: readonly SmcClassifiedSwingEvent[],
  equalLevels: readonly SmcEqualLevelEvent[],
  config: SmcLiquiditySweepConfig,
  side: 'HIGH' | 'LOW',
): SweepLevel[] {
  const levels: SweepLevel[] = []

  if (classified.length > 0) {
    for (const s of classified) {
      const isHigh = s.kind.includes('HIGH')
      if (side === 'HIGH' && !isHigh) continue
      if (side === 'LOW' && isHigh) continue
      if (config.structureScope === 'INTERNAL' && s.classification !== 'INTERNAL') continue
      if (config.structureScope === 'EXTERNAL' && s.classification !== 'EXTERNAL') continue
      levels.push({
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
      levels.push({
        id: s.id,
        price: s.price,
        confirmedAtIndex: s.confirmedAtIndex,
        candleIndex: s.candleIndex,
        scope: 'BOTH',
        equalLevelId: null,
      })
    }
  }

  for (const eq of equalLevels) {
    if (side === 'HIGH' && eq.kind !== 'EQUAL_HIGHS') continue
    if (side === 'LOW' && eq.kind !== 'EQUAL_LOWS') continue
    levels.push({
      id: eq.id,
      price: eq.level,
      confirmedAtIndex: eq.candleIndex,
      candleIndex: eq.candleIndex,
      scope: config.structureScope,
      equalLevelId: eq.id,
    })
  }

  return levels
}

/**
 * Liquidity sweep detector.
 * Buy-side: trade above level + close back below (not a close-through break).
 * Sell-side: trade below level + close back above.
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
  if (!config.enabled || candles.length === 0) {
    return { events: [] }
  }

  const last = Math.min(visibleThroughIndex, candles.length - 1)
  const events: SmcLiquiditySweepEvent[] = []
  const swept = new Set<string>()

  const buyLevels = collectLevels(baseSwings, classified, equalLevels, config, 'HIGH')
  const sellLevels = collectLevels(baseSwings, classified, equalLevels, config, 'LOW')

  for (let i = 0; i <= last; i++) {
    const candle = candles[i]!

    for (const level of buyLevels) {
      if (level.confirmedAtIndex > i) continue
      if (level.candleIndex >= i) continue
      if (swept.has(level.id)) continue

      const tradedAbove = candle.high > level.price
      const closeThrough = candle.close > level.price
      // Normal close-through break is NOT a sweep.
      if (!tradedAbove || closeThrough) continue

      const penetration = candle.high - level.price
      const penetrationPercent =
        level.price === 0 ? 0 : (penetration / Math.abs(level.price)) * 100
      if (penetrationPercent + 1e-12 < config.minimumPenetrationPercent) continue

      const closeBack = level.price - candle.close
      const closeBackPercent =
        level.price === 0 ? 0 : (closeBack / Math.abs(level.price)) * 100
      if (closeBackPercent > config.maximumCloseDistancePercent + 1e-12) continue

      if (config.requireSameCandleRejection && !(candle.close < level.price)) continue

      let displacementId: string | null = null
      if (config.requireDisplacementAfterSweep) {
        const end = Math.min(last, i + config.displacementConfirmationBars)
        const disp = displacements.find(
          (d) =>
            d.kind === 'BEARISH_DISPLACEMENT' &&
            d.candleIndex > i &&
            d.candleIndex <= end,
        )
        if (!disp) continue
        displacementId = disp.id
      }

      swept.add(level.id)
      events.push({
        id: `sweep-bsl-${i}-${level.id}`,
        kind: 'BUY_SIDE_LIQUIDITY_SWEEP',
        candleIndex: i,
        timestamp: candle.time,
        sweptSwingIds: [level.id],
        sweptLevel: level.price,
        wickExtreme: candle.high,
        close: candle.close,
        penetration,
        penetrationPercent,
        closeBackDistance: closeBack,
        closeBackDistancePercent: closeBackPercent,
        structuralScope: level.scope,
        displacementId,
        equalLevelId: level.equalLevelId,
        reason: [
          `BSL Sweep at index ${i}: high ${candle.high} > level ${level.price},`,
          `close ${candle.close} reclaimed below. Penetration ${penetrationPercent.toFixed(4)}%.`,
        ].join(' '),
        refs: [{ id: level.id, kind: 'SWING_HIGH' }],
        ruleChecks: {
          tradedAbove: true,
          closedBelow: candle.close < level.price,
          notCloseThrough: !closeThrough,
          penetrationOk: penetrationPercent >= config.minimumPenetrationPercent,
        },
      })
    }

    for (const level of sellLevels) {
      if (level.confirmedAtIndex > i) continue
      if (level.candleIndex >= i) continue
      if (swept.has(level.id)) continue

      const tradedBelow = candle.low < level.price
      const closeThrough = candle.close < level.price
      if (!tradedBelow || closeThrough) continue

      const penetration = level.price - candle.low
      const penetrationPercent =
        level.price === 0 ? 0 : (penetration / Math.abs(level.price)) * 100
      if (penetrationPercent + 1e-12 < config.minimumPenetrationPercent) continue

      const closeBack = candle.close - level.price
      const closeBackPercent =
        level.price === 0 ? 0 : (closeBack / Math.abs(level.price)) * 100
      if (closeBackPercent > config.maximumCloseDistancePercent + 1e-12) continue

      if (config.requireSameCandleRejection && !(candle.close > level.price)) continue

      let displacementId: string | null = null
      if (config.requireDisplacementAfterSweep) {
        const end = Math.min(last, i + config.displacementConfirmationBars)
        const disp = displacements.find(
          (d) =>
            d.kind === 'BULLISH_DISPLACEMENT' &&
            d.candleIndex > i &&
            d.candleIndex <= end,
        )
        if (!disp) continue
        displacementId = disp.id
      }

      swept.add(level.id)
      events.push({
        id: `sweep-ssl-${i}-${level.id}`,
        kind: 'SELL_SIDE_LIQUIDITY_SWEEP',
        candleIndex: i,
        timestamp: candle.time,
        sweptSwingIds: [level.id],
        sweptLevel: level.price,
        wickExtreme: candle.low,
        close: candle.close,
        penetration,
        penetrationPercent,
        closeBackDistance: closeBack,
        closeBackDistancePercent: closeBackPercent,
        structuralScope: level.scope,
        displacementId,
        equalLevelId: level.equalLevelId,
        reason: [
          `SSL Sweep at index ${i}: low ${candle.low} < level ${level.price},`,
          `close ${candle.close} reclaimed above. Penetration ${penetrationPercent.toFixed(4)}%.`,
        ].join(' '),
        refs: [{ id: level.id, kind: 'SWING_LOW' }],
        ruleChecks: {
          tradedBelow: true,
          closedAbove: candle.close > level.price,
          notCloseThrough: !closeThrough,
          penetrationOk: penetrationPercent >= config.minimumPenetrationPercent,
        },
      })
    }
  }

  return { events }
}

import type { Candle } from '@/data/candles'
import type { SmcBosConfig, SmcBosEvent, SmcSwingEvent } from './types'

export interface BosDetectionInternal {
  bosEvents: SmcBosEvent[]
  wickOnlyIgnored: number
  repeatedBreaksIgnored: number
}

function selectEligibleSwing(
  swings: readonly SmcSwingEvent[],
  kind: 'SWING_HIGH' | 'SWING_LOW',
  beforeIndex: number,
  requireLatest: boolean,
  alreadyBroken: ReadonlySet<string>,
  allowRepeated: boolean,
): SmcSwingEvent | null {
  const eligible = swings.filter((swing) => {
    if (swing.kind !== kind) return false
    if (swing.confirmedAtIndex >= beforeIndex) return false
    if (swing.candleIndex >= beforeIndex) return false
    if (!allowRepeated && alreadyBroken.has(swing.id)) return false
    return true
  })

  if (eligible.length === 0) return null
  if (requireLatest) {
    return eligible.reduce((latest, swing) =>
      swing.confirmedAtIndex > latest.confirmedAtIndex ||
      (swing.confirmedAtIndex === latest.confirmedAtIndex &&
        swing.candleIndex > latest.candleIndex)
        ? swing
        : latest,
    )
  }
  // When not requiring latest only, still break the most recent eligible first
  // for deterministic ordering — callers iterate candles forward.
  return eligible.reduce((latest, swing) =>
    swing.candleIndex > latest.candleIndex ? swing : latest,
  )
}

/**
 * Detect BOS events using only swings confirmed at or before each break candle.
 * Wick-only breaks (high/low beyond swing without close confirmation) are ignored.
 */
export function detectBreakOfStructure(
  candles: readonly Candle[],
  swings: readonly SmcSwingEvent[],
  config: SmcBosConfig,
  visibleThroughIndex: number,
): BosDetectionInternal {
  if (!config.enabled || candles.length === 0 || swings.length === 0) {
    return { bosEvents: [], wickOnlyIgnored: 0, repeatedBreaksIgnored: 0 }
  }

  const last = Math.min(visibleThroughIndex, candles.length - 1)
  const bosEvents: SmcBosEvent[] = []
  const brokenSwingIds = new Set<string>()
  let wickOnlyIgnored = 0
  let repeatedBreaksIgnored = 0

  for (let i = 0; i <= last; i++) {
    const candle = candles[i]!

    // --- Bullish BOS: close above latest confirmed Swing High ---
    const swingHigh = selectEligibleSwing(
      swings,
      'SWING_HIGH',
      i,
      config.requireLatestConfirmedSwing,
      brokenSwingIds,
      config.allowRepeatedBreaksOfSameSwing,
    )

    if (swingHigh) {
      const wickBreak = candle.high > swingHigh.price
      const closeBreak = candle.close > swingHigh.price
      const breakAmount = candle.close - swingHigh.price
      const breakPercent =
        swingHigh.price === 0 ? 0 : (breakAmount / Math.abs(swingHigh.price)) * 100

      if (wickBreak && !closeBreak) {
        wickOnlyIgnored += 1
      } else if (closeBreak) {
        if (breakPercent + 1e-12 < config.minimumBreakPercent) {
          // Close broke but below threshold — not a valid BOS.
        } else if (!config.allowRepeatedBreaksOfSameSwing && brokenSwingIds.has(swingHigh.id)) {
          repeatedBreaksIgnored += 1
        } else {
          brokenSwingIds.add(swingHigh.id)
          bosEvents.push({
            id: `bos-bull-${i}-${swingHigh.id}`,
            kind: 'BULLISH_BOS',
            candleIndex: i,
            timestamp: candle.time,
            closePrice: candle.close,
            brokenSwingId: swingHigh.id,
            brokenSwingPrice: swingHigh.price,
            brokenSwingTimestamp: swingHigh.timestamp,
            breakAmount,
            breakPercent,
            wickHigh: candle.high,
            wickLow: candle.low,
            wickOnlyIgnored: false,
            reason: [
              `Bullish BOS at index ${i}: close ${candle.close} broke Swing High ${swingHigh.price}`,
              `(swing id ${swingHigh.id}, confirmed ${swingHigh.confirmedAtTimestamp}).`,
              `Break amount ${breakAmount}, break ${breakPercent.toFixed(4)}%.`,
              `Wick high ${candle.high} (wick-only ignored: no).`,
              `Mode=${config.breakMode}, minBreak%=${config.minimumBreakPercent}.`,
            ].join(' '),
          })
        }
      }
    }

    // --- Bearish BOS: close below latest confirmed Swing Low ---
    const swingLow = selectEligibleSwing(
      swings,
      'SWING_LOW',
      i,
      config.requireLatestConfirmedSwing,
      brokenSwingIds,
      config.allowRepeatedBreaksOfSameSwing,
    )

    if (swingLow) {
      const wickBreak = candle.low < swingLow.price
      const closeBreak = candle.close < swingLow.price
      const breakAmount = swingLow.price - candle.close
      const breakPercent =
        swingLow.price === 0 ? 0 : (breakAmount / Math.abs(swingLow.price)) * 100

      if (wickBreak && !closeBreak) {
        wickOnlyIgnored += 1
      } else if (closeBreak) {
        if (breakPercent + 1e-12 < config.minimumBreakPercent) {
          // below threshold
        } else if (!config.allowRepeatedBreaksOfSameSwing && brokenSwingIds.has(swingLow.id)) {
          repeatedBreaksIgnored += 1
        } else {
          brokenSwingIds.add(swingLow.id)
          bosEvents.push({
            id: `bos-bear-${i}-${swingLow.id}`,
            kind: 'BEARISH_BOS',
            candleIndex: i,
            timestamp: candle.time,
            closePrice: candle.close,
            brokenSwingId: swingLow.id,
            brokenSwingPrice: swingLow.price,
            brokenSwingTimestamp: swingLow.timestamp,
            breakAmount,
            breakPercent,
            wickHigh: candle.high,
            wickLow: candle.low,
            wickOnlyIgnored: false,
            reason: [
              `Bearish BOS at index ${i}: close ${candle.close} broke Swing Low ${swingLow.price}`,
              `(swing id ${swingLow.id}, confirmed ${swingLow.confirmedAtTimestamp}).`,
              `Break amount ${breakAmount}, break ${breakPercent.toFixed(4)}%.`,
              `Wick low ${candle.low} (wick-only ignored: no).`,
              `Mode=${config.breakMode}, minBreak%=${config.minimumBreakPercent}.`,
            ].join(' '),
          })
        }
      }
    }
  }

  return { bosEvents, wickOnlyIgnored, repeatedBreaksIgnored }
}

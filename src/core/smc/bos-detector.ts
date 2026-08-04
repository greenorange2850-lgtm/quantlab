import type { Candle } from '@/data/candles'
import type { SmcBosConfig, SmcBosEvent, SmcSwingEvent } from './types'
import { isValidBearishBos, isValidBullishBos } from './invariants'

export interface BosDetectionInternal {
  bosEvents: SmcBosEvent[]
  wickOnlyIgnored: number
  repeatedBreaksIgnored: number
}

function selectEligibleSwing(
  swings: readonly SmcSwingEvent[],
  kind: 'SWING_HIGH' | 'SWING_LOW',
  breakIndex: number,
  requireLatest: boolean,
  alreadyBroken: ReadonlySet<string>,
  allowRepeated: boolean,
): SmcSwingEvent | null {
  const eligible = swings.filter((swing) => {
    if (swing.kind !== kind) return false
    // Swing must be confirmed at or before the break candle (no look-ahead).
    if (swing.confirmedAtIndex > breakIndex) return false
    if (swing.candleIndex >= breakIndex) return false
    if (!allowRepeated && alreadyBroken.has(swing.id)) return false
    return true
  })

  if (eligible.length === 0) return null

  return eligible.reduce((latest, swing) => {
    if (requireLatest) {
      if (swing.confirmedAtIndex > latest.confirmedAtIndex) return swing
      if (
        swing.confirmedAtIndex === latest.confirmedAtIndex &&
        swing.candleIndex > latest.candleIndex
      ) {
        return swing
      }
      return latest
    }
    return swing.candleIndex > latest.candleIndex ? swing : latest
  })
}

function tryEmitBullish(
  candle: Candle,
  index: number,
  swing: SmcSwingEvent,
  config: SmcBosConfig,
  alreadyBroken: Set<string>,
  counters: { wickOnlyIgnored: number; repeatedBreaksIgnored: number },
): SmcBosEvent | null {
  const wickBreak = candle.high > swing.price
  const closeBreak = candle.close > swing.price

  if (wickBreak && !closeBreak) {
    counters.wickOnlyIgnored += 1
    return null
  }
  if (!closeBreak) return null

  if (!isValidBullishBos({
    closePrice: candle.close,
    brokenSwingPrice: swing.price,
    candleIndex: index,
    confirmedAtIndex: swing.confirmedAtIndex,
  })) {
    return null
  }

  const breakAmount = candle.close - swing.price
  const breakPercent =
    swing.price === 0 ? 0 : (breakAmount / Math.abs(swing.price)) * 100
  if (breakPercent + 1e-12 < config.minimumBreakPercent) return null

  if (!config.allowRepeatedBreaksOfSameSwing && alreadyBroken.has(swing.id)) {
    counters.repeatedBreaksIgnored += 1
    return null
  }

  alreadyBroken.add(swing.id)
  return {
    id: `bos-bull-${index}-${swing.id}`,
    kind: 'BULLISH_BOS',
    candleIndex: index,
    timestamp: candle.time,
    closePrice: candle.close,
    brokenSwingId: swing.id,
    brokenSwingPrice: swing.price,
    brokenSwingTimestamp: swing.timestamp,
    brokenSwingCandleIndex: swing.candleIndex,
    brokenSwingConfirmedAtIndex: swing.confirmedAtIndex,
    breakAmount,
    breakPercent,
    wickHigh: candle.high,
    wickLow: candle.low,
    wickOnlyIgnored: false,
    reason: [
      `Bullish BOS at break index ${index} (time ${candle.time}):`,
      `close ${candle.close} > Swing High ${swing.price}`,
      `(swing id ${swing.id}, swing index ${swing.candleIndex}, confirmed index ${swing.confirmedAtIndex}).`,
      `Break amount ${breakAmount}, break ${breakPercent.toFixed(4)}%.`,
      `Invariant: close > swing AND breakIndex >= confirmIndex.`,
    ].join(' '),
  }
}

function tryEmitBearish(
  candle: Candle,
  index: number,
  swing: SmcSwingEvent,
  config: SmcBosConfig,
  alreadyBroken: Set<string>,
  counters: { wickOnlyIgnored: number; repeatedBreaksIgnored: number },
): SmcBosEvent | null {
  const wickBreak = candle.low < swing.price
  const closeBreak = candle.close < swing.price

  if (wickBreak && !closeBreak) {
    counters.wickOnlyIgnored += 1
    return null
  }
  if (!closeBreak) return null

  if (!isValidBearishBos({
    closePrice: candle.close,
    brokenSwingPrice: swing.price,
    candleIndex: index,
    confirmedAtIndex: swing.confirmedAtIndex,
  })) {
    return null
  }

  const breakAmount = swing.price - candle.close
  const breakPercent =
    swing.price === 0 ? 0 : (breakAmount / Math.abs(swing.price)) * 100
  if (breakPercent + 1e-12 < config.minimumBreakPercent) return null

  if (!config.allowRepeatedBreaksOfSameSwing && alreadyBroken.has(swing.id)) {
    counters.repeatedBreaksIgnored += 1
    return null
  }

  alreadyBroken.add(swing.id)
  return {
    id: `bos-bear-${index}-${swing.id}`,
    kind: 'BEARISH_BOS',
    candleIndex: index,
    timestamp: candle.time,
    closePrice: candle.close,
    brokenSwingId: swing.id,
    brokenSwingPrice: swing.price,
    brokenSwingTimestamp: swing.timestamp,
    brokenSwingCandleIndex: swing.candleIndex,
    brokenSwingConfirmedAtIndex: swing.confirmedAtIndex,
    breakAmount,
    breakPercent,
    wickHigh: candle.high,
    wickLow: candle.low,
    wickOnlyIgnored: false,
    reason: [
      `Bearish BOS at break index ${index} (time ${candle.time}):`,
      `close ${candle.close} < Swing Low ${swing.price}`,
      `(swing id ${swing.id}, swing index ${swing.candleIndex}, confirmed index ${swing.confirmedAtIndex}).`,
      `Break amount ${breakAmount}, break ${breakPercent.toFixed(4)}%.`,
      `Invariant: close < swing AND breakIndex >= confirmIndex.`,
    ].join(' '),
  }
}

/**
 * Detect BOS events using only swings confirmed at or before each break candle.
 * Wick-only breaks are ignored. Hard price invariants are enforced before emit.
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
  const counters = { wickOnlyIgnored: 0, repeatedBreaksIgnored: 0 }

  for (let i = 0; i <= last; i++) {
    const candle = candles[i]!

    const swingHigh = selectEligibleSwing(
      swings,
      'SWING_HIGH',
      i,
      config.requireLatestConfirmedSwing,
      brokenSwingIds,
      config.allowRepeatedBreaksOfSameSwing,
    )
    if (swingHigh) {
      const event = tryEmitBullish(candle, i, swingHigh, config, brokenSwingIds, counters)
      if (event) bosEvents.push(event)
    }

    const swingLow = selectEligibleSwing(
      swings,
      'SWING_LOW',
      i,
      config.requireLatestConfirmedSwing,
      brokenSwingIds,
      config.allowRepeatedBreaksOfSameSwing,
    )
    if (swingLow) {
      const event = tryEmitBearish(candle, i, swingLow, config, brokenSwingIds, counters)
      if (event) bosEvents.push(event)
    }
  }

  return {
    bosEvents,
    wickOnlyIgnored: counters.wickOnlyIgnored,
    repeatedBreaksIgnored: counters.repeatedBreaksIgnored,
  }
}

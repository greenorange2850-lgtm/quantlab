import type { Candle } from '@/data/candles'
import { detectBreakOfStructure } from './bos-detector'
import { isDisplacementCandleAt } from './displacement-detector'
import { isValidBearishBos, isValidBullishBos } from './invariants'
import type {
  SmcBosConfig,
  SmcBosEvent,
  SmcChochConfig,
  SmcChochEvent,
  SmcClassifiedSwingEvent,
  SmcDisplacementConfig,
  SmcStructureState,
  SmcSwingClassification,
  SmcSwingEvent,
} from './types'

export interface StructureBreakInternal {
  bosEvents: SmcBosEvent[]
  chochEvents: SmcChochEvent[]
  structureState: SmcStructureState
  wickOnlyIgnored: number
  repeatedBreaksIgnored: number
}

function classificationOf(
  swing: SmcSwingEvent,
  classified: readonly SmcClassifiedSwingEvent[],
): SmcSwingClassification {
  if (swing.classification && swing.classification !== 'UNCLASSIFIED') {
    return swing.classification
  }
  const match = classified.find(
    (c) => c.originalSwingId === swing.id || c.candleIndex === swing.candleIndex,
  )
  return match?.classification ?? 'UNCLASSIFIED'
}

function swingInScope(
  classification: SmcSwingClassification,
  scope: SmcBosConfig['structureScope'] | SmcChochConfig['structureScope'],
  preferExternal: boolean,
): boolean {
  if (scope === 'BASE') return true
  if (scope === 'BOTH') {
    if (preferExternal) return classification === 'EXTERNAL' || classification === 'UNCLASSIFIED'
    return true
  }
  if (scope === 'EXTERNAL') {
    return classification === 'EXTERNAL' || classification === 'UNCLASSIFIED'
  }
  if (scope === 'INTERNAL') {
    return classification === 'INTERNAL' || classification === 'UNCLASSIFIED'
  }
  return true
}

function selectEligibleSwing(
  swings: readonly SmcSwingEvent[],
  classified: readonly SmcClassifiedSwingEvent[],
  kind: 'SWING_HIGH' | 'SWING_LOW',
  breakIndex: number,
  requireLatest: boolean,
  alreadyBroken: ReadonlySet<string>,
  allowRepeated: boolean,
  scope: SmcBosConfig['structureScope'],
  preferExternal: boolean,
): SmcSwingEvent | null {
  const eligible = swings.filter((swing) => {
    if (swing.kind !== kind) return false
    if (swing.confirmedAtIndex > breakIndex) return false
    if (swing.candleIndex >= breakIndex) return false
    if (!allowRepeated && alreadyBroken.has(swing.id)) return false
    const cls = classificationOf(swing, classified)
    return swingInScope(cls, scope, preferExternal)
  })

  if (eligible.length === 0) return null

  if (preferExternal) {
    const externals = eligible.filter(
      (s) => classificationOf(s, classified) === 'EXTERNAL',
    )
    const pool = externals.length > 0 ? externals : eligible
    return pool.reduce((latest, swing) => {
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

function displacementSatisfied(
  candles: readonly Candle[],
  breakIndex: number,
  bullish: boolean,
  chochConfig: SmcChochConfig,
  displacementConfig: SmcDisplacementConfig | null,
): boolean {
  if (!chochConfig.requireDisplacement) return true
  if (!displacementConfig) return false
  // Evaluate break-candle geometry inline (module order: displacement events come later).
  return isDisplacementCandleAt(
    candles,
    breakIndex,
    displacementConfig,
    bullish ? 'BULLISH' : 'BEARISH',
  )
}

/**
 * Joint BOS / CHoCH detection with structural bias.
 * - UNDETERMINED: first qualifying break is BOS and establishes bias.
 * - Same direction continuation: BOS.
 * - First opposing break: CHoCH (requires established opposing structure).
 * Same swing cannot emit both BOS and CHoCH.
 *
 * When CHoCH is disabled, falls back to Phase-1 BOS detector unchanged.
 */
export function detectStructureBreaks(
  candles: readonly Candle[],
  swings: readonly SmcSwingEvent[],
  classified: readonly SmcClassifiedSwingEvent[],
  bosConfig: SmcBosConfig,
  chochConfig: SmcChochConfig,
  visibleThroughIndex: number,
  displacementConfig: SmcDisplacementConfig | null = null,
): StructureBreakInternal {
  if (!bosConfig.enabled && !chochConfig.enabled) {
    return {
      bosEvents: [],
      chochEvents: [],
      structureState: 'UNDETERMINED_STRUCTURE',
      wickOnlyIgnored: 0,
      repeatedBreaksIgnored: 0,
    }
  }

  // Preserve Phase-1 BOS path when CHoCH module is off.
  if (!chochConfig.enabled) {
    const bosResult = detectBreakOfStructure(
      candles,
      swings,
      bosConfig,
      visibleThroughIndex,
    )
    return {
      bosEvents: bosResult.bosEvents.map((e) => ({
        ...e,
        refs: [{ id: e.brokenSwingId, kind: e.kind === 'BULLISH_BOS' ? 'SWING_HIGH' : 'SWING_LOW' }],
        previousStructureState: 'UNDETERMINED_STRUCTURE',
        newStructureState:
          e.kind === 'BULLISH_BOS' ? 'BULLISH_STRUCTURE' : 'BEARISH_STRUCTURE',
      })),
      chochEvents: [],
      structureState: 'UNDETERMINED_STRUCTURE',
      wickOnlyIgnored: bosResult.wickOnlyIgnored,
      repeatedBreaksIgnored: bosResult.repeatedBreaksIgnored,
    }
  }

  if (candles.length === 0 || swings.length === 0) {
    return {
      bosEvents: [],
      chochEvents: [],
      structureState: 'UNDETERMINED_STRUCTURE',
      wickOnlyIgnored: 0,
      repeatedBreaksIgnored: 0,
    }
  }

  const last = Math.min(visibleThroughIndex, candles.length - 1)
  const bosEvents: SmcBosEvent[] = []
  const chochEvents: SmcChochEvent[] = []
  const brokenSwingIds = new Set<string>()
  let structureState: SmcStructureState = 'UNDETERMINED_STRUCTURE'
  const counters = { wickOnlyIgnored: 0, repeatedBreaksIgnored: 0 }

  for (let i = 0; i <= last; i++) {
    const candle = candles[i]!

    // Bullish break candidate (close > swing high)
    if (bosConfig.enabled || chochConfig.enabled) {
      const scope = structureState === 'BEARISH_STRUCTURE' ? chochConfig.structureScope : bosConfig.structureScope
      const preferExt =
        structureState === 'BEARISH_STRUCTURE'
          ? chochConfig.preferExternalSwings
          : bosConfig.preferExternalSwings
      const requireLatest =
        structureState === 'BEARISH_STRUCTURE'
          ? chochConfig.requireLatestConfirmedSwing
          : bosConfig.requireLatestConfirmedSwing
      const minBreak =
        structureState === 'BEARISH_STRUCTURE'
          ? chochConfig.minimumBreakPercent
          : bosConfig.minimumBreakPercent

      const swingHigh = selectEligibleSwing(
        swings,
        classified,
        'SWING_HIGH',
        i,
        requireLatest,
        brokenSwingIds,
        bosConfig.allowRepeatedBreaksOfSameSwing,
        scope,
        preferExt,
      )

      if (swingHigh) {
        const wickBreak = candle.high > swingHigh.price
        const closeBreak = candle.close > swingHigh.price
        if (wickBreak && !closeBreak) {
          counters.wickOnlyIgnored += 1
        } else if (
          closeBreak &&
          isValidBullishBos({
            closePrice: candle.close,
            brokenSwingPrice: swingHigh.price,
            candleIndex: i,
            confirmedAtIndex: swingHigh.confirmedAtIndex,
          })
        ) {
          const breakAmount = candle.close - swingHigh.price
          const breakPercent =
            swingHigh.price === 0 ? 0 : (breakAmount / Math.abs(swingHigh.price)) * 100
          if (breakPercent + 1e-12 >= minBreak) {
            const cls = classificationOf(swingHigh, classified)
            const isOpposing = structureState === 'BEARISH_STRUCTURE'
            const isContinuation =
              structureState === 'BULLISH_STRUCTURE' ||
              structureState === 'UNDETERMINED_STRUCTURE'

            if (isOpposing && chochConfig.enabled) {
              if (!displacementSatisfied(candles, i, true, chochConfig, displacementConfig)) {
                // Skip — displacement requirement not met on break candle.
              } else if (!brokenSwingIds.has(swingHigh.id) || bosConfig.allowRepeatedBreaksOfSameSwing) {
                brokenSwingIds.add(swingHigh.id)
                const prev = structureState
                structureState = 'BULLISH_STRUCTURE'
                chochEvents.push({
                  id: `choch-bull-${i}-${swingHigh.id}`,
                  kind: 'BULLISH_CHOCH',
                  candleIndex: i,
                  timestamp: candle.time,
                  closePrice: candle.close,
                  brokenSwingId: swingHigh.id,
                  brokenSwingPrice: swingHigh.price,
                  brokenSwingTimestamp: swingHigh.timestamp,
                  brokenSwingCandleIndex: swingHigh.candleIndex,
                  brokenSwingConfirmedAtIndex: swingHigh.confirmedAtIndex,
                  brokenSwingClassification: cls,
                  structureScope: chochConfig.structureScope,
                  previousStructureState: prev,
                  newProvisionalStructureState: 'BULLISH_STRUCTURE',
                  breakAmount,
                  breakPercent,
                  wickHigh: candle.high,
                  wickLow: candle.low,
                  reason: [
                    `Bullish CHoCH at break index ${i}: close ${candle.close} > Swing High ${swingHigh.price}.`,
                    `Prior structure ${prev}; provisional ${structureState}.`,
                    `Broken swing ${swingHigh.id} (${cls}) confirmed at ${swingHigh.confirmedAtIndex}.`,
                  ].join(' '),
                  refs: [{ id: swingHigh.id, kind: swingHigh.kind }],
                  ruleChecks: {
                    priorBearishStructure: prev === 'BEARISH_STRUCTURE',
                    closeExceedsHigh: candle.close > swingHigh.price,
                    swingConfirmedBeforeBreak: swingHigh.confirmedAtIndex <= i,
                    wickOnlyIgnored: false,
                  },
                })
              }
            } else if (isContinuation && bosConfig.enabled) {
              if (!brokenSwingIds.has(swingHigh.id) || bosConfig.allowRepeatedBreaksOfSameSwing) {
                brokenSwingIds.add(swingHigh.id)
                const prev = structureState
                structureState = 'BULLISH_STRUCTURE'
                bosEvents.push({
                  id: `bos-bull-${i}-${swingHigh.id}`,
                  kind: 'BULLISH_BOS',
                  candleIndex: i,
                  timestamp: candle.time,
                  closePrice: candle.close,
                  brokenSwingId: swingHigh.id,
                  brokenSwingPrice: swingHigh.price,
                  brokenSwingTimestamp: swingHigh.timestamp,
                  brokenSwingCandleIndex: swingHigh.candleIndex,
                  brokenSwingConfirmedAtIndex: swingHigh.confirmedAtIndex,
                  brokenSwingClassification: cls,
                  structureScope: bosConfig.structureScope,
                  previousStructureState: prev,
                  newStructureState: 'BULLISH_STRUCTURE',
                  breakAmount,
                  breakPercent,
                  wickHigh: candle.high,
                  wickLow: candle.low,
                  wickOnlyIgnored: false,
                  reason: [
                    `Bullish BOS at break index ${i} (time ${candle.time}):`,
                    `close ${candle.close} > Swing High ${swingHigh.price}`,
                    `(swing id ${swingHigh.id}, swing index ${swingHigh.candleIndex}, confirmed index ${swingHigh.confirmedAtIndex}).`,
                    `Structure ${prev} → BULLISH_STRUCTURE.`,
                  ].join(' '),
                  refs: [{ id: swingHigh.id, kind: swingHigh.kind }],
                  ruleChecks: {
                    closeExceedsHigh: candle.close > swingHigh.price,
                    swingConfirmedBeforeBreak: swingHigh.confirmedAtIndex <= i,
                    continuationOrInitial: true,
                  },
                })
              } else {
                counters.repeatedBreaksIgnored += 1
              }
            }
          }
        }
      }
    }

    // Bearish break candidate
    if (bosConfig.enabled || chochConfig.enabled) {
      const scope = structureState === 'BULLISH_STRUCTURE' ? chochConfig.structureScope : bosConfig.structureScope
      const preferExt =
        structureState === 'BULLISH_STRUCTURE'
          ? chochConfig.preferExternalSwings
          : bosConfig.preferExternalSwings
      const requireLatest =
        structureState === 'BULLISH_STRUCTURE'
          ? chochConfig.requireLatestConfirmedSwing
          : bosConfig.requireLatestConfirmedSwing
      const minBreak =
        structureState === 'BULLISH_STRUCTURE'
          ? chochConfig.minimumBreakPercent
          : bosConfig.minimumBreakPercent

      const swingLow = selectEligibleSwing(
        swings,
        classified,
        'SWING_LOW',
        i,
        requireLatest,
        brokenSwingIds,
        bosConfig.allowRepeatedBreaksOfSameSwing,
        scope,
        preferExt,
      )

      if (swingLow) {
        const wickBreak = candle.low < swingLow.price
        const closeBreak = candle.close < swingLow.price
        if (wickBreak && !closeBreak) {
          counters.wickOnlyIgnored += 1
        } else if (
          closeBreak &&
          isValidBearishBos({
            closePrice: candle.close,
            brokenSwingPrice: swingLow.price,
            candleIndex: i,
            confirmedAtIndex: swingLow.confirmedAtIndex,
          })
        ) {
          const breakAmount = swingLow.price - candle.close
          const breakPercent =
            swingLow.price === 0 ? 0 : (breakAmount / Math.abs(swingLow.price)) * 100
          if (breakPercent + 1e-12 >= minBreak) {
            const cls = classificationOf(swingLow, classified)
            const isOpposing = structureState === 'BULLISH_STRUCTURE'
            const isContinuation =
              structureState === 'BEARISH_STRUCTURE' ||
              structureState === 'UNDETERMINED_STRUCTURE'

            if (isOpposing && chochConfig.enabled) {
              if (!displacementSatisfied(candles, i, false, chochConfig, displacementConfig)) {
                // skip
              } else if (!brokenSwingIds.has(swingLow.id) || bosConfig.allowRepeatedBreaksOfSameSwing) {
                brokenSwingIds.add(swingLow.id)
                const prev = structureState
                structureState = 'BEARISH_STRUCTURE'
                chochEvents.push({
                  id: `choch-bear-${i}-${swingLow.id}`,
                  kind: 'BEARISH_CHOCH',
                  candleIndex: i,
                  timestamp: candle.time,
                  closePrice: candle.close,
                  brokenSwingId: swingLow.id,
                  brokenSwingPrice: swingLow.price,
                  brokenSwingTimestamp: swingLow.timestamp,
                  brokenSwingCandleIndex: swingLow.candleIndex,
                  brokenSwingConfirmedAtIndex: swingLow.confirmedAtIndex,
                  brokenSwingClassification: cls,
                  structureScope: chochConfig.structureScope,
                  previousStructureState: prev,
                  newProvisionalStructureState: 'BEARISH_STRUCTURE',
                  breakAmount,
                  breakPercent,
                  wickHigh: candle.high,
                  wickLow: candle.low,
                  reason: [
                    `Bearish CHoCH at break index ${i}: close ${candle.close} < Swing Low ${swingLow.price}.`,
                    `Prior structure ${prev}; provisional ${structureState}.`,
                    `Broken swing ${swingLow.id} (${cls}) confirmed at ${swingLow.confirmedAtIndex}.`,
                  ].join(' '),
                  refs: [{ id: swingLow.id, kind: swingLow.kind }],
                  ruleChecks: {
                    priorBullishStructure: prev === 'BULLISH_STRUCTURE',
                    closeBelowLow: candle.close < swingLow.price,
                    swingConfirmedBeforeBreak: swingLow.confirmedAtIndex <= i,
                    wickOnlyIgnored: false,
                  },
                })
              }
            } else if (isContinuation && bosConfig.enabled) {
              if (!brokenSwingIds.has(swingLow.id) || bosConfig.allowRepeatedBreaksOfSameSwing) {
                brokenSwingIds.add(swingLow.id)
                const prev = structureState
                structureState = 'BEARISH_STRUCTURE'
                bosEvents.push({
                  id: `bos-bear-${i}-${swingLow.id}`,
                  kind: 'BEARISH_BOS',
                  candleIndex: i,
                  timestamp: candle.time,
                  closePrice: candle.close,
                  brokenSwingId: swingLow.id,
                  brokenSwingPrice: swingLow.price,
                  brokenSwingTimestamp: swingLow.timestamp,
                  brokenSwingCandleIndex: swingLow.candleIndex,
                  brokenSwingConfirmedAtIndex: swingLow.confirmedAtIndex,
                  brokenSwingClassification: cls,
                  structureScope: bosConfig.structureScope,
                  previousStructureState: prev,
                  newStructureState: 'BEARISH_STRUCTURE',
                  breakAmount,
                  breakPercent,
                  wickHigh: candle.high,
                  wickLow: candle.low,
                  wickOnlyIgnored: false,
                  reason: [
                    `Bearish BOS at break index ${i} (time ${candle.time}):`,
                    `close ${candle.close} < Swing Low ${swingLow.price}`,
                    `(swing id ${swingLow.id}, swing index ${swingLow.candleIndex}, confirmed index ${swingLow.confirmedAtIndex}).`,
                    `Structure ${prev} → BEARISH_STRUCTURE.`,
                  ].join(' '),
                  refs: [{ id: swingLow.id, kind: swingLow.kind }],
                  ruleChecks: {
                    closeBelowLow: candle.close < swingLow.price,
                    swingConfirmedBeforeBreak: swingLow.confirmedAtIndex <= i,
                    continuationOrInitial: true,
                  },
                })
              } else {
                counters.repeatedBreaksIgnored += 1
              }
            }
          }
        }
      }
    }
  }

  return {
    bosEvents,
    chochEvents,
    structureState,
    wickOnlyIgnored: counters.wickOnlyIgnored,
    repeatedBreaksIgnored: counters.repeatedBreaksIgnored,
  }
}

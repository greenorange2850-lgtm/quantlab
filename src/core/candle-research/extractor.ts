import type { Candle } from '@/data/candles'
import {
  candleBody,
  candleRange,
  isBearishCandle,
  isBullishCandle,
  lowerWick,
  upperWick,
} from '@/core/indicators/atr'
import {
  DIRECT_CONSUMPTION_THRESHOLDS,
  type CandleBreakClassification,
  type CandleFeature,
  type DirectConsumptionPenetrationThreshold,
  type ResearchSetup,
} from './types'

const EPSILON = 1e-12

function safeRatio(numerator: number, denominator: number): number {
  return Math.abs(denominator) <= EPSILON ? 0 : numerator / denominator
}

function classifyBreaks(current: Candle, previous: Candle): CandleBreakClassification {
  const brokePreviousHigh = current.high > previous.high + EPSILON
  const brokePreviousLow = current.low < previous.low - EPSILON
  if (brokePreviousHigh && brokePreviousLow) return 'BOTH'
  if (brokePreviousHigh) return 'HIGH_ONLY'
  if (brokePreviousLow) return 'LOW_ONLY'
  return 'NEITHER'
}

function retracementDepthIntoPreviousCandle(current: Candle, previous: Candle): number | null {
  const previousRange = previous.high - previous.low
  if (previousRange <= EPSILON) return null
  const overlapLow = Math.max(current.low, previous.low)
  const overlapHigh = Math.min(current.high, previous.high)
  const overlap = Math.max(0, overlapHigh - overlapLow)
  return safeRatio(overlap, previousRange)
}

export function extractCandleFeatures(candles: readonly Candle[]): CandleFeature[] {
  return candles.map((candle, index) => {
    const previous = index > 0 ? candles[index - 1]! : null
    const bodySize = candleBody(candle)
    const fullRange = candleRange(candle)
    const upWick = upperWick(candle)
    const lowWick = lowerWick(candle)
    const brokePreviousHigh = previous ? candle.high > previous.high + EPSILON : false
    const brokePreviousLow = previous ? candle.low < previous.low - EPSILON : false

    return {
      index,
      candle,
      previousCandle: previous,
      bullish: isBullishCandle(candle),
      bearish: isBearishCandle(candle),
      bodySize,
      fullRange,
      upperWick: upWick,
      lowerWick: lowWick,
      bodyToRangeRatio: safeRatio(bodySize, fullRange),
      upperWickToRangeRatio: safeRatio(upWick, fullRange),
      lowerWickToRangeRatio: safeRatio(lowWick, fullRange),
      brokePreviousHigh,
      brokePreviousLow,
      breakClassification: previous ? classifyBreaks(candle, previous) : 'NEITHER',
      retracementDepthIntoPreviousCandle: previous
        ? retracementDepthIntoPreviousCandle(candle, previous)
        : null,
    }
  })
}

function penetrationIntoBullishReferenceBody(current: Candle, previous: Candle): number {
  const bodyTop = Math.max(previous.open, previous.close)
  const bodyBottom = Math.min(previous.open, previous.close)
  const bodySize = bodyTop - bodyBottom
  if (bodySize <= EPSILON) return 0
  const penetrationPrice = Math.min(current.low, bodyTop) - bodyBottom
  const clamped = Math.max(0, Math.min(bodySize, penetrationPrice))
  return clamped / bodySize
}

function penetrationIntoBearishReferenceBody(current: Candle, previous: Candle): number {
  const bodyTop = Math.max(previous.open, previous.close)
  const bodyBottom = Math.min(previous.open, previous.close)
  const bodySize = bodyTop - bodyBottom
  if (bodySize <= EPSILON) return 0
  const penetrationPrice = Math.min(current.high, bodyTop) - bodyBottom
  const clamped = Math.max(0, Math.min(bodySize, penetrationPrice))
  return clamped / bodySize
}

function makeSetupId(
  setupTime: number,
  referenceTime: number,
  threshold: DirectConsumptionPenetrationThreshold,
  direction: 'bullish-reference' | 'bearish-reference',
): string {
  return `dc:${direction}:${threshold}:${referenceTime}:${setupTime}`
}

function createThresholdSetups(input: {
  setupIndex: number
  setupCandle: Candle
  referenceIndex: number
  referenceCandle: Candle
  referenceDirection: 'bullish-reference' | 'bearish-reference'
  measurementDirection: 'up' | 'down'
  penetrationRatio: number
}): ResearchSetup[] {
  return DIRECT_CONSUMPTION_THRESHOLDS.filter(
    (threshold) => input.penetrationRatio + EPSILON >= threshold / 100,
  ).map((threshold) => ({
    id: makeSetupId(
      input.setupCandle.time,
      input.referenceCandle.time,
      threshold,
      input.referenceDirection,
    ),
    kind: 'direct-consumption' as const,
    setupIndex: input.setupIndex,
    setupTime: input.setupCandle.time,
    setupPrice: input.setupCandle.close,
    referenceIndex: input.referenceIndex,
    referenceTime: input.referenceCandle.time,
    referenceCandle: input.referenceCandle,
    triggerCandle: input.setupCandle,
    referenceDirection: input.referenceDirection,
    measurementDirection: input.measurementDirection,
    penetrationThreshold: threshold,
    penetrationRatio: input.penetrationRatio,
    penetrationPercent: input.penetrationRatio * 100,
  }))
}

/**
 * Direct Consumption detector.
 * Uses only candle N-1 and N to avoid look-ahead.
 */
export function detectDirectConsumptionSetups(candles: readonly Candle[]): ResearchSetup[] {
  const setups: ResearchSetup[] = []

  for (let i = 1; i < candles.length; i++) {
    const previous = candles[i - 1]!
    const current = candles[i]!

    // Bullish reference candle consumed by bearish move into its body.
    if (isBullishCandle(previous) && isBearishCandle(current)) {
      const bodyTop = previous.close
      const enteredBody = current.low < bodyTop - EPSILON && current.high > bodyTop - EPSILON
      if (enteredBody) {
        const penetrationRatio = penetrationIntoBullishReferenceBody(current, previous)
        setups.push(
          ...createThresholdSetups({
            setupIndex: i,
            setupCandle: current,
            referenceIndex: i - 1,
            referenceCandle: previous,
            referenceDirection: 'bullish-reference',
            measurementDirection: 'up',
            penetrationRatio,
          }),
        )
      }
    }

    // Bearish reference candle consumed by bullish move into its body.
    if (isBearishCandle(previous) && isBullishCandle(current)) {
      const bodyBottom = previous.close
      const enteredBody = current.high > bodyBottom + EPSILON && current.low < bodyBottom + EPSILON
      if (enteredBody) {
        const penetrationRatio = penetrationIntoBearishReferenceBody(current, previous)
        setups.push(
          ...createThresholdSetups({
            setupIndex: i,
            setupCandle: current,
            referenceIndex: i - 1,
            referenceCandle: previous,
            referenceDirection: 'bearish-reference',
            measurementDirection: 'down',
            penetrationRatio,
          }),
        )
      }
    }
  }

  return setups
}

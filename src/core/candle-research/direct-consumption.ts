import type { CandleFeature, ResearchSetup } from './types.js'

export const DIRECT_CONSUMPTION_THRESHOLDS = [0.4, 0.5, 0.6, 0.7, 0.8] as const

function normalizeThresholds(thresholds: readonly number[]): number[] {
  return [...thresholds]
    .filter((value) => Number.isFinite(value) && value > 0 && value <= 1)
    .sort((a, b) => a - b)
}

export function detectDirectConsumptionSetups(
  features: readonly CandleFeature[],
  thresholds: readonly number[] = DIRECT_CONSUMPTION_THRESHOLDS,
): ResearchSetup[] {
  const normalizedThresholds = normalizeThresholds(thresholds)
  if (normalizedThresholds.length === 0) return []

  const minimumThreshold = normalizedThresholds[0]!
  const setups: ResearchSetup[] = []

  for (const feature of features) {
    const previous = feature.previous
    if (!previous) continue
    if (feature.retracementDepthIntoPrevious == null) continue

    const penetrationDepth = feature.retracementDepthIntoPrevious
    if (penetrationDepth < minimumThreshold) continue

    const penetrationThresholdsHit = normalizedThresholds.filter((threshold) => penetrationDepth >= threshold)
    if (penetrationThresholdsHit.length === 0) continue

    const isBullishReference =
      previous.direction === 'BULLISH' &&
      feature.bearish &&
      feature.candle.low < previous.close
    const isBearishReference =
      previous.direction === 'BEARISH' &&
      feature.bullish &&
      feature.candle.high > previous.close

    if (!isBullishReference && !isBearishReference) continue

    const referenceType = isBullishReference ? 'BULLISH_REFERENCE' : 'BEARISH_REFERENCE'
    setups.push({
      id: `direct-consumption-${feature.index}-${referenceType}`,
      hypothesis: 'DIRECT_CONSUMPTION',
      candleIndex: feature.index,
      candleTime: feature.candle.time,
      referenceCandleIndex: previous.index,
      referenceCandleTime: previous.time,
      referenceType,
      penetrationDepth,
      penetrationThresholdsHit,
    })
  }

  return setups
}

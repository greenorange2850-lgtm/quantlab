import type {
  DowStructurePhase,
  DowSwingLabel,
  DowTrend,
  SmcDowSwingMeta,
} from './types'

export interface DowTrendInference {
  trend: DowTrend
  strength: number
  structurePhase: DowStructurePhase
}

function lastLabeled(
  metas: readonly SmcDowSwingMeta[],
  layer: 'INTERNAL' | 'EXTERNAL',
  kind: 'HIGH' | 'LOW',
): DowSwingLabel | null {
  for (let i = metas.length - 1; i >= 0; i -= 1) {
    const m = metas[i]!
    if (m.classification === layer && m.kind === kind && m.label != null) {
      return m.label
    }
  }
  return null
}

function labeledOfLayer(
  metas: readonly SmcDowSwingMeta[],
  layer: 'INTERNAL' | 'EXTERNAL',
): DowSwingLabel[] {
  return metas
    .filter((m) => m.classification === layer && m.label != null)
    .map((m) => m.label as DowSwingLabel)
}

function countDirection(labels: readonly DowSwingLabel[]): {
  bullish: number
  bearish: number
} {
  let bullish = 0
  let bearish = 0
  for (const label of labels) {
    if (label === 'HH' || label === 'HL') bullish += 1
    else bearish += 1
  }
  return { bullish, bearish }
}

function structureBias(
  lastHigh: DowSwingLabel | null,
  lastLow: DowSwingLabel | null,
): 'bullish' | 'bearish' | 'mixed' | 'unknown' {
  if (lastHigh === 'HH' && lastLow === 'HL') return 'bullish'
  if (lastHigh === 'LH' && lastLow === 'LL') return 'bearish'
  if (lastHigh == null && lastLow == null) return 'unknown'
  if (lastHigh === 'HH' && lastLow == null) return 'bullish'
  if (lastLow === 'HL' && lastHigh == null) return 'bullish'
  if (lastHigh === 'LH' && lastLow == null) return 'bearish'
  if (lastLow === 'LL' && lastHigh == null) return 'bearish'
  return 'mixed'
}

function priorStructureBias(labels: readonly DowSwingLabel[]): 'bullish' | 'bearish' | 'unknown' {
  // Look at labels excluding the most recent two for prior regime.
  if (labels.length < 4) return 'unknown'
  const prior = labels.slice(0, -2)
  const { bullish, bearish } = countDirection(prior)
  if (bullish >= bearish + 2) return 'bullish'
  if (bearish >= bullish + 2) return 'bearish'
  return 'unknown'
}

/**
 * Infer Dow trend / phase / strength from labeled swing metadata.
 * External labels dominate; internals refine pullback detection.
 */
export function inferDowTrend(metas: readonly SmcDowSwingMeta[]): DowTrendInference {
  const externalLabels = labeledOfLayer(metas, 'EXTERNAL')
  const internalLabels = labeledOfLayer(metas, 'INTERNAL')
  const allLabeled = [...externalLabels, ...internalLabels]

  if (externalLabels.length < 1 && internalLabels.length < 2) {
    return { trend: 'Unknown', strength: 0, structurePhase: 'INSUFFICIENT' }
  }

  const extHigh = lastLabeled(metas, 'EXTERNAL', 'HIGH')
  const extLow = lastLabeled(metas, 'EXTERNAL', 'LOW')
  const intHigh = lastLabeled(metas, 'INTERNAL', 'HIGH')
  const intLow = lastLabeled(metas, 'INTERNAL', 'LOW')

  const primaryBias = structureBias(extHigh, extLow)
  const recentExternal = externalLabels.slice(-6)
  const { bullish: bullExt, bearish: bearExt } = countDirection(
    recentExternal.length > 0 ? recentExternal : allLabeled.slice(-6),
  )
  const prior = priorStructureBias(
    externalLabels.length >= 4 ? externalLabels : allLabeled,
  )

  // Pullback via internal structure against external trend
  const internalPullbackBull =
    primaryBias === 'bullish' && (intHigh === 'LH' || intLow === 'LL')
  const internalPullbackBear =
    primaryBias === 'bearish' && (intHigh === 'HH' || intLow === 'HL')

  let trend: DowTrend
  let structurePhase: DowStructurePhase

  if (primaryBias === 'unknown' && bullExt === 0 && bearExt === 0) {
    trend = 'Unknown'
    structurePhase = 'INSUFFICIENT'
  } else if (
    (prior === 'bullish' && primaryBias === 'bearish') ||
    (prior === 'bearish' && primaryBias === 'bullish')
  ) {
    trend = 'Reversal'
    structurePhase = 'REVERSAL'
  } else if (
    primaryBias === 'mixed' ||
    (bullExt > 0 && bearExt > 0 && Math.abs(bullExt - bearExt) <= 1 && externalLabels.length >= 4)
  ) {
    // Mixed last high/low: distinguish pullback vs range
    if (extHigh === 'LH' && extLow === 'HL') {
      trend = 'Pullback'
      structurePhase = 'PULLBACK'
    } else if (extHigh === 'HH' && extLow === 'LL') {
      trend = 'Pullback'
      structurePhase = 'PULLBACK'
    } else if (internalPullbackBull || internalPullbackBear) {
      trend = 'Pullback'
      structurePhase = 'PULLBACK'
    } else {
      trend = 'Range'
      structurePhase = 'RANGE'
    }
  } else if (primaryBias === 'bullish') {
    if (internalPullbackBull) {
      trend = 'Pullback'
      structurePhase = 'PULLBACK'
    } else {
      trend = 'Bullish'
      structurePhase = 'IMPULSE'
    }
  } else if (primaryBias === 'bearish') {
    if (internalPullbackBear) {
      trend = 'Pullback'
      structurePhase = 'PULLBACK'
    } else {
      trend = 'Bearish'
      structurePhase = 'IMPULSE'
    }
  } else if (bullExt > bearExt) {
    trend = 'Bullish'
    structurePhase = 'IMPULSE'
  } else if (bearExt > bullExt) {
    trend = 'Bearish'
    structurePhase = 'IMPULSE'
  } else {
    trend = 'Range'
    structurePhase = 'RANGE'
  }

  const strength = computeTrendStrength({
    trend,
    externalLabels,
    recentExternal: recentExternal.length > 0 ? recentExternal : allLabeled.slice(-6),
    primaryBias,
  })

  return { trend, strength, structurePhase }
}

function computeTrendStrength(input: {
  trend: DowTrend
  externalLabels: readonly DowSwingLabel[]
  recentExternal: readonly DowSwingLabel[]
  primaryBias: 'bullish' | 'bearish' | 'mixed' | 'unknown'
}): number {
  if (input.trend === 'Unknown') return 0

  const { bullish, bearish } = countDirection(input.recentExternal)
  const dominant = Math.max(bullish, bearish)
  const total = bullish + bearish
  const consistency = total === 0 ? 0 : dominant / total

  let score = 25
  score += Math.round(consistency * 40)

  // Consecutive confirmatory labels at the end
  let streak = 0
  const dir =
    input.trend === 'Bearish' || (input.trend === 'Pullback' && input.primaryBias === 'bearish')
      ? 'bear'
      : input.trend === 'Bullish' ||
          (input.trend === 'Pullback' && input.primaryBias === 'bullish')
        ? 'bull'
        : null
  if (dir) {
    for (let i = input.recentExternal.length - 1; i >= 0; i -= 1) {
      const label = input.recentExternal[i]!
      const ok =
        dir === 'bull' ? label === 'HH' || label === 'HL' : label === 'LH' || label === 'LL'
      if (!ok) break
      streak += 1
    }
  }
  score += Math.min(20, streak * 5)

  if (input.primaryBias === 'bullish' || input.primaryBias === 'bearish') {
    score += 10
  }

  if (input.trend === 'Pullback') score = Math.min(score, 65)
  if (input.trend === 'Range') score = Math.min(score, 45)
  if (input.trend === 'Reversal') score = Math.max(35, Math.min(score, 75))
  if (input.externalLabels.length < 2) score = Math.min(score, 30)

  return Math.max(0, Math.min(100, Math.round(score)))
}

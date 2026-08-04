import type { MovingAverageCrossParams } from '../strategy/MovingAverageCrossStrategy.js'
import type {
  ParameterStabilityDetail,
  RandomSearchCandidate,
  StabilityLevel,
  StabilityResult,
} from './types.js'

const MIN_NEIGHBORHOOD = 3

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2
  }
  return sorted[mid]!
}

function stddev(values: number[]): number | null {
  if (values.length < 2) return null
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

function paramLabel(name: keyof MovingAverageCrossParams): string {
  switch (name) {
    case 'fastPeriod':
      return 'EMA Fast'
    case 'slowPeriod':
      return 'EMA Slow'
    case 'rsiPeriod':
      return 'RSI Period'
  }
}

function analyzeParameter(
  name: keyof MovingAverageCrossParams,
  _center: MovingAverageCrossParams,
  centerScore: number,
  neighbors: RandomSearchCandidate[],
): ParameterStabilityDetail {
  const values = neighbors.map((n) => n.parameters[name])
  const scores = neighbors.map((n) => n.score)
  const neighborhoodCount = neighbors.length

  if (neighborhoodCount < MIN_NEIGHBORHOOD) {
    return {
      name,
      label: paramLabel(name),
      level: 'INSUFFICIENT_EVIDENCE',
      neighborhoodCount,
      valueRangeLabel: null,
      reason: `Fewer than ${MIN_NEIGHBORHOOD} nearby samples for ${paramLabel(name)}.`,
    }
  }

  const minV = Math.min(...values)
  const maxV = Math.max(...values)
  const valueRangeLabel = minV === maxV ? `${minV}` : `${minV}–${maxV}`
  const dispersion = stddev(scores) ?? 0
  const relativeDispersion =
    Math.abs(centerScore) > 1e-9 ? dispersion / Math.abs(centerScore) : dispersion
  const worst = Math.min(...scores)
  const drop = centerScore - worst
  const relativeDrop =
    Math.abs(centerScore) > 1e-9 ? drop / Math.abs(centerScore) : drop

  let level: StabilityLevel
  let reason: string

  if (relativeDrop > 0.35 || relativeDispersion > 0.4) {
    level = 'LOW'
    reason = `Nearby ${paramLabel(name)} values caused a large score decline (worst nearby ${worst.toFixed(2)} vs center ${centerScore.toFixed(2)}).`
  } else if (relativeDrop > 0.15 || relativeDispersion > 0.2) {
    level = 'MEDIUM'
    reason = `Nearby ${paramLabel(name)} values show moderate score variation.`
  } else {
    level = 'HIGH'
    reason = `Nearby ${paramLabel(name)} values remained close to the center score.`
  }

  return {
    name,
    label: paramLabel(name),
    level,
    neighborhoodCount,
    valueRangeLabel,
    reason,
  }
}

/**
 * Deterministic parameter-region stability from evaluated neighbors.
 * Does not invent new financial metrics — uses existing candidate scores only.
 */
export function analyzeStability(
  center: MovingAverageCrossParams,
  centerScore: number,
  neighbors: RandomSearchCandidate[],
): StabilityResult {
  const names: Array<keyof MovingAverageCrossParams> = [
    'fastPeriod',
    'slowPeriod',
    'rsiPeriod',
  ]

  const details = names.map((name) =>
    analyzeParameter(name, center, centerScore, neighbors),
  )

  const scores = neighbors.map((n) => n.score)
  const passRate =
    neighbors.length === 0
      ? null
      : neighbors.filter((n) => n.passedConstraints).length / neighbors.length

  const insufficient = details.filter((d) => d.level === 'INSUFFICIENT_EVIDENCE')
  let overall: StabilityLevel
  if (neighbors.length < MIN_NEIGHBORHOOD || insufficient.length === names.length) {
    overall = 'INSUFFICIENT_EVIDENCE'
  } else if (details.some((d) => d.level === 'LOW')) {
    overall = 'LOW'
  } else if (details.some((d) => d.level === 'MEDIUM' || d.level === 'INSUFFICIENT_EVIDENCE')) {
    overall = 'MEDIUM'
  } else {
    overall = 'HIGH'
  }

  const stable = details.filter((d) => d.level === 'HIGH')
  const sensitive = details.filter((d) => d.level === 'LOW' || d.level === 'MEDIUM')

  const summary =
    overall === 'INSUFFICIENT_EVIDENCE'
      ? 'Not enough nearby samples to assess parameter stability.'
      : overall === 'HIGH'
        ? 'Nearby parameter variations remained reasonably close to the center score.'
        : overall === 'MEDIUM'
          ? 'Some parameters show moderate sensitivity to nearby changes.'
          : 'At least one parameter is highly sensitive — the peak may be isolated.'

  return {
    overall,
    stableParameters: stable,
    sensitiveParameters: sensitive,
    neighborhoodSampleCount: neighbors.length,
    medianNearbyScore: median(scores),
    worstNearbyScore: scores.length ? Math.min(...scores) : null,
    scoreDispersion: stddev(scores),
    nearbyPassRate: passRate,
    summary,
  }
}

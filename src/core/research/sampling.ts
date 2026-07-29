import type { MovingAverageCrossParams } from '../strategy/MovingAverageCrossStrategy.js'
import type { ParameterRange } from './types.js'

export interface RangeValidationIssue {
  field: string
  message: string
}

export function validateParameterRanges(ranges: ParameterRange[]): RangeValidationIssue[] {
  const issues: RangeValidationIssue[] = []

  if (!ranges.length) {
    issues.push({ field: 'parameterRanges', message: 'At least one parameter range is required' })
    return issues
  }

  for (const range of ranges) {
    if (!Number.isFinite(range.min) || !Number.isFinite(range.max) || !Number.isFinite(range.step)) {
      issues.push({ field: range.name, message: `${range.name}: min/max/step must be finite numbers` })
      continue
    }
    if (range.step <= 0) {
      issues.push({ field: range.name, message: `${range.name}: step must be > 0` })
    }
    if (range.max < range.min) {
      issues.push({ field: range.name, message: `${range.name}: max must be ≥ min` })
    }
    if (range.min === range.max && range.step !== 1 && range.step !== range.max - range.min) {
      // single-value ranges are allowed
    }
  }

  return issues
}

export function validateRandomSearchConfig(input: {
  iterations: number
  parameterRanges: ParameterRange[]
}): RangeValidationIssue[] {
  const issues = validateParameterRanges(input.parameterRanges)
  if (!Number.isInteger(input.iterations) || input.iterations < 1) {
    issues.push({ field: 'iterations', message: 'Iterations must be an integer ≥ 1' })
  }
  if (input.iterations > 500) {
    issues.push({ field: 'iterations', message: 'Iterations must be ≤ 500 for this UI' })
  }
  return issues
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function sampleDiscrete(range: ParameterRange, rand: () => number): number {
  if (range.max <= range.min) return range.min
  const steps = Math.floor((range.max - range.min) / range.step)
  const index = Math.min(steps, Math.floor(rand() * (steps + 1)))
  return range.min + index * range.step
}

/**
 * Sample a MA Cross parameter set from configured ranges.
 * Ensures fastPeriod < slowPeriod when both are present.
 */
export function sampleStrategyParams(
  ranges: ParameterRange[],
  seed?: number,
): MovingAverageCrossParams {
  const rand = seed === undefined ? Math.random : mulberry32(seed)
  const byName = new Map(ranges.map((range) => [range.name, range]))

  let fastPeriod = byName.has('fastPeriod')
    ? Math.round(sampleDiscrete(byName.get('fastPeriod')!, rand))
    : 20
  let slowPeriod = byName.has('slowPeriod')
    ? Math.round(sampleDiscrete(byName.get('slowPeriod')!, rand))
    : 50
  const rsiPeriod = byName.has('rsiPeriod')
    ? Math.round(sampleDiscrete(byName.get('rsiPeriod')!, rand))
    : 14

  if (fastPeriod >= slowPeriod) {
    // Swap or nudge so the crossover definition remains valid without changing strategy logic.
    if (fastPeriod === slowPeriod) {
      slowPeriod = fastPeriod + Math.max(1, byName.get('slowPeriod')?.step ?? 1)
    } else {
      const tmp = fastPeriod
      fastPeriod = slowPeriod
      slowPeriod = tmp
    }
  }

  return { fastPeriod, slowPeriod, rsiPeriod }
}

import type { MovingAverageCrossParams } from '../strategy/MovingAverageCrossStrategy.js'
import type { ParameterRange } from './types.js'
import { parameterFingerprint } from './fingerprint.js'

function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function clampToRange(value: number, range: ParameterRange): number {
  const stepped = range.min + Math.round((value - range.min) / range.step) * range.step
  return Math.min(range.max, Math.max(range.min, stepped))
}

function ensureOrdering(params: MovingAverageCrossParams): MovingAverageCrossParams {
  let { fastPeriod, slowPeriod, rsiPeriod } = params
  fastPeriod = Math.round(fastPeriod)
  slowPeriod = Math.round(slowPeriod)
  rsiPeriod = Math.round(rsiPeriod)
  if (fastPeriod >= slowPeriod) {
    slowPeriod = fastPeriod + 1
  }
  return { fastPeriod, slowPeriod, rsiPeriod }
}

function rangeMap(ranges: ParameterRange[]): Map<keyof MovingAverageCrossParams, ParameterRange> {
  return new Map(ranges.map((r) => [r.name, r]))
}

/**
 * Sample neighbors around a center point within configured ranges.
 * Deterministic for a given seed.
 */
export function sampleNeighborhood(
  center: MovingAverageCrossParams,
  ranges: ParameterRange[],
  count: number,
  seed: number,
  exclude: Set<string> = new Set(),
): MovingAverageCrossParams[] {
  const byName = rangeMap(ranges)
  const rand = mulberry32(seed)
  const out: MovingAverageCrossParams[] = []
  const localSeen = new Set<string>(exclude)
  let attempts = 0
  const maxAttempts = Math.max(count * 40, 80)

  while (out.length < count && attempts < maxAttempts) {
    attempts += 1
    const fastRange = byName.get('fastPeriod')
    const slowRange = byName.get('slowPeriod')
    const rsiRange = byName.get('rsiPeriod')

    const fastStep = fastRange?.step ?? 1
    const slowStep = slowRange?.step ?? 1
    const rsiStep = rsiRange?.step ?? 1

    const deltaFast = Math.floor(rand() * 5) - 2 // -2..+2 steps
    const deltaSlow = Math.floor(rand() * 5) - 2
    const deltaRsi = Math.floor(rand() * 5) - 2

    let next: MovingAverageCrossParams = {
      fastPeriod: center.fastPeriod + deltaFast * fastStep,
      slowPeriod: center.slowPeriod + deltaSlow * slowStep,
      rsiPeriod: center.rsiPeriod + deltaRsi * rsiStep,
    }

    if (fastRange) next.fastPeriod = clampToRange(next.fastPeriod, fastRange)
    if (slowRange) next.slowPeriod = clampToRange(next.slowPeriod, slowRange)
    if (rsiRange) next.rsiPeriod = clampToRange(next.rsiPeriod, rsiRange)
    next = ensureOrdering(next)

    const fp = parameterFingerprint(next)
    if (localSeen.has(fp)) continue
    if (
      next.fastPeriod === center.fastPeriod &&
      next.slowPeriod === center.slowPeriod &&
      next.rsiPeriod === center.rsiPeriod
    ) {
      continue
    }
    localSeen.add(fp)
    out.push(next)
  }

  return out
}

/**
 * Deterministic fixed neighbor set used for stability probes around a champion.
 */
export function fixedStabilityNeighbors(
  center: MovingAverageCrossParams,
  ranges: ParameterRange[],
): MovingAverageCrossParams[] {
  const byName = rangeMap(ranges)
  const fastStep = byName.get('fastPeriod')?.step ?? 1
  const slowStep = byName.get('slowPeriod')?.step ?? 1
  const rsiStep = byName.get('rsiPeriod')?.step ?? 1

  const deltas: Array<[number, number, number]> = [
    [-1, -1, -1],
    [-1, 1, 0],
    [0, -1, 1],
    [1, 0, 0],
    [1, 1, 1],
    [-1, 0, 1],
    [0, 1, -1],
    [1, -1, 0],
  ]

  const out: MovingAverageCrossParams[] = []
  const seen = new Set<string>([parameterFingerprint(center)])

  for (const [df, ds, dr] of deltas) {
    let next: MovingAverageCrossParams = {
      fastPeriod: center.fastPeriod + df * fastStep,
      slowPeriod: center.slowPeriod + ds * slowStep,
      rsiPeriod: center.rsiPeriod + dr * rsiStep,
    }
    const fastRange = byName.get('fastPeriod')
    const slowRange = byName.get('slowPeriod')
    const rsiRange = byName.get('rsiPeriod')
    if (fastRange) next.fastPeriod = clampToRange(next.fastPeriod, fastRange)
    if (slowRange) next.slowPeriod = clampToRange(next.slowPeriod, slowRange)
    if (rsiRange) next.rsiPeriod = clampToRange(next.rsiPeriod, rsiRange)
    next = ensureOrdering(next)
    const fp = parameterFingerprint(next)
    if (seen.has(fp)) continue
    seen.add(fp)
    out.push(next)
  }

  return out
}

/**
 * Pick top fraction of eligible candidates, then expand neighborhoods around
 * multiple distinct regions (not only the single best).
 */
export function selectRefinementCenters(
  eligible: Array<{ parameters: MovingAverageCrossParams; score: number }>,
  topFraction = 0.15,
  maxCenters = 8,
): MovingAverageCrossParams[] {
  if (eligible.length === 0) return []
  const ranked = [...eligible].sort((a, b) => b.score - a.score)
  const count = Math.max(
    1,
    Math.min(maxCenters, Math.ceil(ranked.length * topFraction)),
  )

  const centers: MovingAverageCrossParams[] = []
  const fingerprints = new Set<string>()

  for (const item of ranked) {
    if (centers.length >= count) break
    const fp = parameterFingerprint(item.parameters)
    // Skip near-duplicates: identical fingerprint only (region diversity via later sampling).
    if (fingerprints.has(fp)) continue
    fingerprints.add(fp)
    centers.push({ ...item.parameters })
  }

  return centers
}

/** Estimate discrete searchable space size from ranges. */
export function estimateSearchSpaceSize(ranges: ParameterRange[]): number {
  let total = 1
  for (const range of ranges) {
    if (range.max <= range.min) {
      total *= 1
      continue
    }
    const steps = Math.floor((range.max - range.min) / range.step) + 1
    total *= Math.max(1, steps)
  }
  // Ordering constraint reduces space; approximate with 0.5 floor.
  return Math.max(1, Math.floor(total * 0.5))
}

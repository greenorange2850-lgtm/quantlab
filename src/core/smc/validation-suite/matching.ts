import type { SmcDetectionKind } from '../types'
import type {
  SmcDetectedEventProbe,
  SmcEventMatch,
  SmcEventMatchTolerance,
  SmcGoldenLabel,
  SmcValidationModule,
} from './types'
import { DEFAULT_SMC_MATCH_TOLERANCE } from './types'

export function validationModuleForKind(kind: SmcDetectionKind): SmcValidationModule | null {
  if (kind.includes('SWING') || kind === 'EQUAL_HIGHS' || kind === 'EQUAL_LOWS') return 'Swing'
  if (kind.includes('BOS') && !kind.includes('ORDER')) return 'BOS'
  if (kind.includes('CHOCH')) return 'CHoCH'
  if (kind.includes('DISPLACEMENT')) return 'Displacement'
  if (kind.includes('FVG')) return 'FVG'
  if (kind.includes('LIQUIDITY_SWEEP')) return 'Liquidity Sweep'
  if (kind.includes('ORDER_BLOCK')) return 'Order Block'
  if (kind === 'BULLISH_QML' || kind === 'BEARISH_QML') return 'QML'
  return null
}

/**
 * Deterministic pairwise match score in [0, 1].
 * Returns null when hard constraints fail (kind / structure / out of tolerance).
 */
export function scoreEventMatch(
  expected: Pick<
    SmcGoldenLabel,
    'kind' | 'timestamp' | 'price' | 'candleIndex' | 'sourceStructureId'
  >,
  detected: Pick<
    SmcDetectedEventProbe,
    'kind' | 'timestamp' | 'price' | 'candleIndex' | 'sourceStructureId'
  >,
  tolerance: SmcEventMatchTolerance = DEFAULT_SMC_MATCH_TOLERANCE,
): number | null {
  if (expected.kind !== detected.kind) return null

  const tsDelta = Math.abs(expected.timestamp - detected.timestamp)
  if (tsDelta > tolerance.timestampToleranceMs) return null

  const indexDelta = Math.abs(expected.candleIndex - detected.candleIndex)
  if (indexDelta > tolerance.candleIndexTolerance) return null

  const refPrice = Math.abs(expected.price) > 1e-12 ? Math.abs(expected.price) : 1
  const priceDeltaPercent = (Math.abs(expected.price - detected.price) / refPrice) * 100
  if (priceDeltaPercent > tolerance.priceTolerancePercent) return null

  const expStruct = expected.sourceStructureId ?? null
  const detStruct = detected.sourceStructureId ?? null
  if (
    tolerance.requireSourceStructureIdWhenPresent &&
    expStruct != null &&
    detStruct != null &&
    expStruct !== detStruct
  ) {
    return null
  }

  // Higher is better: perfect match → 1.
  const tsScore =
    tolerance.timestampToleranceMs <= 0
      ? 1
      : 1 - tsDelta / Math.max(tolerance.timestampToleranceMs, 1)
  const idxScore =
    tolerance.candleIndexTolerance <= 0
      ? 1
      : 1 - indexDelta / Math.max(tolerance.candleIndexTolerance, 1)
  const priceScore =
    tolerance.priceTolerancePercent <= 0
      ? 1
      : 1 - priceDeltaPercent / Math.max(tolerance.priceTolerancePercent, 1e-9)

  return (tsScore + idxScore + priceScore) / 3
}

/**
 * Greedy one-to-one matching: highest score pairs first (deterministic tie-break by ids).
 */
export function matchGoldenLabels(
  expected: readonly SmcGoldenLabel[],
  detected: readonly SmcDetectedEventProbe[],
  tolerance: SmcEventMatchTolerance = DEFAULT_SMC_MATCH_TOLERANCE,
): {
  matched: SmcEventMatch[]
  missed: SmcGoldenLabel[]
  extra: SmcDetectedEventProbe[]
} {
  type Candidate = {
    expectedId: string
    detectedId: string
    kind: SmcDetectionKind
    module: SmcValidationModule
    score: number
  }

  const candidates: Candidate[] = []
  for (const exp of expected) {
    const module = exp.module
    for (const det of detected) {
      const score = scoreEventMatch(exp, det, tolerance)
      if (score == null) continue
      candidates.push({
        expectedId: exp.id,
        detectedId: det.id,
        kind: exp.kind,
        module,
        score,
      })
    }
  }

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (a.expectedId !== b.expectedId) return a.expectedId.localeCompare(b.expectedId)
    return a.detectedId.localeCompare(b.detectedId)
  })

  const usedExpected = new Set<string>()
  const usedDetected = new Set<string>()
  const matched: SmcEventMatch[] = []

  for (const c of candidates) {
    if (usedExpected.has(c.expectedId) || usedDetected.has(c.detectedId)) continue
    usedExpected.add(c.expectedId)
    usedDetected.add(c.detectedId)
    matched.push({
      expectedId: c.expectedId,
      detectedId: c.detectedId,
      kind: c.kind,
      module: c.module,
      score: c.score,
    })
  }

  matched.sort((a, b) => a.expectedId.localeCompare(b.expectedId))

  const missed = expected
    .filter((e) => !usedExpected.has(e.id))
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
  const extra = detected
    .filter((d) => !usedDetected.has(d.id))
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))

  return { matched, missed, extra }
}

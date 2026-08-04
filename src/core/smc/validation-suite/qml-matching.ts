import type { QmlPattern } from '../qml/qml-types'
import type { SmcDetectedEventProbe, SmcEventMatchTolerance, SmcGoldenLabel } from './types'
import { DEFAULT_SMC_MATCH_TOLERANCE } from './types'
import { qmlPatternToProbe } from './probes'

export interface QmlMatchTolerance extends SmcEventMatchTolerance {
  /** Minimum zone overlap ratio (0–1) required when both sides have zones. */
  zoneOverlapTolerance: number
  /** Absolute retest candle index delta allowed. */
  retestCandleTolerance: number
}

export const DEFAULT_QML_MATCH_TOLERANCE: QmlMatchTolerance = {
  ...DEFAULT_SMC_MATCH_TOLERANCE,
  candleIndexTolerance: 1,
  zoneOverlapTolerance: 0.5,
  retestCandleTolerance: 2,
}

export interface QmlGoldenLabel extends Omit<SmcGoldenLabel, 'kind' | 'module'> {
  kind: 'BULLISH_QML' | 'BEARISH_QML'
  module: 'QML'
  direction: 'BULLISH' | 'BEARISH'
  sourceSwingId: string
  extremeSwingId: string
  structureShiftEventId: string
  zoneLow: number
  zoneHigh: number
  retestIndex?: number
}

function zoneOverlapRatio(
  aLow: number,
  aHigh: number,
  bLow: number,
  bHigh: number,
): number {
  const overlap = Math.max(0, Math.min(aHigh, bHigh) - Math.max(aLow, bLow))
  const union = Math.max(aHigh, bHigh) - Math.min(aLow, bLow)
  if (union <= 0) return 0
  return overlap / union
}

/**
 * Match QML golden labels to detected patterns.
 * Hard constraints: direction, source swing, extreme swing, CHoCH event.
 * Soft: zone overlap + retest candle tolerance.
 */
export function matchQmlGoldenLabels(
  expected: readonly QmlGoldenLabel[],
  patterns: readonly QmlPattern[],
  tolerance: QmlMatchTolerance = DEFAULT_QML_MATCH_TOLERANCE,
): {
  matched: Array<{ expectedId: string; detectedId: string; score: number }>
  missed: QmlGoldenLabel[]
  extra: SmcDetectedEventProbe[]
} {
  const detected = patterns.filter((p) => p.status !== 'CANDIDATE')
  const usedDetected = new Set<string>()
  const usedExpected = new Set<string>()
  const scored: Array<{
    expectedId: string
    detectedId: string
    score: number
  }> = []

  for (const exp of expected) {
    for (const pat of detected) {
      if (pat.direction !== exp.direction) continue
      if (pat.sourceSwingId !== exp.sourceSwingId) continue
      if (pat.extremeSwingId !== exp.extremeSwingId) continue
      if (pat.structureShiftEventId !== exp.structureShiftEventId) continue

      const indexDelta = Math.abs(pat.createdIndex - exp.candleIndex)
      if (indexDelta > tolerance.candleIndexTolerance) continue

      const overlap = zoneOverlapRatio(
        pat.zoneLow,
        pat.zoneHigh,
        exp.zoneLow,
        exp.zoneHigh,
      )
      if (overlap < tolerance.zoneOverlapTolerance) continue

      if (
        exp.retestIndex != null &&
        pat.retestIndex != null &&
        Math.abs(pat.retestIndex - exp.retestIndex) > tolerance.retestCandleTolerance
      ) {
        continue
      }

      const score =
        0.5 +
        0.3 * overlap +
        0.2 * (1 - indexDelta / (tolerance.candleIndexTolerance + 1))
      scored.push({ expectedId: exp.id, detectedId: pat.id, score })
    }
  }

  scored.sort((a, b) => b.score - a.score || a.expectedId.localeCompare(b.expectedId))
  const matched: typeof scored = []
  for (const m of scored) {
    if (usedExpected.has(m.expectedId) || usedDetected.has(m.detectedId)) continue
    usedExpected.add(m.expectedId)
    usedDetected.add(m.detectedId)
    matched.push(m)
  }

  const missed = expected.filter((e) => !usedExpected.has(e.id))
  const extra = detected
    .filter((p) => !usedDetected.has(p.id))
    .map(qmlPatternToProbe)

  return { matched, missed, extra }
}

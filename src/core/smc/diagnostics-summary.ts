import type {
  SmcDetectionResult,
  SmcDiagnosticsSummary,
  SmcStructureBreakCounts,
} from './types'

function breakScope(
  classification: string | undefined,
): 'INTERNAL' | 'EXTERNAL' | 'UNCLASSIFIED' {
  if (classification === 'INTERNAL') return 'INTERNAL'
  if (classification === 'EXTERNAL') return 'EXTERNAL'
  return 'UNCLASSIFIED'
}

export function emptyStructureBreakCounts(): SmcStructureBreakCounts {
  return {
    internalBullishBos: 0,
    internalBearishBos: 0,
    externalBullishBos: 0,
    externalBearishBos: 0,
    unclassifiedBullishBos: 0,
    unclassifiedBearishBos: 0,
    internalBullishChoch: 0,
    internalBearishChoch: 0,
    externalBullishChoch: 0,
    externalBearishChoch: 0,
    unclassifiedBullishChoch: 0,
    unclassifiedBearishChoch: 0,
  }
}

export function countStructureBreaks(result: SmcDetectionResult): SmcStructureBreakCounts {
  const counts = emptyStructureBreakCounts()
  for (const bos of result.bosEvents) {
    const scope = breakScope(bos.brokenSwingClassification)
    if (bos.kind === 'BULLISH_BOS') {
      if (scope === 'INTERNAL') counts.internalBullishBos += 1
      else if (scope === 'EXTERNAL') counts.externalBullishBos += 1
      else counts.unclassifiedBullishBos += 1
    } else if (scope === 'INTERNAL') counts.internalBearishBos += 1
    else if (scope === 'EXTERNAL') counts.externalBearishBos += 1
    else counts.unclassifiedBearishBos += 1
  }
  for (const choch of result.chochEvents) {
    const scope = breakScope(choch.brokenSwingClassification)
    if (choch.kind === 'BULLISH_CHOCH') {
      if (scope === 'INTERNAL') counts.internalBullishChoch += 1
      else if (scope === 'EXTERNAL') counts.externalBullishChoch += 1
      else counts.unclassifiedBullishChoch += 1
    } else if (scope === 'INTERNAL') counts.internalBearishChoch += 1
    else if (scope === 'EXTERNAL') counts.externalBearishChoch += 1
    else counts.unclassifiedBearishChoch += 1
  }
  return counts
}

export function countReviewableEvents(result: SmcDetectionResult): number {
  const useClassified = result.classifiedSwings.length > 0
  const swings = useClassified ? result.classifiedSwings.length : result.swings.length
  const fvgCreated = result.fvgEvents.filter(
    (e) => e.kind === 'BULLISH_FVG_CREATED' || e.kind === 'BEARISH_FVG_CREATED',
  ).length
  const obCreated = result.orderBlockEvents.filter(
    (e) =>
      e.kind === 'BULLISH_ORDER_BLOCK_CREATED' || e.kind === 'BEARISH_ORDER_BLOCK_CREATED',
  ).length
  return (
    swings +
    result.bosEvents.length +
    result.chochEvents.length +
    result.displacementEvents.length +
    fvgCreated +
    result.equalLevelEvents.length +
    result.liquiditySweepEvents.length +
    obCreated
  )
}

export function countLifecycleEvents(result: SmcDetectionResult): number {
  const fvgLife = result.fvgEvents.filter(
    (e) =>
      e.kind === 'FVG_TOUCHED' ||
      e.kind === 'FVG_HALF_FILLED' ||
      e.kind === 'FVG_FULLY_FILLED' ||
      e.kind === 'FVG_INVALIDATED',
  ).length
  const obLife = result.orderBlockEvents.filter(
    (e) =>
      e.kind === 'ORDER_BLOCK_TOUCHED' ||
      e.kind === 'ORDER_BLOCK_MITIGATED' ||
      e.kind === 'ORDER_BLOCK_INVALIDATED',
  ).length
  return fvgLife + obLife
}

export function countTotalEvents(result: SmcDetectionResult): number {
  return (
    result.swings.length +
    result.classifiedSwings.length +
    result.bosEvents.length +
    result.chochEvents.length +
    result.displacementEvents.length +
    result.fvgEvents.length +
    result.equalLevelEvents.length +
    result.liquiditySweepEvents.length +
    result.orderBlockEvents.length
  )
}

export function buildEventCountBreakdownFields(result: SmcDetectionResult) {
  const fvgCreated = result.fvgEvents.filter(
    (e) => e.kind === 'BULLISH_FVG_CREATED' || e.kind === 'BEARISH_FVG_CREATED',
  )
  const obCreated = result.orderBlockEvents.filter(
    (e) =>
      e.kind === 'BULLISH_ORDER_BLOCK_CREATED' || e.kind === 'BEARISH_ORDER_BLOCK_CREATED',
  )
  const reviewable = countReviewableEvents(result)
  const lifecycle = countLifecycleEvents(result)
  return {
    uniqueReviewableEvents: reviewable,
    lifecycleUpdates: lifecycle,
    totalEvents: countTotalEvents(result),
    primaryDetectionEvents: reviewable,
    fvgCreated: fvgCreated.length,
    fvgTouched: result.fvgEvents.filter((e) => e.kind === 'FVG_TOUCHED').length,
    fvgHalfFilled: result.fvgEvents.filter((e) => e.kind === 'FVG_HALF_FILLED').length,
    fvgFullyFilled: result.fvgEvents.filter((e) => e.kind === 'FVG_FULLY_FILLED').length,
    fvgInvalidated: result.fvgEvents.filter((e) => e.kind === 'FVG_INVALIDATED').length,
    uniqueFvgZones: new Set(fvgCreated.map((e) => e.fvgId)).size,
    orderBlockCreated: obCreated.length,
    orderBlockTouched: result.orderBlockEvents.filter((e) => e.kind === 'ORDER_BLOCK_TOUCHED')
      .length,
    orderBlockMitigated: result.orderBlockEvents.filter(
      (e) => e.kind === 'ORDER_BLOCK_MITIGATED',
    ).length,
    orderBlockInvalidated: result.orderBlockEvents.filter(
      (e) => e.kind === 'ORDER_BLOCK_INVALIDATED',
    ).length,
    uniqueOrderBlockZones: new Set(obCreated.map((e) => e.orderBlockId)).size,
    explanation: [
      'Review Summary "Detected" = unique reviewable primary events.',
      'Lifecycle updates (FVG/OB touch/fill/invalidate) are excluded from Detected.',
      'Base swings are excluded when classified internal/external swings exist (avoids double count).',
      'Diagnostics module totals for FVG/OB are unique created zones; sweep totals are unique valid sweeps after canonical dedup.',
      'rawSweepCandidates / duplicatesSuppressed / consumedAttemptsIgnored explain pre-dedup pressure.',
    ].join(' '),
  }
}

export function buildDiagnosticsSummary(
  result: SmcDetectionResult,
  visibleEvents: number,
): SmcDiagnosticsSummary {
  const breaks = countStructureBreaks(result)
  const sweepDiag = result.diagnostics.liquiditySweepDiagnostics
  const invariantFailures = result.diagnostics.invariants
    ? Object.entries(result.diagnostics.invariants)
        .filter(([k, v]) => k !== 'ok' && typeof v === 'number')
        .reduce((sum, [, v]) => sum + (v as number), 0)
    : 0

  return {
    candleCount: result.diagnostics.candleCount,
    uniqueReviewableEvents: countReviewableEvents(result),
    lifecycleUpdates: countLifecycleEvents(result),
    visibleEvents,
    totalEvents: countTotalEvents(result),
    externalSwings: result.diagnostics.externalSwings,
    internalSwings: result.diagnostics.internalSwings,
    externalBos: breaks.externalBullishBos + breaks.externalBearishBos,
    internalBos: breaks.internalBullishBos + breaks.internalBearishBos,
    externalChoch: breaks.externalBullishChoch + breaks.externalBearishChoch,
    internalChoch: breaks.internalBullishChoch + breaks.internalBearishChoch,
    liquidityLevels: sweepDiag.canonicalLevelsConsidered,
    rawSweepCandidates: sweepDiag.rawSweepCandidates,
    uniqueValidSweeps: sweepDiag.validUniqueSweeps,
    duplicateSweepsSuppressed: sweepDiag.duplicateSweepsSuppressed,
    consumedAttemptsIgnored: sweepDiag.consumedLevelAttemptsIgnored,
    invariantFailures,
  }
}

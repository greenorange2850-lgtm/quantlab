import type { SmcDetectionResult, SmcEvent } from '@/core/smc'

const LIFECYCLE_KINDS = new Set([
  'FVG_TOUCHED',
  'FVG_HALF_FILLED',
  'FVG_FULLY_FILLED',
  'FVG_INVALIDATED',
  'ORDER_BLOCK_TOUCHED',
  'ORDER_BLOCK_MITIGATED',
  'ORDER_BLOCK_INVALIDATED',
])

export function isLifecycleEvent(event: SmcEvent): boolean {
  return LIFECYCLE_KINDS.has(event.kind)
}

export function isPrimaryDetectionEvent(event: SmcEvent): boolean {
  if (isLifecycleEvent(event)) return false
  // Base swings are superseded by classified swings when structure layer exists.
  if (
    (event.kind === 'SWING_HIGH' || event.kind === 'SWING_LOW') &&
    // Caller decides via listReviewableEvents whether to include base swings.
    false
  ) {
    return false
  }
  return true
}

/**
 * Unique reviewable events:
 * - Classified swings when present, otherwise base swings (never both)
 * - Primary BOS / CHoCH / Displacement / Equal Levels / Sweeps
 * - FVG created only
 * - Order Block created only
 * Lifecycle/state updates are excluded.
 */
export function listReviewableEvents(detection: SmcDetectionResult): SmcEvent[] {
  const useClassified = detection.classifiedSwings.length > 0
  const swings: SmcEvent[] = useClassified
    ? detection.classifiedSwings
    : detection.swings

  return [
    ...swings,
    ...detection.bosEvents,
    ...detection.chochEvents,
    ...detection.displacementEvents,
    ...detection.fvgEvents.filter(
      (e) => e.kind === 'BULLISH_FVG_CREATED' || e.kind === 'BEARISH_FVG_CREATED',
    ),
    ...detection.equalLevelEvents,
    ...detection.liquiditySweepEvents,
    ...detection.orderBlockEvents.filter(
      (e) =>
        e.kind === 'BULLISH_ORDER_BLOCK_CREATED' ||
        e.kind === 'BEARISH_ORDER_BLOCK_CREATED',
    ),
  ]
}

export function listLifecycleEvents(detection: SmcDetectionResult): SmcEvent[] {
  return [
    ...detection.fvgEvents.filter((e) => isLifecycleEvent(e)),
    ...detection.orderBlockEvents.filter((e) => isLifecycleEvent(e)),
  ]
}

export function listAllEvents(detection: SmcDetectionResult): SmcEvent[] {
  return [
    ...detection.swings,
    ...detection.classifiedSwings,
    ...detection.bosEvents,
    ...detection.chochEvents,
    ...detection.displacementEvents,
    ...detection.fvgEvents,
    ...detection.equalLevelEvents,
    ...detection.liquiditySweepEvents,
    ...detection.orderBlockEvents,
  ]
}

export interface SmcEventCountBreakdown {
  /** Unique reviewable primary detections (Review Summary "Detected"). */
  uniqueReviewableEvents: number
  /** Lifecycle/state update events (touches, fills, invalidations). */
  lifecycleUpdates: number
  /** All stored events including base+classified duplicates and lifecycle. */
  totalEvents: number
  /** Primary detection events (same as reviewable for count purposes). */
  primaryDetectionEvents: number
  fvg: {
    created: number
    touched: number
    halfFilled: number
    fullyFilled: number
    invalidated: number
    uniqueZones: number
  }
  orderBlocks: {
    created: number
    touched: number
    mitigated: number
    invalidated: number
    uniqueZones: number
  }
  structureBreaks: {
    internalBullishBos: number
    internalBearishBos: number
    externalBullishBos: number
    externalBearishBos: number
    unclassifiedBullishBos: number
    unclassifiedBearishBos: number
    internalBullishChoch: number
    internalBearishChoch: number
    externalBullishChoch: number
    externalBearishChoch: number
    unclassifiedBullishChoch: number
    unclassifiedBearishChoch: number
  }
  explanation: string
}

function breakScope(
  classification: string | undefined,
): 'INTERNAL' | 'EXTERNAL' | 'UNCLASSIFIED' {
  if (classification === 'INTERNAL') return 'INTERNAL'
  if (classification === 'EXTERNAL') return 'EXTERNAL'
  return 'UNCLASSIFIED'
}

export function buildEventCountBreakdown(
  detection: SmcDetectionResult,
): SmcEventCountBreakdown {
  const reviewable = listReviewableEvents(detection)
  const lifecycle = listLifecycleEvents(detection)
  const total = listAllEvents(detection)

  const fvgCreated = detection.fvgEvents.filter(
    (e) => e.kind === 'BULLISH_FVG_CREATED' || e.kind === 'BEARISH_FVG_CREATED',
  )
  const obCreated = detection.orderBlockEvents.filter(
    (e) =>
      e.kind === 'BULLISH_ORDER_BLOCK_CREATED' ||
      e.kind === 'BEARISH_ORDER_BLOCK_CREATED',
  )

  const structureBreaks = {
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

  for (const bos of detection.bosEvents) {
    const scope = breakScope(bos.brokenSwingClassification)
    if (bos.kind === 'BULLISH_BOS') {
      if (scope === 'INTERNAL') structureBreaks.internalBullishBos += 1
      else if (scope === 'EXTERNAL') structureBreaks.externalBullishBos += 1
      else structureBreaks.unclassifiedBullishBos += 1
    } else {
      if (scope === 'INTERNAL') structureBreaks.internalBearishBos += 1
      else if (scope === 'EXTERNAL') structureBreaks.externalBearishBos += 1
      else structureBreaks.unclassifiedBearishBos += 1
    }
  }
  for (const choch of detection.chochEvents) {
    const scope = breakScope(choch.brokenSwingClassification)
    if (choch.kind === 'BULLISH_CHOCH') {
      if (scope === 'INTERNAL') structureBreaks.internalBullishChoch += 1
      else if (scope === 'EXTERNAL') structureBreaks.externalBullishChoch += 1
      else structureBreaks.unclassifiedBullishChoch += 1
    } else {
      if (scope === 'INTERNAL') structureBreaks.internalBearishChoch += 1
      else if (scope === 'EXTERNAL') structureBreaks.externalBearishChoch += 1
      else structureBreaks.unclassifiedBearishChoch += 1
    }
  }

  return {
    uniqueReviewableEvents: reviewable.length,
    lifecycleUpdates: lifecycle.length,
    totalEvents: total.length,
    primaryDetectionEvents: reviewable.length,
    fvg: {
      created: fvgCreated.length,
      touched: detection.fvgEvents.filter((e) => e.kind === 'FVG_TOUCHED').length,
      halfFilled: detection.fvgEvents.filter((e) => e.kind === 'FVG_HALF_FILLED').length,
      fullyFilled: detection.fvgEvents.filter((e) => e.kind === 'FVG_FULLY_FILLED').length,
      invalidated: detection.fvgEvents.filter((e) => e.kind === 'FVG_INVALIDATED').length,
      uniqueZones: new Set(fvgCreated.map((e) => e.fvgId)).size,
    },
    orderBlocks: {
      created: obCreated.length,
      touched: detection.orderBlockEvents.filter((e) => e.kind === 'ORDER_BLOCK_TOUCHED')
        .length,
      mitigated: detection.orderBlockEvents.filter((e) => e.kind === 'ORDER_BLOCK_MITIGATED')
        .length,
      invalidated: detection.orderBlockEvents.filter(
        (e) => e.kind === 'ORDER_BLOCK_INVALIDATED',
      ).length,
      uniqueZones: new Set(obCreated.map((e) => e.orderBlockId)).size,
    },
    structureBreaks,
    explanation: [
      'Review Summary "Detected" = unique reviewable primary events.',
      'Lifecycle updates (FVG/OB touch/fill/invalidate) are excluded from Detected.',
      'Base swings are excluded when classified internal/external swings exist (avoids double count).',
      'Diagnostics module totals may list created-zone counts or raw candidates separately from reviewable events.',
    ].join(' '),
  }
}

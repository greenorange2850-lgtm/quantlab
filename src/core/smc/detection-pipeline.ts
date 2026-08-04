import type { Candle } from '@/data/candles'
import { cloneSmcDetectorConfig, DEFAULT_SMC_DETECTOR_CONFIG } from './defaults'
import {
  buildDiagnosticsSummary,
  buildEventCountBreakdownFields,
  countStructureBreaks,
  emptyStructureBreakCounts,
} from './diagnostics-summary'
import { detectDisplacement } from './displacement-detector'
import { detectEqualLevels } from './equal-levels-detector'
import { detectFairValueGaps } from './fvg-detector'
import { sanitizeSmcDetectionResult } from './invariants'
import { detectLiquiditySweeps } from './liquidity-sweep-detector'
import { detectOrderBlocks } from './order-block-detector'
import { analyzeDowTheory, emptyDowTheoryLayer } from './dow-theory'
import { detectQmlPatterns, emptyQmlLayer } from './qml'
import { applySmcIntelligence } from './ranking'
import {
  classifyInternalExternalStructure,
  type StructureClassificationInternal,
} from './structure-classifier'
import { detectStructureBreaks } from './structure-breaks'
import { detectConfirmedSwings } from './swing-detector'
import type {
  SmcDetectionDiagnostics,
  SmcDetectionResult,
  SmcDetectorConfig,
  SmcModuleTiming,
} from './types'
import { SMC_DETECTOR_VERSION } from './types'
import { validateSmcDetectorConfig } from './validation'

function emptyDiagnostics(
  candleCount: number,
  visibleThroughIndex: number | null,
  durationMs: number,
  status: SmcDetectionDiagnostics['detectionStatus'] = 'IDLE',
): SmcDetectionDiagnostics {
  return {
    detectorVersion: SMC_DETECTOR_VERSION,
    candleCount,
    visibleThroughIndex,
    swingCandidatesConsidered: 0,
    confirmedSwings: 0,
    internalSwings: 0,
    externalSwings: 0,
    wickOnlyBreakCandidatesIgnored: 0,
    validBosEvents: 0,
    validChochEvents: 0,
    displacementEvents: 0,
    fvgEvents: 0,
    equalLevelEvents: 0,
    liquiditySweepEvents: 0,
    orderBlockEvents: 0,
    repeatedBreaksIgnored: 0,
    computationDurationMs: durationMs,
    moduleTimings: [],
    maxBlockingDurationMs: durationMs,
    structureState: 'UNDETERMINED_STRUCTURE',
    detectionStatus: status,
    structureBreakCounts: emptyStructureBreakCounts(),
    liquiditySweepDiagnostics: {
      rawSweepCandidates: 0,
      canonicalLevelsConsidered: 0,
      duplicateSweepsSuppressed: 0,
      consumedLevelAttemptsIgnored: 0,
      validUniqueSweeps: 0,
    },
    eventCountBreakdown: {
      uniqueReviewableEvents: 0,
      lifecycleUpdates: 0,
      totalEvents: 0,
      primaryDetectionEvents: 0,
      fvgCreated: 0,
      fvgTouched: 0,
      fvgHalfFilled: 0,
      fvgFullyFilled: 0,
      fvgInvalidated: 0,
      uniqueFvgZones: 0,
      orderBlockCreated: 0,
      orderBlockTouched: 0,
      orderBlockMitigated: 0,
      orderBlockInvalidated: 0,
      uniqueOrderBlockZones: 0,
      explanation: '',
    },
    summary: {
      candleCount,
      uniqueReviewableEvents: 0,
      lifecycleUpdates: 0,
      visibleEvents: 0,
      totalEvents: 0,
      externalSwings: 0,
      internalSwings: 0,
      externalBos: 0,
      internalBos: 0,
      externalChoch: 0,
      internalChoch: 0,
      liquidityLevels: 0,
      rawSweepCandidates: 0,
      uniqueValidSweeps: 0,
      duplicateSweepsSuppressed: 0,
      consumedAttemptsIgnored: 0,
      invariantFailures: 0,
    },
    invariants: {
      invalidBullishBosCount: 0,
      invalidBearishBosCount: 0,
      bosBeforeConfirmationCount: 0,
      repeatedSwingBreakCount: 0,
      invalidBullishChochCount: 0,
      invalidBearishChochCount: 0,
      chochWithoutPriorStructureCount: 0,
      duplicateBreakOfSameSwingCount: 0,
      fvgInvalidGeometryCount: 0,
      sweepWithoutPenetrationCount: 0,
      sweepWithoutCloseReclaimCount: 0,
      repeatedConsumedLevelSweepCount: 0,
      orderBlockAfterSourceBreakCount: 0,
      orderBlockWithoutRequiredDisplacementCount: 0,
      orderBlockWithoutRequiredFvgCount: 0,
      dependencyReferenceMissingCount: 0,
      eventTimestampMismatchCount: 0,
      artificialZeroDisplayValueCount: 0,
      ok: true,
    },
  }
}

export function emptySmcDetectionResult(
  status: SmcDetectionDiagnostics['detectionStatus'] = 'IDLE',
): SmcDetectionResult {
  return {
    swings: [],
    classifiedSwings: [],
    bosEvents: [],
    chochEvents: [],
    displacementEvents: [],
    fvgEvents: [],
    equalLevelEvents: [],
    liquiditySweepEvents: [],
    orderBlockEvents: [],
    structureState: 'UNDETERMINED_STRUCTURE',
    diagnostics: emptyDiagnostics(0, null, 0, status),
  }
}

function runTimed(
  name: string,
  enabled: boolean,
  timings: SmcModuleTiming[],
  fn: () => void,
): number {
  if (!enabled) {
    timings.push({ module: name, durationMs: 0, status: 'skipped' })
    return 0
  }
  const started = performance.now()
  fn()
  const durationMs = performance.now() - started
  timings.push({ module: name, durationMs, status: 'complete' })
  return durationMs
}

/**
 * Progressive detection API — only events knowable by `visibleIndex` (inclusive).
 * Module order:
 * 1 Swings → 2 Structure → 3 Dow Theory → 4 Equal levels → 5/6 BOS/CHoCH →
 * 7 Displacement → 8 FVG → 9 Liquidity Sweep → 10 Order Block →
 * 11 QML (experimental) → 12 mitigation
 */
export function detectSmcUntil(
  candles: readonly Candle[],
  visibleIndex: number,
  config: SmcDetectorConfig = DEFAULT_SMC_DETECTOR_CONFIG,
): SmcDetectionResult {
  const started = performance.now()
  const { config: safe } = validateSmcDetectorConfig(config)
  const timings: SmcModuleTiming[] = []
  let maxBlock = 0

  if (candles.length === 0 || visibleIndex < 0) {
    return {
      ...emptySmcDetectionResult('COMPLETE'),
      diagnostics: emptyDiagnostics(
        candles.length,
        visibleIndex < 0 ? null : visibleIndex,
        0,
        'COMPLETE',
      ),
    }
  }

  const last = Math.min(visibleIndex, candles.length - 1)

  let swingResult = { swings: [] as ReturnType<typeof detectConfirmedSwings>['swings'], candidatesConsidered: 0 }
  maxBlock = Math.max(
    maxBlock,
    runTimed('swings', safe.swing.enabled, timings, () => {
      swingResult = detectConfirmedSwings(candles, safe.swing, last)
    }),
  )
  if (!safe.swing.enabled) {
    swingResult = { swings: [], candidatesConsidered: 0 }
  }

  let classified: StructureClassificationInternal = {
    classified: [],
    internal: [],
    external: [],
    annotatedBaseSwings: swingResult.swings.map((s) => ({
      ...s,
      classification: 'UNCLASSIFIED' as const,
    })),
  }
  maxBlock = Math.max(
    maxBlock,
    runTimed('structure', safe.structure.enabled, timings, () => {
      classified = classifyInternalExternalStructure(
        candles,
        swingResult.swings,
        safe.structure,
        last,
      )
    }),
  )

  const annotatedSwings = classified.annotatedBaseSwings

  // Dow Theory — after swing classification, before BOS/CHoCH. Derived only.
  let dowTheory = emptyDowTheoryLayer(last)
  maxBlock = Math.max(
    maxBlock,
    runTimed('dowTheory', true, timings, () => {
      dowTheory = analyzeDowTheory(classified.classified, last)
    }),
  )

  let equalLevels = { events: [] as ReturnType<typeof detectEqualLevels>['events'] }
  maxBlock = Math.max(
    maxBlock,
    runTimed('equalLevels', safe.equalLevels.enabled, timings, () => {
      equalLevels = detectEqualLevels(
        annotatedSwings,
        classified.classified,
        safe.equalLevels,
        last,
      )
    }),
  )

  let breaks: ReturnType<typeof detectStructureBreaks> = {
    bosEvents: [],
    chochEvents: [],
    structureState: 'UNDETERMINED_STRUCTURE',
    wickOnlyIgnored: 0,
    repeatedBreaksIgnored: 0,
  }
  maxBlock = Math.max(
    maxBlock,
    runTimed('bosChoch', safe.bos.enabled || safe.choch.enabled, timings, () => {
      breaks = detectStructureBreaks(
        candles,
        annotatedSwings,
        classified.classified,
        safe.bos,
        safe.choch,
        last,
        safe.displacement.enabled ? safe.displacement : null,
      )
    }),
  )

  const breakEvents = [...breaks.bosEvents, ...breaks.chochEvents]

  let displacement = { events: [] as ReturnType<typeof detectDisplacement>['events'] }
  maxBlock = Math.max(
    maxBlock,
    runTimed('displacement', safe.displacement.enabled, timings, () => {
      displacement = detectDisplacement(candles, safe.displacement, last, breakEvents, [])
    }),
  )

  let fvg = { events: [] as ReturnType<typeof detectFairValueGaps>['events'] }
  maxBlock = Math.max(
    maxBlock,
    runTimed('fvg', safe.fvg.enabled, timings, () => {
      fvg = detectFairValueGaps(candles, safe.fvg, last, displacement.events)
    }),
  )

  if (safe.displacement.enabled && safe.displacement.requireFvgCreation) {
    displacement = detectDisplacement(
      candles,
      safe.displacement,
      last,
      breakEvents,
      fvg.events,
    )
  }

  let sweeps: ReturnType<typeof detectLiquiditySweeps> = {
    events: [],
    diagnostics: {
      rawSweepCandidates: 0,
      canonicalLevelsConsidered: 0,
      duplicateSweepsSuppressed: 0,
      consumedLevelAttemptsIgnored: 0,
      validUniqueSweeps: 0,
    },
  }
  maxBlock = Math.max(
    maxBlock,
    runTimed('liquiditySweep', safe.liquiditySweep.enabled, timings, () => {
      sweeps = detectLiquiditySweeps(
        candles,
        annotatedSwings,
        classified.classified,
        equalLevels.events,
        displacement.events,
        safe.liquiditySweep,
        last,
      )
    }),
  )

  let orderBlocks = { events: [] as ReturnType<typeof detectOrderBlocks>['events'] }
  maxBlock = Math.max(
    maxBlock,
    runTimed('orderBlock', safe.orderBlock.enabled, timings, () => {
      orderBlocks = detectOrderBlocks(
        candles,
        breaks.bosEvents,
        breaks.chochEvents,
        displacement.events,
        fvg.events,
        safe.orderBlock,
        last,
      )
    }),
  )

  // QML — derived layer after structure breaks + optional OB/FVG/sweep context.
  let qml = emptyQmlLayer(last, safe.qml.enabled ? 'SKIPPED' : 'DISABLED')
  maxBlock = Math.max(
    maxBlock,
    runTimed('qml', safe.qml.enabled, timings, () => {
      qml = detectQmlPatterns({
        candles,
        visibleIndex: last,
        config: safe.qml,
        dowTheory,
        swings: annotatedSwings,
        classifiedSwings: classified.classified,
        chochEvents: breaks.chochEvents,
        bosEvents: breaks.bosEvents,
        displacementEvents: displacement.events,
        fvgEvents: fvg.events,
        liquiditySweepEvents: sweeps.events,
        orderBlockEvents: orderBlocks.events,
      })
    }),
  )

  timings.push({ module: 'mitigation', durationMs: 0, status: 'complete' })

  const durationMs = performance.now() - started

  const raw: SmcDetectionResult = {
    swings: annotatedSwings,
    classifiedSwings: classified.classified,
    bosEvents: breaks.bosEvents,
    chochEvents: breaks.chochEvents,
    displacementEvents: displacement.events,
    fvgEvents: fvg.events,
    equalLevelEvents: equalLevels.events,
    liquiditySweepEvents: sweeps.events,
    orderBlockEvents: orderBlocks.events,
    structureState: breaks.structureState,
    dowTheory,
    qml,
    diagnostics: {
      ...emptyDiagnostics(candles.length, last, durationMs, 'COMPLETE'),
      swingCandidatesConsidered: swingResult.candidatesConsidered,
      confirmedSwings: annotatedSwings.length,
      internalSwings: classified.internal.length,
      externalSwings: classified.external.length,
      wickOnlyBreakCandidatesIgnored: breaks.wickOnlyIgnored,
      validBosEvents: breaks.bosEvents.length,
      validChochEvents: breaks.chochEvents.length,
      displacementEvents: displacement.events.length,
      fvgEvents: fvg.events.filter(
        (e) => e.kind === 'BULLISH_FVG_CREATED' || e.kind === 'BEARISH_FVG_CREATED',
      ).length,
      equalLevelEvents: equalLevels.events.length,
      liquiditySweepEvents: sweeps.events.length,
      orderBlockEvents: orderBlocks.events.filter(
        (e) =>
          e.kind === 'BULLISH_ORDER_BLOCK_CREATED' ||
          e.kind === 'BEARISH_ORDER_BLOCK_CREATED',
      ).length,
      repeatedBreaksIgnored: breaks.repeatedBreaksIgnored,
      computationDurationMs: durationMs,
      moduleTimings: timings,
      maxBlockingDurationMs: maxBlock,
      structureState: breaks.structureState,
      liquiditySweepDiagnostics: sweeps.diagnostics,
      detectionStatus: 'COMPLETE',
      dowTheory: dowTheory.diagnostics,
      qml: qml.diagnostics,
    },
  }

  const { result, report } = sanitizeSmcDetectionResult(raw, safe)
  const failed = !report.ok
  const structureBreakCounts = countStructureBreaks(result)
  const eventCountBreakdown = buildEventCountBreakdownFields(result)
  const withCounts: SmcDetectionResult = {
    ...result,
    dowTheory: result.dowTheory ?? dowTheory,
    qml: result.qml ?? qml,
    diagnostics: {
      ...result.diagnostics,
      computationDurationMs: durationMs,
      moduleTimings: timings,
      maxBlockingDurationMs: maxBlock,
      structureState: result.structureState,
      structureBreakCounts,
      liquiditySweepDiagnostics: sweeps.diagnostics,
      eventCountBreakdown,
      detectionStatus: failed ? 'FAILED' : 'COMPLETE',
      dowTheory: (result.dowTheory ?? dowTheory).diagnostics,
      qml: (result.qml ?? qml).diagnostics,
      invariantDetails: report.details,
      invariants: {
        invalidBullishBosCount: report.invalidBullishBosCount,
        invalidBearishBosCount: report.invalidBearishBosCount,
        bosBeforeConfirmationCount: report.bosBeforeConfirmationCount,
        repeatedSwingBreakCount: report.repeatedSwingBreakCount,
        invalidBullishChochCount: report.invalidBullishChochCount,
        invalidBearishChochCount: report.invalidBearishChochCount,
        chochWithoutPriorStructureCount: report.chochWithoutPriorStructureCount,
        duplicateBreakOfSameSwingCount: report.duplicateBreakOfSameSwingCount,
        fvgInvalidGeometryCount: report.fvgInvalidGeometryCount,
        sweepWithoutPenetrationCount: report.sweepWithoutPenetrationCount,
        sweepWithoutCloseReclaimCount: report.sweepWithoutCloseReclaimCount,
        repeatedConsumedLevelSweepCount: report.repeatedConsumedLevelSweepCount,
        orderBlockAfterSourceBreakCount: report.orderBlockAfterSourceBreakCount,
        orderBlockWithoutRequiredDisplacementCount:
          report.orderBlockWithoutRequiredDisplacementCount,
        orderBlockWithoutRequiredFvgCount: report.orderBlockWithoutRequiredFvgCount,
        dependencyReferenceMissingCount: report.dependencyReferenceMissingCount,
        eventTimestampMismatchCount: report.eventTimestampMismatchCount,
        artificialZeroDisplayValueCount: report.artificialZeroDisplayValueCount,
        ok: report.ok,
      },
      summary: {
        candleCount: candles.length,
        uniqueReviewableEvents: 0,
        lifecycleUpdates: 0,
        visibleEvents: 0,
        totalEvents: 0,
        externalSwings: 0,
        internalSwings: 0,
        externalBos: 0,
        internalBos: 0,
        externalChoch: 0,
        internalChoch: 0,
        liquidityLevels: 0,
        rawSweepCandidates: 0,
        uniqueValidSweeps: 0,
        duplicateSweepsSuppressed: 0,
        consumedAttemptsIgnored: 0,
        invariantFailures: 0,
      },
    },
  }

  return applySmcIntelligence(
    {
      ...withCounts,
      diagnostics: {
        ...withCounts.diagnostics,
        summary: buildDiagnosticsSummary(withCounts, eventCountBreakdown.uniqueReviewableEvents),
      },
    },
    'balanced',
  )
}

/** Full-history detection — equivalent to detectSmcUntil(..., candles.length - 1). */
export function detectSmc(
  candles: readonly Candle[],
  config: SmcDetectorConfig = DEFAULT_SMC_DETECTOR_CONFIG,
): SmcDetectionResult {
  if (candles.length === 0) {
    return emptySmcDetectionResult('COMPLETE')
  }
  return detectSmcUntil(candles, candles.length - 1, config)
}

export function resolveSmcConfig(
  partial?: Partial<SmcDetectorConfig> | null,
): SmcDetectorConfig {
  if (!partial) return cloneSmcDetectorConfig()
  return validateSmcDetectorConfig(partial).config
}

/** Collect all events knowable at a candle for profile comparison. */
export function eventsAtCandle(
  result: SmcDetectionResult,
  candleIndex: number,
): Array<{ id: string; kind: string }> {
  const all = [
    ...result.swings,
    ...result.classifiedSwings,
    ...result.bosEvents,
    ...result.chochEvents,
    ...result.displacementEvents,
    ...result.fvgEvents,
    ...result.equalLevelEvents,
    ...result.liquiditySweepEvents,
    ...result.orderBlockEvents,
  ]
  return all
    .filter((e) => e.candleIndex === candleIndex)
    .map((e) => ({ id: e.id, kind: e.kind }))
}

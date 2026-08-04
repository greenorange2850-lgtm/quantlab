import type {
  SmcBosEvent,
  SmcDetectionResult,
  SmcDetectorConfig,
  SmcSwingEvent,
} from './types'

export interface SmcInvariantReport {
  invalidBullishBosCount: number
  invalidBearishBosCount: number
  bosBeforeConfirmationCount: number
  repeatedSwingBreakCount: number
  invalidBullishChochCount: number
  invalidBearishChochCount: number
  chochWithoutPriorStructureCount: number
  duplicateBreakOfSameSwingCount: number
  fvgInvalidGeometryCount: number
  sweepWithoutPenetrationCount: number
  sweepWithoutCloseReclaimCount: number
  repeatedConsumedLevelSweepCount: number
  orderBlockAfterSourceBreakCount: number
  orderBlockWithoutRequiredDisplacementCount: number
  orderBlockWithoutRequiredFvgCount: number
  dependencyReferenceMissingCount: number
  eventTimestampMismatchCount: number
  artificialZeroDisplayValueCount: number
  /** True only when every count is zero. */
  ok: boolean
  details: string[]
}

function emptyReport(): SmcInvariantReport {
  return {
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
    details: [],
  }
}

function finalize(report: SmcInvariantReport): SmcInvariantReport {
  report.ok =
    report.invalidBullishBosCount === 0 &&
    report.invalidBearishBosCount === 0 &&
    report.bosBeforeConfirmationCount === 0 &&
    report.repeatedSwingBreakCount === 0 &&
    report.invalidBullishChochCount === 0 &&
    report.invalidBearishChochCount === 0 &&
    report.chochWithoutPriorStructureCount === 0 &&
    report.duplicateBreakOfSameSwingCount === 0 &&
    report.fvgInvalidGeometryCount === 0 &&
    report.sweepWithoutPenetrationCount === 0 &&
    report.sweepWithoutCloseReclaimCount === 0 &&
    report.repeatedConsumedLevelSweepCount === 0 &&
    report.orderBlockAfterSourceBreakCount === 0 &&
    report.orderBlockWithoutRequiredDisplacementCount === 0 &&
    report.orderBlockWithoutRequiredFvgCount === 0 &&
    report.dependencyReferenceMissingCount === 0 &&
    report.eventTimestampMismatchCount === 0 &&
    report.artificialZeroDisplayValueCount === 0
  return report
}

/**
 * Hard invariants for SMC detection correctness.
 * A bullish close of 64489.98 against a swing high of 64700 MUST fail.
 */
export function auditSmcInvariants(
  result: SmcDetectionResult,
  config: SmcDetectorConfig,
  candles?: ReadonlyArray<{ time: number; close: number; high?: number; low?: number }>,
): SmcInvariantReport {
  const report = emptyReport()
  const swings = result.swings ?? []
  const classifiedSwings = result.classifiedSwings ?? []
  const bosEvents = result.bosEvents ?? []
  const chochEvents = result.chochEvents ?? []
  const displacementEvents = result.displacementEvents ?? []
  const fvgEvents = result.fvgEvents ?? []
  const equalLevelEvents = result.equalLevelEvents ?? []
  const liquiditySweepEvents = result.liquiditySweepEvents ?? []
  const orderBlockEvents = result.orderBlockEvents ?? []

  const swingsById = new Map(swings.map((s) => [s.id, s]))
  const allIds = new Set<string>([
    ...swings.map((s) => s.id),
    ...classifiedSwings.map((s) => s.id),
    ...bosEvents.map((s) => s.id),
    ...chochEvents.map((s) => s.id),
    ...displacementEvents.map((s) => s.id),
    ...fvgEvents.map((s) => s.id),
    ...equalLevelEvents.map((s) => s.id),
    ...liquiditySweepEvents.map((s) => s.id),
    ...orderBlockEvents.map((s) => s.id),
  ])

  const brokenCounts = new Map<string, number>()

  for (const bos of bosEvents) {
    const swing = swingsById.get(bos.brokenSwingId)
    brokenCounts.set(bos.brokenSwingId, (brokenCounts.get(bos.brokenSwingId) ?? 0) + 1)

    if (bos.kind === 'BULLISH_BOS') {
      if (!(bos.closePrice > bos.brokenSwingPrice)) {
        report.invalidBullishBosCount += 1
        report.details.push(
          `Invalid bullish BOS ${bos.id}: close ${bos.closePrice} <= swing ${bos.brokenSwingPrice}`,
        )
      }
      if (swing && swing.kind !== 'SWING_HIGH') {
        report.invalidBullishBosCount += 1
        report.details.push(`Bullish BOS ${bos.id} references non-SH ${bos.brokenSwingId}`)
      }
    }

    if (bos.kind === 'BEARISH_BOS') {
      if (!(bos.closePrice < bos.brokenSwingPrice)) {
        report.invalidBearishBosCount += 1
        report.details.push(
          `Invalid bearish BOS ${bos.id}: close ${bos.closePrice} >= swing ${bos.brokenSwingPrice}`,
        )
      }
      if (swing && swing.kind !== 'SWING_LOW') {
        report.invalidBearishBosCount += 1
        report.details.push(`Bearish BOS ${bos.id} references non-SL ${bos.brokenSwingId}`)
      }
    }

    const confirmIndex = bos.brokenSwingConfirmedAtIndex ?? swing?.confirmedAtIndex
    if (confirmIndex != null && bos.candleIndex < confirmIndex) {
      report.bosBeforeConfirmationCount += 1
      report.details.push(
        `BOS ${bos.id} at index ${bos.candleIndex} before confirmation ${confirmIndex}`,
      )
    }

    if (bos.timestamp === bos.brokenSwingTimestamp && bos.candleIndex !== bos.brokenSwingCandleIndex) {
      report.eventTimestampMismatchCount += 1
      report.details.push(
        `BOS ${bos.id} timestamp equals swing timestamp but indices differ`,
      )
    }

    if (candles) {
      const breakCandle = candles[bos.candleIndex]
      if (breakCandle && breakCandle.time !== bos.timestamp) {
        report.eventTimestampMismatchCount += 1
        report.details.push(
          `BOS ${bos.id} timestamp ${bos.timestamp} != candle time ${breakCandle.time}`,
        )
      }
      if (breakCandle && Math.abs(breakCandle.close - bos.closePrice) > 1e-9) {
        report.eventTimestampMismatchCount += 1
        report.details.push(
          `BOS ${bos.id} closePrice ${bos.closePrice} != candle close ${breakCandle.close}`,
        )
      }
    }

    if (bos.refs) {
      for (const ref of bos.refs) {
        if (!allIds.has(ref.id) && !swingsById.has(ref.id)) {
          report.dependencyReferenceMissingCount += 1
          report.details.push(`BOS ${bos.id} missing ref ${ref.id}`)
        }
      }
    }
  }

  for (const choch of chochEvents) {
    brokenCounts.set(choch.brokenSwingId, (brokenCounts.get(choch.brokenSwingId) ?? 0) + 1)

    if (
      choch.previousStructureState === 'UNDETERMINED_STRUCTURE' ||
      (choch.kind === 'BULLISH_CHOCH' && choch.previousStructureState !== 'BEARISH_STRUCTURE') ||
      (choch.kind === 'BEARISH_CHOCH' && choch.previousStructureState !== 'BULLISH_STRUCTURE')
    ) {
      report.chochWithoutPriorStructureCount += 1
      report.details.push(`CHoCH ${choch.id} without valid prior opposing structure`)
    }

    if (choch.kind === 'BULLISH_CHOCH' && !(choch.closePrice > choch.brokenSwingPrice)) {
      report.invalidBullishChochCount += 1
      report.details.push(`Invalid bullish CHoCH ${choch.id}`)
    }
    if (choch.kind === 'BEARISH_CHOCH' && !(choch.closePrice < choch.brokenSwingPrice)) {
      report.invalidBearishChochCount += 1
      report.details.push(`Invalid bearish CHoCH ${choch.id}`)
    }
    if (choch.candleIndex < choch.brokenSwingConfirmedAtIndex) {
      report.invalidBullishChochCount += choch.kind === 'BULLISH_CHOCH' ? 1 : 0
      report.invalidBearishChochCount += choch.kind === 'BEARISH_CHOCH' ? 1 : 0
      report.details.push(`CHoCH ${choch.id} before swing confirmation`)
    }
  }

  // Same swing cannot emit both BOS and CHoCH
  const bosSwingIds = new Set(bosEvents.map((e) => e.brokenSwingId))
  for (const choch of chochEvents) {
    if (bosSwingIds.has(choch.brokenSwingId)) {
      report.duplicateBreakOfSameSwingCount += 1
      report.details.push(`Swing ${choch.brokenSwingId} emitted both BOS and CHoCH`)
    }
  }

  if (!config.bos.allowRepeatedBreaksOfSameSwing) {
    for (const [swingId, count] of brokenCounts) {
      if (count > 1) {
        report.repeatedSwingBreakCount += count - 1
        report.details.push(`Swing ${swingId} broken ${count} times while repeats disabled`)
      }
    }
  }

  for (const fvg of fvgEvents) {
    if (fvg.kind !== 'BULLISH_FVG_CREATED' && fvg.kind !== 'BEARISH_FVG_CREATED') continue
    if (!(fvg.upperBoundary > fvg.lowerBoundary)) {
      report.fvgInvalidGeometryCount += 1
      report.details.push(`FVG ${fvg.id} invalid geometry`)
    }
  }

  const sweptCanonical = new Map<string, number>()
  for (const sweep of liquiditySweepEvents) {
    if (sweep.penetration <= 0) {
      report.sweepWithoutPenetrationCount += 1
      report.details.push(`Sweep ${sweep.id} without penetration`)
    }
    if (sweep.kind === 'BUY_SIDE_LIQUIDITY_SWEEP') {
      if (!(sweep.wickExtreme > sweep.sweptLevel) || !(sweep.close < sweep.sweptLevel)) {
        report.sweepWithoutCloseReclaimCount += 1
        report.details.push(`BSL sweep ${sweep.id} failed reclaim invariants`)
      }
    }
    if (sweep.kind === 'SELL_SIDE_LIQUIDITY_SWEEP') {
      if (!(sweep.wickExtreme < sweep.sweptLevel) || !(sweep.close > sweep.sweptLevel)) {
        report.sweepWithoutCloseReclaimCount += 1
        report.details.push(`SSL sweep ${sweep.id} failed reclaim invariants`)
      }
    }
    const key = sweep.canonicalLevelId || sweep.sweptSwingIds.join(',')
    sweptCanonical.set(key, (sweptCanonical.get(key) ?? 0) + 1)
  }
  if (!config.liquiditySweep.allowRepeatedSweepsOfSameLevel) {
    for (const [levelId, count] of sweptCanonical) {
      if (count > 1) {
        report.repeatedConsumedLevelSweepCount += count - 1
        report.details.push(
          `Canonical level ${levelId} swept ${count} times while repeats disabled`,
        )
      }
    }
  }

  for (const ob of orderBlockEvents) {
    if (
      ob.kind !== 'BULLISH_ORDER_BLOCK_CREATED' &&
      ob.kind !== 'BEARISH_ORDER_BLOCK_CREATED'
    ) {
      continue
    }
    if (ob.sourceCandleIndex >= ob.candleIndex) {
      report.orderBlockAfterSourceBreakCount += 1
      report.details.push(`Order Block ${ob.id} source candle not before break`)
    }
    if (config.orderBlock.requireDisplacement && !ob.sourceDisplacementId) {
      report.orderBlockWithoutRequiredDisplacementCount += 1
      report.details.push(`Order Block ${ob.id} missing required displacement`)
    }
    if (config.orderBlock.requireFvg && !ob.sourceFvgId) {
      report.orderBlockWithoutRequiredFvgCount += 1
      report.details.push(`Order Block ${ob.id} missing required FVG`)
    }
    for (const ref of ob.refs) {
      if (!allIds.has(ref.id) && !swingsById.has(ref.id)) {
        if (!swingsById.has(ref.id)) {
          report.dependencyReferenceMissingCount += 1
          report.details.push(`Order Block ${ob.id} missing ref ${ref.id}`)
        }
      }
    }
  }

  // Displacement must carry a real closePrice — never leave UI to invent 0.
  for (const disp of displacementEvents) {
    if (
      !('closePrice' in disp) ||
      typeof disp.closePrice !== 'number' ||
      !Number.isFinite(disp.closePrice)
    ) {
      report.artificialZeroDisplayValueCount += 1
      report.details.push(`Displacement ${disp.id} missing closePrice for display`)
    }
  }

  return finalize(report)
}

/** Drop events that violate hard invariants. Never presents invalid BOS as complete. */
export function sanitizeSmcDetectionResult(
  result: SmcDetectionResult,
  config: SmcDetectorConfig,
): { result: SmcDetectionResult; report: SmcInvariantReport } {
  const report = auditSmcInvariants(result, config)
  if (report.ok) return { result, report }

  const swingsById = new Map(result.swings.map((s) => [s.id, s]))
  const seenBroken = new Set<string>()
  const bosEvents: SmcBosEvent[] = []

  for (const bos of result.bosEvents) {
    const swing = swingsById.get(bos.brokenSwingId)
    const confirmIndex = bos.brokenSwingConfirmedAtIndex ?? swing?.confirmedAtIndex ?? Infinity

    if (bos.kind === 'BULLISH_BOS' && !(bos.closePrice > bos.brokenSwingPrice)) continue
    if (bos.kind === 'BEARISH_BOS' && !(bos.closePrice < bos.brokenSwingPrice)) continue
    if (bos.candleIndex < confirmIndex) continue
    if (!config.bos.allowRepeatedBreaksOfSameSwing && seenBroken.has(bos.brokenSwingId)) continue

    seenBroken.add(bos.brokenSwingId)
    bosEvents.push(bos)
  }

  const chochEvents = result.chochEvents.filter((choch) => {
    if (choch.previousStructureState === 'UNDETERMINED_STRUCTURE') return false
    if (choch.kind === 'BULLISH_CHOCH') {
      return (
        choch.previousStructureState === 'BEARISH_STRUCTURE' &&
        choch.closePrice > choch.brokenSwingPrice &&
        choch.candleIndex >= choch.brokenSwingConfirmedAtIndex &&
        !seenBroken.has(choch.brokenSwingId)
      )
    }
    return (
      choch.previousStructureState === 'BULLISH_STRUCTURE' &&
      choch.closePrice < choch.brokenSwingPrice &&
      choch.candleIndex >= choch.brokenSwingConfirmedAtIndex &&
      !seenBroken.has(choch.brokenSwingId)
    )
  })
  for (const c of chochEvents) seenBroken.add(c.brokenSwingId)

  const orderBlockEvents = result.orderBlockEvents.filter((ob) => {
    if (
      ob.kind !== 'BULLISH_ORDER_BLOCK_CREATED' &&
      ob.kind !== 'BEARISH_ORDER_BLOCK_CREATED'
    ) {
      return true
    }
    if (ob.sourceCandleIndex >= ob.candleIndex) return false
    if (config.orderBlock.requireDisplacement && !ob.sourceDisplacementId) return false
    if (config.orderBlock.requireFvg && !ob.sourceFvgId) return false
    return true
  })

  const seenCanonical = new Set<string>()
  const liquiditySweepEvents = result.liquiditySweepEvents.filter((sweep) => {
    if (sweep.penetration <= 0) return false
    if (sweep.kind === 'BUY_SIDE_LIQUIDITY_SWEEP') {
      if (!(sweep.wickExtreme > sweep.sweptLevel && sweep.close < sweep.sweptLevel)) {
        return false
      }
    } else if (!(sweep.wickExtreme < sweep.sweptLevel && sweep.close > sweep.sweptLevel)) {
      return false
    }
    const key = sweep.canonicalLevelId || sweep.sweptSwingIds.join(',')
    if (!config.liquiditySweep.allowRepeatedSweepsOfSameLevel && seenCanonical.has(key)) {
      return false
    }
    seenCanonical.add(key)
    return true
  })

  const sanitized: SmcDetectionResult = {
    ...result,
    bosEvents,
    chochEvents,
    orderBlockEvents,
    liquiditySweepEvents,
    diagnostics: {
      ...result.diagnostics,
      validBosEvents: bosEvents.length,
      validChochEvents: chochEvents.length,
      liquiditySweepEvents: liquiditySweepEvents.length,
      orderBlockEvents: orderBlockEvents.filter(
        (e) =>
          e.kind === 'BULLISH_ORDER_BLOCK_CREATED' ||
          e.kind === 'BEARISH_ORDER_BLOCK_CREATED',
      ).length,
    },
  }

  return { result: sanitized, report: auditSmcInvariants(sanitized, config) }
}

export function isValidBullishBos(input: {
  closePrice: number
  brokenSwingPrice: number
  candleIndex: number
  confirmedAtIndex: number
}): boolean {
  return (
    input.closePrice > input.brokenSwingPrice &&
    input.candleIndex >= input.confirmedAtIndex
  )
}

export function isValidBearishBos(input: {
  closePrice: number
  brokenSwingPrice: number
  candleIndex: number
  confirmedAtIndex: number
}): boolean {
  return (
    input.closePrice < input.brokenSwingPrice &&
    input.candleIndex >= input.confirmedAtIndex
  )
}

export type { SmcSwingEvent }

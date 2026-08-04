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
  eventTimestampMismatchCount: number
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
    eventTimestampMismatchCount: 0,
    ok: true,
    details: [],
  }
}

/**
 * Hard invariants for Phase-1 BOS correctness.
 * A bullish close of 64489.98 against a swing high of 64700 MUST fail.
 */
export function auditSmcInvariants(
  result: SmcDetectionResult,
  config: SmcDetectorConfig,
  candles?: ReadonlyArray<{ time: number; close: number }>,
): SmcInvariantReport {
  const report = emptyReport()
  const swingsById = new Map(result.swings.map((s) => [s.id, s]))
  const brokenCounts = new Map<string, number>()

  for (const bos of result.bosEvents) {
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

    // Timestamp must be the break candle, not the swing.
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
  }

  if (!config.bos.allowRepeatedBreaksOfSameSwing) {
    for (const [swingId, count] of brokenCounts) {
      if (count > 1) {
        report.repeatedSwingBreakCount += count - 1
        report.details.push(`Swing ${swingId} broken ${count} times while repeats disabled`)
      }
    }
  }

  report.ok =
    report.invalidBullishBosCount === 0 &&
    report.invalidBearishBosCount === 0 &&
    report.bosBeforeConfirmationCount === 0 &&
    report.repeatedSwingBreakCount === 0 &&
    report.eventTimestampMismatchCount === 0

  return report
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

  const sanitized: SmcDetectionResult = {
    ...result,
    bosEvents,
    diagnostics: {
      ...result.diagnostics,
      validBosEvents: bosEvents.length,
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

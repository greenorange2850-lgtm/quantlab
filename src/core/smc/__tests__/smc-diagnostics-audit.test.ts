import { describe, expect, it } from 'vitest'
import type { Candle } from '@/data/candles'
import {
  buildCanonicalLiquidityLevels,
  buildEventCountBreakdownFields,
  classifyInternalExternalStructure,
  cloneSmcDetectorConfig,
  countReviewableEvents,
  countStructureBreaks,
  DEFAULT_SMC_DETECTOR_CONFIG,
  detectConfirmedSwings,
  detectLiquiditySweeps,
  detectSmc,
  swingProminence,
} from '@/core/smc'
import { listReviewableEvents } from '@/features/smc-lab/event-counts'
import {
  getSmcEventDisplayValue,
  isArtificialZeroDisplay,
} from '@/features/smc-lab/event-display'
import { buildReviewSummary } from '@/features/smc-lab/review-summary'

function candle(
  index: number,
  open: number,
  high: number,
  low: number,
  close: number,
): Candle {
  return {
    time: 1_700_000_000_000 + index * 900_000,
    open,
    high,
    low,
    close,
    volume: 1,
  }
}

describe('prominence (external strictness)', () => {
  it('measures dominance vs next-best extreme, not full window range', () => {
    // Pivot high at 10 clearly above neighbors at ~100
    const candles = Array.from({ length: 21 }, (_, i) => candle(i, 100, 101, 99, 100))
    candles[10] = candle(10, 100, 110, 99, 105)
    const { prominence, nextBestExtreme } = swingProminence(
      candles,
      10,
      'SWING_HIGH',
      5,
      5,
    )
    expect(nextBestExtreme).toBe(101)
    expect(prominence).toBeCloseTo(((110 - 101) / 110) * 100, 5)
    // Old formula used full window range / price ≈ (110-99)/110 ≈ 10% — always permissive.
    // New formula is ~8.18% here; tiny bumps stay near 0.
    candles[10] = candle(10, 100, 101.05, 99, 100.5)
    const tiny = swingProminence(candles, 10, 'SWING_HIGH', 5, 5)
    expect(tiny.prominence).toBeLessThan(0.1)
  })

  it('QuantLab Default external ratio is well below ~1/3 of classified', () => {
    const n = 720
    const candles = Array.from({ length: n }, (_, i) => {
      const base = 2000 + Math.sin(i / 17) * 25 + Math.cos(i / 41) * 10
      return candle(
        i,
        base,
        base + 1.2 + (i % 9) * 0.15,
        base - 1.2 - (i % 7) * 0.12,
        base + ((i % 3) - 1) * 0.3,
      )
    })
    // Inject a few major pivots
    candles[80] = candle(80, 2050, 2120, 2040, 2100)
    candles[200] = candle(200, 1980, 1990, 1900, 1920)
    candles[400] = candle(400, 2060, 2150, 2050, 2130)

    const result = detectSmc(candles, DEFAULT_SMC_DETECTOR_CONFIG)
    const total = result.classifiedSwings.length
    const external = result.diagnostics.externalSwings
    expect(total).toBeGreaterThan(0)
    // External should be a minority of classified swings (major pivots only).
    expect(external / total).toBeLessThan(0.35)
    for (const e of result.classifiedSwings.filter((s) => s.classification === 'EXTERNAL')) {
      expect(e.promotionReason.length).toBeGreaterThan(0)
      expect(e.prominence).toBeGreaterThanOrEqual(
        DEFAULT_SMC_DETECTOR_CONFIG.structure.minimumExternalProminencePercent,
      )
    }
  })
})

describe('liquidity sweep canonical dedup', () => {
  it('merges nearby members and emits one sweep per canonical level', () => {
    const members = [
      {
        id: 'a',
        price: 100,
        confirmedAtIndex: 5,
        candleIndex: 3,
        scope: 'EXTERNAL' as const,
        equalLevelId: null,
      },
      {
        id: 'b',
        price: 100.04,
        confirmedAtIndex: 8,
        candleIndex: 6,
        scope: 'INTERNAL' as const,
        equalLevelId: 'eq-1',
      },
    ]
    const groups = buildCanonicalLiquidityLevels(members, 'HIGH', 0.1)
    expect(groups).toHaveLength(1)
    expect(groups[0]!.memberIds).toEqual(expect.arrayContaining(['a', 'b']))

    const swings = [
      {
        id: 'sh-3',
        kind: 'SWING_HIGH' as const,
        candleIndex: 3,
        timestamp: 1,
        price: 100,
        confirmedAtIndex: 5,
        confirmedAtTimestamp: 2,
        leftBars: 2,
        rightBars: 2,
        reason: 't',
      },
      {
        id: 'sh-6',
        kind: 'SWING_HIGH' as const,
        candleIndex: 6,
        timestamp: 3,
        price: 100.04,
        confirmedAtIndex: 8,
        confirmedAtTimestamp: 4,
        leftBars: 2,
        rightBars: 2,
        reason: 't',
      },
    ]
    const candles = Array.from({ length: 14 }, (_, i) => candle(i, 95, 96, 94, 95))
    candles[10] = candle(10, 99, 101, 98, 99.2)
    const result = detectLiquiditySweeps(
      candles,
      swings,
      [],
      [],
      [],
      {
        enabled: true,
        structureScope: 'BOTH',
        minimumPenetrationPercent: 0.01,
        maximumCloseDistancePercent: 5,
        requireSameCandleRejection: true,
        requireDisplacementAfterSweep: false,
        displacementConfirmationBars: 3,
        equalLevelTolerancePercent: 0.1,
        allowRepeatedSweepsOfSameLevel: false,
      },
      13,
    )
    expect(result.events).toHaveLength(1)
    expect(result.events[0]!.canonicalLevelId).toBeTruthy()
    expect(result.events[0]!.sweptSwingIds.length).toBeGreaterThanOrEqual(2)
    expect(result.diagnostics.validUniqueSweeps).toBe(1)
    expect(result.diagnostics.rawSweepCandidates).toBeGreaterThanOrEqual(1)
  })

  it('does not re-sweep a consumed canonical level by default', () => {
    const swings = [
      {
        id: 'sh-3',
        kind: 'SWING_HIGH' as const,
        candleIndex: 3,
        timestamp: 1,
        price: 100,
        confirmedAtIndex: 5,
        confirmedAtTimestamp: 2,
        leftBars: 2,
        rightBars: 2,
        reason: 't',
      },
    ]
    const candles = Array.from({ length: 16 }, (_, i) => candle(i, 95, 96, 94, 95))
    candles[10] = candle(10, 99, 101, 98, 99.2)
    candles[13] = candle(13, 99, 101.5, 98, 99.1)
    const result = detectLiquiditySweeps(
      candles,
      swings,
      [],
      [],
      [],
      {
        ...cloneSmcDetectorConfig().liquiditySweep,
        minimumPenetrationPercent: 0.01,
        maximumCloseDistancePercent: 5,
        allowRepeatedSweepsOfSameLevel: false,
      },
      15,
    )
    expect(result.events).toHaveLength(1)
    expect(result.diagnostics.consumedLevelAttemptsIgnored).toBeGreaterThan(0)
  })
})

describe('event count reconciliation', () => {
  it('Review Summary Detected equals unique reviewable events', () => {
    const candles = Array.from({ length: 80 }, (_, i) => {
      const c = 100 + Math.sin(i / 5) * 4
      return candle(i, c, c + 1, c - 1, c)
    })
    candles[20] = candle(20, 100, 112, 99, 110)
    candles[21] = candle(21, 110, 111, 100, 101)
    candles[40] = candle(40, 102, 103, 90, 92)
    const result = detectSmc(candles, DEFAULT_SMC_DETECTOR_CONFIG)
    const reviewable = listReviewableEvents(result)
    const summary = buildReviewSummary({
      detection: result,
      reviews: [],
      activeConfigHash: 'x',
    })
    expect(summary.overall.detected).toBe(reviewable.length)
    expect(summary.uniqueReviewableCount).toBe(reviewable.length)
    expect(countReviewableEvents(result)).toBe(reviewable.length)
    expect(result.diagnostics.eventCountBreakdown.uniqueReviewableEvents).toBe(
      reviewable.length,
    )
    // Lifecycle updates are separate from Detected
    expect(summary.lifecycleUpdateCount).toBe(
      result.diagnostics.eventCountBreakdown.lifecycleUpdates,
    )
    const breakdown = buildEventCountBreakdownFields(result)
    expect(breakdown.totalEvents).toBeGreaterThanOrEqual(breakdown.uniqueReviewableEvents)
  })
})

describe('structure break split counts', () => {
  it('exposes internal vs external BOS/CHoCH separately', () => {
    const candles = Array.from({ length: 120 }, (_, i) => {
      const c = 100 + Math.sin(i / 6) * 6
      return candle(i, c, c + 1.5, c - 1.5, c)
    })
    const result = detectSmc(candles, DEFAULT_SMC_DETECTOR_CONFIG)
    const counts = countStructureBreaks(result)
    expect(result.diagnostics.structureBreakCounts).toEqual(counts)
    const sum =
      counts.internalBullishBos +
      counts.internalBearishBos +
      counts.externalBullishBos +
      counts.externalBearishBos +
      counts.unclassifiedBullishBos +
      counts.unclassifiedBearishBos
    expect(sum).toBe(result.bosEvents.length)
  })
})

describe('displacement display invariant', () => {
  it('detection attaches closePrice and display is never artificial zero', () => {
    const candles = Array.from({ length: 40 }, (_, i) => candle(i, 100, 101, 99, 100))
    candles[20] = candle(20, 100, 115, 99.5, 114)
    const config = cloneSmcDetectorConfig()
    config.displacement.minimumBodyAtrMultiple = 0.5
    config.displacement.minimumBodyToRangeRatio = 0.4
    config.fvg.enabled = false
    config.liquiditySweep.enabled = false
    config.orderBlock.enabled = false
    const result = detectSmc(candles, config)
    for (const d of result.displacementEvents) {
      expect(Number.isFinite(d.closePrice)).toBe(true)
      const display = getSmcEventDisplayValue(d)
      expect(isArtificialZeroDisplay(display.primary)).toBe(false)
      expect(display.primary).not.toBe('0')
    }
    expect(result.diagnostics.invariants?.artificialZeroDisplayValueCount).toBe(0)
  })
})

describe('classified swing promotion metadata', () => {
  it('stores promotion reason and bars-from-previous for externals', () => {
    const candles = Array.from({ length: 60 }, (_, i) => candle(i, 50, 51, 49, 50))
    candles[15] = candle(15, 50, 70, 49, 65)
    candles[40] = candle(40, 50, 72, 49, 66)
    const base = detectConfirmedSwings(
      candles,
      { enabled: true, pivotLeft: 3, pivotRight: 3, equalTolerancePercent: 0 },
      59,
    )
    const classified = classifyInternalExternalStructure(
      candles,
      base.swings,
      {
        enabled: true,
        internalPivotLeft: 2,
        internalPivotRight: 2,
        externalPivotLeft: 5,
        externalPivotRight: 5,
        minimumExternalProminencePercent: 0.2,
        minimumExternalBarsApart: 10,
      },
      59,
    )
    expect(classified.external.length).toBeGreaterThan(0)
    for (const e of classified.external) {
      expect(e.promotionReason).toMatch(/External/)
      expect(e.nextBestExtreme).not.toBeNull()
    }
  })
})

import { describe, expect, it } from 'vitest'
import type { Candle } from '@/data/candles'
import {
  applySmcIntelligence,
  cloneSmcDetectorConfig,
  detectSmc,
  filterDetectionByRanking,
  scoreSmcEvent,
  withSmcVisibilityMode,
  type SmcClassifiedSwingEvent,
  type SmcDisplacementEvent,
} from '@/core/smc'

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

describe('SMC intelligence ranking', () => {
  it('scores external structure higher than tiny internal swings', () => {
    const external: SmcClassifiedSwingEvent = {
      id: 'ext-1',
      kind: 'EXTERNAL_SWING_HIGH',
      candleIndex: 20,
      timestamp: 1,
      price: 120,
      confirmedAtIndex: 25,
      confirmedAtTimestamp: 2,
      leftBars: 10,
      rightBars: 10,
      classification: 'EXTERNAL',
      originalSwingId: 'sh-20',
      prominence: 1.2,
      nextBestExtreme: 110,
      surroundingRange: { high: 120, low: 90 },
      promotionReason: 'External: prominence',
      barsFromPreviousExternal: 30,
      replacedExternalSwingId: null,
      reason: 't',
      refs: [{ id: 'sh-20', kind: 'SWING_HIGH' }],
    }
    const tiny: SmcClassifiedSwingEvent = {
      id: 'int-1',
      kind: 'INTERNAL_SWING_HIGH',
      candleIndex: 22,
      timestamp: 3,
      price: 101,
      confirmedAtIndex: 24,
      confirmedAtTimestamp: 4,
      leftBars: 3,
      rightBars: 3,
      classification: 'INTERNAL',
      originalSwingId: 'sh-22',
      prominence: 0.05,
      nextBestExtreme: 100.5,
      surroundingRange: { high: 101, low: 99 },
      promotionReason: 'Internal',
      barsFromPreviousExternal: null,
      replacedExternalSwingId: null,
      reason: 't',
      refs: [],
    }
    const empty = detectSmc([], cloneSmcDetectorConfig())
    const extScore = scoreSmcEvent(external, empty, {
      candleCount: 100,
      nearbySameFamilyIds: [],
      priorContinuationBos: false,
      sweepBeforeReversal: false,
    })
    const tinyScore = scoreSmcEvent(tiny, empty, {
      candleCount: 100,
      nearbySameFamilyIds: [],
      priorContinuationBos: false,
      sweepBeforeReversal: false,
    })
    expect(extScore.importanceScore).toBeGreaterThan(tinyScore.importanceScore)
    expect(extScore.importanceReasons.some((r) => r.label.includes('External Structure'))).toBe(
      true,
    )
    expect(tinyScore.importanceReasons.some((r) => r.label.includes('Tiny internal'))).toBe(true)
  })

  it('penalizes nearby duplicates and never invents score outside 0-100', () => {
    const disp: SmcDisplacementEvent = {
      id: 'd1',
      kind: 'BULLISH_DISPLACEMENT',
      candleIndex: 10,
      timestamp: 1,
      closePrice: 110,
      bodySize: 8,
      fullRange: 10,
      atr: 4,
      bodyAtrMultiple: 2,
      bodyToRangeRatio: 0.8,
      upperWick: 1,
      lowerWick: 1,
      structureBreakId: 'bos-1',
      fvgId: null,
      reason: 't',
      refs: [
        { id: 'a', kind: 'BULLISH_BOS' },
        { id: 'b', kind: 'BULLISH_FVG_CREATED' },
      ],
    }
    const empty = detectSmc([], cloneSmcDetectorConfig())
    const scored = scoreSmcEvent(disp, empty, {
      candleCount: 50,
      nearbySameFamilyIds: ['d0'],
      priorContinuationBos: false,
      sweepBeforeReversal: false,
    })
    expect(scored.importanceScore).toBeGreaterThanOrEqual(0)
    expect(scored.importanceScore).toBeLessThanOrEqual(100)
    expect(scored.importanceReasons.some((r) => r.label.includes('Nearby duplicate'))).toBe(true)
    expect(scored.importanceReasons.some((r) => r.label.includes('Strong Displacement'))).toBe(
      true,
    )
  })

  it('Focus hides low-importance events without deleting detector arrays', () => {
    const candles = Array.from({ length: 120 }, (_, i) => {
      const c = 100 + Math.sin(i / 6) * 6 + Math.sin(i / 19) * 10
      return candle(i, c - 0.2, c + 1.5, c - 1.5, c)
    })
    candles[40] = candle(40, 100, 118, 99, 116)
    const raw = detectSmc(candles, cloneSmcDetectorConfig())
    expect(raw.intelligence).toBeTruthy()
    const focus = withSmcVisibilityMode(raw, 'focus')
    const balanced = withSmcVisibilityMode(raw, 'balanced')
    const debug = withSmcVisibilityMode(raw, 'debug')

    expect(focus.diagnostics.ranking?.mode).toBe('focus')
    expect(debug.diagnostics.ranking?.hiddenByRanking).toBe(0)
    expect(focus.diagnostics.ranking!.visibleEvents).toBeLessThanOrEqual(
      balanced.diagnostics.ranking!.visibleEvents,
    )
    expect(balanced.diagnostics.ranking!.visibleEvents).toBeLessThanOrEqual(
      debug.diagnostics.ranking!.visibleEvents,
    )

    // Source arrays unchanged in length across modes (filtering is a view).
    expect(focus.bosEvents.length).toBe(raw.bosEvents.length)
    expect(focus.classifiedSwings.length).toBe(raw.classifiedSwings.length)

    const focusView = filterDetectionByRanking(focus)
    const debugView = filterDetectionByRanking(debug)
    const focusCount =
      focusView.classifiedSwings.length +
      focusView.bosEvents.length +
      focusView.chochEvents.length +
      focusView.displacementEvents.length +
      focusView.fvgEvents.length +
      focusView.equalLevelEvents.length +
      focusView.liquiditySweepEvents.length +
      focusView.orderBlockEvents.length
    const debugCount =
      debugView.classifiedSwings.length +
      debugView.bosEvents.length +
      debugView.chochEvents.length +
      debugView.displacementEvents.length +
      debugView.fvgEvents.length +
      debugView.equalLevelEvents.length +
      debugView.liquiditySweepEvents.length +
      debugView.orderBlockEvents.length
    expect(focusCount).toBeLessThanOrEqual(debugCount)
    expect(focus.diagnostics.ranking!.visibleEvents).toBeLessThanOrEqual(40)
  })

  it('pipeline attaches intelligence with Balanced defaults', () => {
    const candles = Array.from({ length: 80 }, (_, i) => candle(i, 50, 51, 49, 50))
    const result = applySmcIntelligence(detectSmc(candles, cloneSmcDetectorConfig()), 'balanced')
    expect(result.intelligence?.rankingVersion).toMatch(/^smc-rank/)
    expect(result.diagnostics.ranking?.detectedEvents).toBeGreaterThanOrEqual(0)
    expect(result.diagnostics.ranking?.averageImportance).toBeGreaterThanOrEqual(0)
  })
})

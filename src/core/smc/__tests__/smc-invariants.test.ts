import { describe, expect, it } from 'vitest'
import type { Candle } from '@/data/candles'
import {
  auditSmcInvariants,
  cloneSmcDetectorConfig,
  detectSmc,
  emptySmcDetectionResult,
  isValidBearishBos,
  isValidBullishBos,
  PHASE1_COMPAT_SMC_CONFIG,
  sanitizeSmcDetectionResult,
  type SmcBosEvent,
  type SmcDetectionResult,
  type SmcSwingEvent,
} from '@/core/smc'

function phase1Config() {
  return cloneSmcDetectorConfig(PHASE1_COMPAT_SMC_CONFIG)
}

function candle(
  index: number,
  open: number,
  high: number,
  low: number,
  close: number,
): Candle {
  return {
    time: 1_700_000_000_000 + index * 3_600_000,
    open,
    high,
    low,
    close,
    volume: 1,
  }
}

/** The reported invalid-looking case: SH 64700 vs bullish close 64489.98 */
describe('SMC BOS hard invariants', () => {
  it('rejects bullish BOS when close <= broken swing high (64700 / 64489.98 case)', () => {
    expect(
      isValidBullishBos({
        closePrice: 64_489.98,
        brokenSwingPrice: 64_700,
        candleIndex: 20,
        confirmedAtIndex: 15,
      }),
    ).toBe(false)

    const fakeSwing: SmcSwingEvent = {
      id: 'sh-10-1',
      kind: 'SWING_HIGH',
      candleIndex: 10,
      timestamp: 1,
      price: 64_700,
      confirmedAtIndex: 15,
      confirmedAtTimestamp: 2,
      leftBars: 5,
      rightBars: 5,
      reason: 'test',
    }
    const fakeBos: SmcBosEvent = {
      id: 'bos-bad',
      kind: 'BULLISH_BOS',
      candleIndex: 20,
      timestamp: 3,
      closePrice: 64_489.98,
      brokenSwingId: fakeSwing.id,
      brokenSwingPrice: 64_700,
      brokenSwingTimestamp: 1,
      brokenSwingCandleIndex: 10,
      brokenSwingConfirmedAtIndex: 15,
      breakAmount: 64_489.98 - 64_700,
      breakPercent: -0.32,
      wickHigh: 64_800,
      wickLow: 64_400,
      wickOnlyIgnored: false,
      reason: 'injected invalid',
      refs: [{ id: fakeSwing.id, kind: 'SWING_HIGH' }],
    }
    const raw: SmcDetectionResult = {
      ...emptySmcDetectionResult('FAILED'),
      swings: [fakeSwing],
      bosEvents: [fakeBos],
      diagnostics: {
        ...emptySmcDetectionResult('FAILED').diagnostics,
        detectorVersion: 'test',
        candleCount: 30,
        visibleThroughIndex: 29,
        swingCandidatesConsidered: 1,
        confirmedSwings: 1,
        validBosEvents: 1,
        detectionStatus: 'FAILED',
      },
    }
    const config = cloneSmcDetectorConfig()
    const report = auditSmcInvariants(raw, config)
    expect(report.invalidBullishBosCount).toBeGreaterThan(0)
    expect(report.ok).toBe(false)

    const { result, report: after } = sanitizeSmcDetectionResult(raw, config)
    expect(result.bosEvents).toHaveLength(0)
    expect(after.ok).toBe(true)
  })

  it('rejects bearish BOS when close >= broken swing low', () => {
    expect(
      isValidBearishBos({
        closePrice: 100,
        brokenSwingPrice: 90,
        candleIndex: 10,
        confirmedAtIndex: 5,
      }),
    ).toBe(false)
  })

  it('rejects BOS before swing confirmation', () => {
    expect(
      isValidBullishBos({
        closePrice: 110,
        brokenSwingPrice: 100,
        candleIndex: 4,
        confirmedAtIndex: 5,
      }),
    ).toBe(false)
  })

  it('detector never emits bullish BOS with close below swing high', () => {
    // Clear SH at 5 (high=20), confirmed at 7, then candle closes below without breaking
    const pattern: Array<[number, number, number, number]> = [
      [10, 10.5, 9.5, 10],
      [11, 11.5, 10.5, 11],
      [12, 12.5, 11.5, 12],
      [13, 13.5, 12.5, 13],
      [14, 14.5, 13.5, 14],
      [19, 20, 18.5, 19],
      [14, 14.5, 13.5, 14],
      [13, 13.5, 12.5, 13],
      [14, 19.9, 13.5, 14], // wick almost to SH, close well below
      [15, 15.5, 14.5, 15],
    ]
    const candles = pattern.map(([o, h, l, c], i) => candle(i, o, h, l, c))
    const config = phase1Config()
    config.swing.pivotLeft = 2
    config.swing.pivotRight = 2
    const result = detectSmc(candles, config)
    for (const bos of result.bosEvents.filter((e) => e.kind === 'BULLISH_BOS')) {
      expect(bos.closePrice).toBeGreaterThan(bos.brokenSwingPrice)
      expect(bos.candleIndex).toBeGreaterThanOrEqual(bos.brokenSwingConfirmedAtIndex)
      expect(bos.timestamp).not.toBe(bos.brokenSwingTimestamp)
    }
    expect(result.diagnostics.invariants?.ok).toBe(true)
    expect(result.diagnostics.invariants?.invalidBullishBosCount).toBe(0)
  })

  it('does not repeat breaks of the same swing when disabled', () => {
    const pattern: Array<[number, number, number, number]> = [
      [10, 10.5, 9.5, 10],
      [11, 11.5, 10.5, 11],
      [12, 12.5, 11.5, 12],
      [13, 13.5, 12.5, 13],
      [14, 14.5, 13.5, 14],
      [19, 20, 18.5, 19],
      [14, 14.5, 13.5, 14],
      [13, 13.5, 12.5, 13],
      [19.5, 21, 19, 20.5],
      [21, 22, 20.5, 21.5],
      [21, 21.5, 20.5, 21],
    ]
    const candles = pattern.map(([o, h, l, c], i) => candle(i, o, h, l, c))
    const config = phase1Config()
    config.swing.pivotLeft = 2
    config.swing.pivotRight = 2
    config.bos.allowRepeatedBreaksOfSameSwing = false
    const result = detectSmc(candles, config)
    const ids = result.bosEvents.map((e) => e.brokenSwingId)
    expect(new Set(ids).size).toBe(ids.length)
    expect(result.diagnostics.invariants?.repeatedSwingBreakCount).toBe(0)
  })

  it('BOS timestamp is always the break candle timestamp', () => {
    const pattern: Array<[number, number, number, number]> = [
      [10, 10.5, 9.5, 10],
      [11, 11.5, 10.5, 11],
      [12, 12.5, 11.5, 12],
      [13, 13.5, 12.5, 13],
      [14, 14.5, 13.5, 14],
      [19, 20, 18.5, 19],
      [14, 14.5, 13.5, 14],
      [13, 13.5, 12.5, 13],
      [14, 14.5, 13.5, 14],
      [15, 15.5, 14.5, 15],
      [19.5, 21, 19, 20.5],
    ]
    const candles = pattern.map(([o, h, l, c], i) => candle(i, o, h, l, c))
    const config = phase1Config()
    config.swing.pivotLeft = 2
    config.swing.pivotRight = 2
    const result = detectSmc(candles, config)
    for (const bos of result.bosEvents) {
      expect(bos.timestamp).toBe(candles[bos.candleIndex]!.time)
      expect(bos.closePrice).toBe(candles[bos.candleIndex]!.close)
      expect(bos.timestamp).not.toBe(bos.brokenSwingTimestamp)
    }
  })

  it('exposes swing index fields on every BOS event', () => {
    const pattern: Array<[number, number, number, number]> = [
      [10, 10.5, 9.5, 10],
      [11, 11.5, 10.5, 11],
      [12, 12.5, 11.5, 12],
      [13, 13.5, 12.5, 13],
      [14, 14.5, 13.5, 14],
      [19, 20, 18.5, 19],
      [14, 14.5, 13.5, 14],
      [13, 13.5, 12.5, 13],
      [19.5, 21, 19, 20.5],
    ]
    const candles = pattern.map(([o, h, l, c], i) => candle(i, o, h, l, c))
    const config = phase1Config()
    config.swing.pivotLeft = 2
    config.swing.pivotRight = 2
    const result = detectSmc(candles, config)
    const bull = result.bosEvents.find((e) => e.kind === 'BULLISH_BOS')
    expect(bull).toBeDefined()
    expect(bull!.brokenSwingCandleIndex).toBeTypeOf('number')
    expect(bull!.brokenSwingConfirmedAtIndex).toBeTypeOf('number')
    expect(bull!.candleIndex).toBeGreaterThanOrEqual(bull!.brokenSwingConfirmedAtIndex)
  })
})

import { describe, expect, it } from 'vitest'
import type { Candle } from '@/data/candles'
import {
  DEFAULT_SMC_DETECTOR_CONFIG,
  PHASE1_COMPAT_SMC_CONFIG,
  detectConfirmedSwings,
  detectSmc,
  detectSmcUntil,
  validateSmcDetectorConfig,
  cloneSmcDetectorConfig,
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

/** Flat series with a clear swing high in the middle. */
function makeSwingHighSeries(): Candle[] {
  // indices 0..14; pivot at 5 with left=2,right=2 for shorter tests — we'll use 2/2
  const closes = [10, 11, 12, 13, 14, 20, 14, 13, 12, 11, 10, 10, 10, 10, 10]
  return closes.map((c, i) => candle(i, c - 0.2, c + 0.5, c - 0.5, c))
}

function makeSwingLowSeries(): Candle[] {
  const closes = [20, 19, 18, 17, 16, 10, 16, 17, 18, 19, 20, 20, 20, 20, 20]
  return closes.map((c, i) => candle(i, c + 0.2, c + 0.5, c - 0.5, c))
}

describe('confirmed swing detection', () => {
  it('detects confirmed Swing High only after pivotRight bars', () => {
    const candles = makeSwingHighSeries()
    const config = {
      enabled: true,
      pivotLeft: 2,
      pivotRight: 2,
      equalTolerancePercent: 0,
    }

    // Before confirmation (pivot at 5 needs index 7): no swing
    const early = detectConfirmedSwings(candles, config, 6)
    expect(early.swings.filter((s) => s.kind === 'SWING_HIGH')).toHaveLength(0)

    const confirmed = detectConfirmedSwings(candles, config, 7)
    const highs = confirmed.swings.filter((s) => s.kind === 'SWING_HIGH')
    expect(highs.length).toBeGreaterThanOrEqual(1)
    const pivot = highs.find((s) => s.candleIndex === 5)
    expect(pivot).toBeDefined()
    expect(pivot!.confirmedAtIndex).toBe(7)
    expect(pivot!.price).toBe(candles[5]!.high)
  })

  it('detects confirmed Swing Low only after pivotRight bars', () => {
    const candles = makeSwingLowSeries()
    const config = {
      enabled: true,
      pivotLeft: 2,
      pivotRight: 2,
      equalTolerancePercent: 0,
    }

    expect(
      detectConfirmedSwings(candles, config, 6).swings.filter((s) => s.kind === 'SWING_LOW'),
    ).toHaveLength(0)

    const lows = detectConfirmedSwings(candles, config, 7).swings.filter(
      (s) => s.kind === 'SWING_LOW',
    )
    expect(lows.some((s) => s.candleIndex === 5)).toBe(true)
  })

  it('ignores boundary candles that lack a full pivot window', () => {
    const candles = makeSwingHighSeries()
    const config = {
      enabled: true,
      pivotLeft: 2,
      pivotRight: 2,
      equalTolerancePercent: 0,
    }
    const result = detectConfirmedSwings(candles, config, candles.length - 1)
    expect(result.swings.every((s) => s.candleIndex >= 2)).toBe(true)
    expect(
      result.swings.every((s) => s.confirmedAtIndex <= candles.length - 1),
    ).toBe(true)
  })

  it('uses leftmost equal-high when tolerance allows plateau', () => {
    // Two equal highs at 4 and 5 within tolerance 0
    const closes = [10, 11, 12, 13, 20, 20, 13, 12, 11, 10, 10, 10]
    const candles = closes.map((c, i) => candle(i, c, c, c - 1, c))
    const config = {
      enabled: true,
      pivotLeft: 2,
      pivotRight: 2,
      equalTolerancePercent: 0,
    }
    const highs = detectConfirmedSwings(candles, config, candles.length - 1).swings.filter(
      (s) => s.kind === 'SWING_HIGH',
    )
    const plateau = highs.filter((s) => s.price === 20)
    // Leftmost wins — only index 4 should be the swing for the plateau
    expect(plateau.some((s) => s.candleIndex === 4)).toBe(true)
    expect(plateau.some((s) => s.candleIndex === 5)).toBe(false)
  })

  it('is deterministic across repeated runs', () => {
    const candles = makeSwingHighSeries()
    const config = {
      enabled: true,
      pivotLeft: 2,
      pivotRight: 2,
      equalTolerancePercent: 0,
    }
    const a = detectConfirmedSwings(candles, config, candles.length - 1)
    const b = detectConfirmedSwings(candles, config, candles.length - 1)
    expect(a.swings.map((s) => s.id)).toEqual(b.swings.map((s) => s.id))
  })
})

describe('BOS detection', () => {
  function seriesWithBullishBos(): Candle[] {
    // Swing high at index 5 (price ~20), confirmed at 7, then close break at 10
    const pattern: Array<[number, number, number, number]> = [
      [10, 10.5, 9.5, 10],
      [11, 11.5, 10.5, 11],
      [12, 12.5, 11.5, 12],
      [13, 13.5, 12.5, 13],
      [14, 14.5, 13.5, 14],
      [19, 20, 18.5, 19], // swing high
      [14, 14.5, 13.5, 14],
      [13, 13.5, 12.5, 13], // confirmation
      [14, 14.5, 13.5, 14],
      [15, 15.5, 14.5, 15],
      [19.5, 21, 19, 20.5], // close break above 20
      [20, 20.5, 19.5, 20],
    ]
    return pattern.map(([o, h, l, c], i) => candle(i, o, h, l, c))
  }

  it('emits bullish BOS on close break of confirmed swing high', () => {
    const candles = seriesWithBullishBos()
    const config = phase1Config()
    config.swing.pivotLeft = 2
    config.swing.pivotRight = 2
    const result = detectSmc(candles, config)
    const bos = result.bosEvents.filter((e) => e.kind === 'BULLISH_BOS')
    expect(bos.length).toBeGreaterThanOrEqual(1)
    expect(bos[0]!.closePrice).toBeGreaterThan(bos[0]!.brokenSwingPrice)
    expect(bos[0]!.wickOnlyIgnored).toBe(false)
  })

  it('ignores wick-only breaks', () => {
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
      [15, 21, 14.5, 15], // wick above 20, close below — wick only
      [15, 15.5, 14.5, 15],
    ]
    const candles = pattern.map(([o, h, l, c], i) => candle(i, o, h, l, c))
    const config = phase1Config()
    config.swing.pivotLeft = 2
    config.swing.pivotRight = 2
    const result = detectSmc(candles, config)
    expect(result.bosEvents.filter((e) => e.kind === 'BULLISH_BOS')).toHaveLength(0)
    expect(result.diagnostics.wickOnlyBreakCandidatesIgnored).toBeGreaterThan(0)
  })

  it('ignores unconfirmed swings for BOS', () => {
    const candles = seriesWithBullishBos()
    const config = phase1Config()
    config.swing.pivotLeft = 2
    config.swing.pivotRight = 2
    // Stop before swing confirmation — no BOS possible
    const early = detectSmcUntil(candles, 6, config)
    expect(early.bosEvents).toHaveLength(0)
  })

  it('respects minimum break percent', () => {
    const candles = seriesWithBullishBos()
    const config = phase1Config()
    config.swing.pivotLeft = 2
    config.swing.pivotRight = 2
    config.bos.minimumBreakPercent = 50 // impossibly high
    const result = detectSmc(candles, config)
    expect(result.bosEvents.filter((e) => e.kind === 'BULLISH_BOS')).toHaveLength(0)
  })

  it('does not repeat break of same swing by default', () => {
    const pattern: Array<[number, number, number, number]> = [
      [10, 10.5, 9.5, 10],
      [11, 11.5, 10.5, 11],
      [12, 12.5, 11.5, 12],
      [13, 13.5, 12.5, 13],
      [14, 14.5, 13.5, 14],
      [19, 20, 18.5, 19],
      [14, 14.5, 13.5, 14],
      [13, 13.5, 12.5, 13],
      [19.5, 21, 19, 20.5], // first break
      [21, 22, 20.5, 21.5], // further above — should not re-break same swing
      [21, 21.5, 20.5, 21],
    ]
    const candles = pattern.map(([o, h, l, c], i) => candle(i, o, h, l, c))
    const config = phase1Config()
    config.swing.pivotLeft = 2
    config.swing.pivotRight = 2
    config.bos.allowRepeatedBreaksOfSameSwing = false
    const result = detectSmc(candles, config)
    const bull = result.bosEvents.filter((e) => e.kind === 'BULLISH_BOS')
    expect(bull).toHaveLength(1)
  })

  it('emits bearish BOS on close break of swing low', () => {
    const pattern: Array<[number, number, number, number]> = [
      [20, 20.5, 19.5, 20],
      [19, 19.5, 18.5, 19],
      [18, 18.5, 17.5, 18],
      [17, 17.5, 16.5, 17],
      [16, 16.5, 15.5, 16],
      [11, 11.5, 10, 11], // swing low
      [16, 16.5, 15.5, 16],
      [17, 17.5, 16.5, 17],
      [16, 16.5, 15.5, 16],
      [11, 11.5, 9, 9.5], // close below 10
    ]
    const candles = pattern.map(([o, h, l, c], i) => candle(i, o, h, l, c))
    const config = phase1Config()
    config.swing.pivotLeft = 2
    config.swing.pivotRight = 2
    const result = detectSmc(candles, config)
    expect(result.bosEvents.some((e) => e.kind === 'BEARISH_BOS')).toBe(true)
  })

  it('produces deterministic event ids', () => {
    const candles = seriesWithBullishBos()
    const config = phase1Config()
    config.swing.pivotLeft = 2
    config.swing.pivotRight = 2
    const a = detectSmc(candles, config)
    const b = detectSmc(candles, config)
    expect(a.bosEvents.map((e) => e.id)).toEqual(b.bosEvents.map((e) => e.id))
    expect(a.swings.map((e) => e.id)).toEqual(b.swings.map((e) => e.id))
  })
})

describe('no-look-ahead progressive detection', () => {
  it('hides future swings and BOS until their confirmation/break candle', () => {
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

    const beforeConfirm = detectSmcUntil(candles, 6, config)
    expect(beforeConfirm.swings.filter((s) => s.candleIndex === 5)).toHaveLength(0)

    const atConfirm = detectSmcUntil(candles, 7, config)
    expect(atConfirm.swings.some((s) => s.candleIndex === 5 && s.kind === 'SWING_HIGH')).toBe(
      true,
    )
    expect(atConfirm.bosEvents).toHaveLength(0)

    const atBreak = detectSmcUntil(candles, 10, config)
    expect(atBreak.bosEvents.some((e) => e.kind === 'BULLISH_BOS')).toBe(true)
  })

  it('final progressive result equals full-history result', () => {
    const candles = makeSwingHighSeries()
    const config = DEFAULT_SMC_DETECTOR_CONFIG
    const full = detectSmc(candles, config)
    const progressive = detectSmcUntil(candles, candles.length - 1, config)
    expect(progressive.swings.map((s) => s.id)).toEqual(full.swings.map((s) => s.id))
    expect(progressive.bosEvents.map((e) => e.id)).toEqual(full.bosEvents.map((e) => e.id))
    expect(progressive.chochEvents.map((e) => e.id)).toEqual(full.chochEvents.map((e) => e.id))
    expect(progressive.fvgEvents.map((e) => e.id)).toEqual(full.fvgEvents.map((e) => e.id))
  })
})

describe('SMC config validation', () => {
  it('returns defaults for empty input', () => {
    const result = validateSmcDetectorConfig(null)
    expect(result.config.swing.pivotLeft).toBe(5)
    expect(result.config.bos.breakMode).toBe('CLOSE')
    expect(result.config.structure.enabled).toBe(true)
    expect(result.config.choch.enabled).toBe(true)
  })

  it('clamps out-of-bounds pivots', () => {
    const result = validateSmcDetectorConfig({
      swing: { enabled: true, pivotLeft: 999, pivotRight: 0, equalTolerancePercent: -1 },
      bos: {
        enabled: true,
        breakMode: 'CLOSE',
        minimumBreakPercent: 99,
        requireLatestConfirmedSwing: true,
        allowRepeatedBreaksOfSameSwing: false,
        preferExternalSwings: false,
        structureScope: 'BOTH',
      },
    })
    expect(result.config.swing.pivotLeft).toBeLessThanOrEqual(50)
    expect(result.config.swing.pivotRight).toBeGreaterThanOrEqual(1)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('disabling swing module yields no swings', () => {
    const candles = makeSwingHighSeries()
    const config = phase1Config()
    config.swing.enabled = false
    config.swing.pivotLeft = 2
    config.swing.pivotRight = 2
    const result = detectSmc(candles, config)
    expect(result.swings).toHaveLength(0)
  })
})

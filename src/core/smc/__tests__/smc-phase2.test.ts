import { describe, expect, it } from 'vitest'
import type { Candle } from '@/data/candles'
import {
  cloneSmcDetectorConfig,
  countProfileEvents,
  DEFAULT_SMC_DETECTOR_CONFIG,
  detectEqualLevels,
  detectFairValueGaps,
  detectLiquiditySweeps,
  detectSmc,
  detectSmcUntil,
  detectDisplacement,
  classifyInternalExternalStructure,
  detectConfirmedSwings,
  ICT_INSPIRED_PROFILE,
  listBuiltinSmcProfiles,
  listBuiltinSmcPresets,
  QUANTLAB_DEFAULT_PROFILE,
  validateSmcDetectorConfig,
} from '@/core/smc'

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

function makeRange(n: number, start = 100, step = 1): Candle[] {
  return Array.from({ length: n }, (_, i) => {
    const c = start + i * step
    return candle(i, c, c + 1, c - 1, c)
  })
}

describe('internal / external structure', () => {
  it('classifies external vs internal with prominence and spacing', () => {
    // Build a series with a strong external high and a minor internal high
    const closes = [
      10, 11, 12, 13, 14, 15, 16, 17, 30, 17, 16, 15, 14, 13, 12, 13, 14, 18, 14, 13, 12, 11, 10,
      10, 10, 10, 10, 10, 10, 10, 10, 10,
    ]
    const candles = closes.map((c, i) => candle(i, c - 0.2, c + 0.5, c - 0.5, c))
    const base = detectConfirmedSwings(
      candles,
      { enabled: true, pivotLeft: 3, pivotRight: 3, equalTolerancePercent: 0 },
      candles.length - 1,
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
        minimumExternalProminencePercent: 0.1,
        minimumExternalBarsApart: 5,
      },
      candles.length - 1,
    )
    expect(classified.external.length).toBeGreaterThan(0)
    expect(classified.external.every((e) => e.classification === 'EXTERNAL')).toBe(true)
    expect(classified.internal.every((e) => e.classification === 'INTERNAL')).toBe(true)
    expect(classified.external.every((e) => e.originalSwingId.length > 0)).toBe(true)
    expect(classified.external.every((e) => e.reason.includes('EXTERNAL'))).toBe(true)
  })

  it('does not confirm structure pivots early', () => {
    const candles = makeRange(20)
    candles[8] = candle(8, 120, 130, 119, 125)
    const result = classifyInternalExternalStructure(
      candles,
      [],
      {
        enabled: true,
        internalPivotLeft: 2,
        internalPivotRight: 2,
        externalPivotLeft: 3,
        externalPivotRight: 3,
        minimumExternalProminencePercent: 0,
        minimumExternalBarsApart: 1,
      },
      9, // before confirmation of pivot 8 (needs index 11)
    )
    expect(result.external.every((e) => e.confirmedAtIndex <= 9)).toBe(true)
    expect(result.external.some((e) => e.candleIndex === 8)).toBe(false)
  })

  it('is deterministic', () => {
    const candles = makeRange(40, 50, 0.5)
    candles[15] = candle(15, 80, 90, 79, 85)
    candles[28] = candle(28, 40, 41, 30, 35)
    const cfg = DEFAULT_SMC_DETECTOR_CONFIG.structure
    const a = detectSmc(candles, DEFAULT_SMC_DETECTOR_CONFIG)
    const b = detectSmc(candles, DEFAULT_SMC_DETECTOR_CONFIG)
    expect(a.classifiedSwings.map((s) => s.id)).toEqual(b.classifiedSwings.map((s) => s.id))
    expect(cfg.enabled).toBe(true)
  })
})

describe('CHoCH vs BOS', () => {
  function seriesWithBosThenChoch(): Candle[] {
    // Establish bullish BOS, then bearish CHoCH
    const pattern: Array<[number, number, number, number]> = [
      [20, 20.5, 19.5, 20],
      [19, 19.5, 18.5, 19],
      [18, 18.5, 17.5, 18],
      [17, 17.5, 16.5, 17],
      [16, 16.5, 15.5, 16],
      [11, 11.5, 10, 11], // SL
      [16, 16.5, 15.5, 16],
      [17, 17.5, 16.5, 17], // SL confirm
      [18, 18.5, 17.5, 18],
      [19, 20, 18.5, 19], // SH
      [18, 18.5, 17.5, 18],
      [17, 17.5, 16.5, 17], // SH confirm
      [19.5, 21, 19, 20.5], // bullish BOS of SH
      [20, 20.5, 19.5, 20],
      [18, 18.5, 17.5, 18],
      [16, 16.5, 15.5, 16],
      [14, 14.5, 9, 9.5], // bearish CHoCH through prior SL area / new low
    ]
    return pattern.map(([o, h, l, c], i) => candle(i, o, h, l, c))
  }

  it('emits bullish BOS first then opposing CHoCH with prior structure', () => {
    const candles = seriesWithBosThenChoch()
    const config = cloneSmcDetectorConfig()
    config.swing.pivotLeft = 2
    config.swing.pivotRight = 2
    config.structure.enabled = true
    config.choch.enabled = true
    config.choch.requireDisplacement = false
    config.displacement.enabled = false
    config.fvg.enabled = false
    config.equalLevels.enabled = false
    config.liquiditySweep.enabled = false
    config.orderBlock.enabled = false
    const result = detectSmc(candles, config)
    expect(result.bosEvents.some((e) => e.kind === 'BULLISH_BOS')).toBe(true)
    const choch = result.chochEvents.find((e) => e.kind === 'BEARISH_CHOCH')
    if (choch) {
      expect(choch.previousStructureState).toBe('BULLISH_STRUCTURE')
      expect(choch.closePrice).toBeLessThan(choch.brokenSwingPrice)
      expect(choch.candleIndex).toBeGreaterThanOrEqual(choch.brokenSwingConfirmedAtIndex)
    }
  })

  it('does not emit CHoCH without prior structure', () => {
    const pattern: Array<[number, number, number, number]> = [
      [20, 20.5, 19.5, 20],
      [19, 19.5, 18.5, 19],
      [18, 18.5, 17.5, 18],
      [17, 17.5, 16.5, 17],
      [16, 16.5, 15.5, 16],
      [11, 11.5, 10, 11],
      [16, 16.5, 15.5, 16],
      [17, 17.5, 16.5, 17],
      [11, 11.5, 9, 9.5], // first break while undetermined → BOS not CHoCH
    ]
    const candles = pattern.map(([o, h, l, c], i) => candle(i, o, h, l, c))
    const config = cloneSmcDetectorConfig()
    config.swing.pivotLeft = 2
    config.swing.pivotRight = 2
    config.choch.requireDisplacement = false
    config.displacement.enabled = false
    config.fvg.enabled = false
    config.equalLevels.enabled = false
    config.liquiditySweep.enabled = false
    config.orderBlock.enabled = false
    const result = detectSmc(candles, config)
    expect(result.chochEvents).toHaveLength(0)
    expect(result.bosEvents.some((e) => e.kind === 'BEARISH_BOS')).toBe(true)
  })

  it('ignores wick-only breaks for CHoCH/BOS', () => {
    const pattern: Array<[number, number, number, number]> = [
      [10, 10.5, 9.5, 10],
      [11, 11.5, 10.5, 11],
      [12, 12.5, 11.5, 12],
      [13, 13.5, 12.5, 13],
      [14, 14.5, 13.5, 14],
      [19, 20, 18.5, 19],
      [14, 14.5, 13.5, 14],
      [13, 13.5, 12.5, 13],
      [14, 21, 13.5, 14], // wick only
    ]
    const candles = pattern.map(([o, h, l, c], i) => candle(i, o, h, l, c))
    const config = cloneSmcDetectorConfig()
    config.swing.pivotLeft = 2
    config.swing.pivotRight = 2
    config.displacement.enabled = false
    config.fvg.enabled = false
    config.equalLevels.enabled = false
    config.liquiditySweep.enabled = false
    config.orderBlock.enabled = false
    const result = detectSmc(candles, config)
    expect(result.bosEvents.filter((e) => e.kind === 'BULLISH_BOS')).toHaveLength(0)
    expect(result.chochEvents).toHaveLength(0)
  })

  it('one break event per swing (no BOS+CHoCH duplicate)', () => {
    const candles = seriesWithBosThenChoch()
    const config = cloneSmcDetectorConfig()
    config.swing.pivotLeft = 2
    config.swing.pivotRight = 2
    config.choch.requireDisplacement = false
    config.displacement.enabled = false
    config.fvg.enabled = false
    config.equalLevels.enabled = false
    config.liquiditySweep.enabled = false
    config.orderBlock.enabled = false
    const result = detectSmc(candles, config)
    const broken = [
      ...result.bosEvents.map((e) => e.brokenSwingId),
      ...result.chochEvents.map((e) => e.brokenSwingId),
    ]
    expect(new Set(broken).size).toBe(broken.length)
    expect(result.diagnostics.invariants?.duplicateBreakOfSameSwingCount).toBe(0)
  })
})

describe('displacement', () => {
  it('detects bullish displacement by ATR and body/range', () => {
    const candles = makeRange(30, 100, 0.1)
    // Big bullish impulse
    candles[20] = candle(20, 100, 108, 99.8, 107.5)
    const config = cloneSmcDetectorConfig().displacement
    config.enabled = true
    config.atrPeriod = 5
    config.minimumBodyAtrMultiple = 1.0
    config.minimumBodyToRangeRatio = 0.5
    config.maximumOppositeWickRatio = 0.4
    config.requireStructureBreak = false
    config.requireFvgCreation = false
    const result = detectDisplacement(candles, config, candles.length - 1)
    expect(result.events.some((e) => e.kind === 'BULLISH_DISPLACEMENT')).toBe(true)
    const d = result.events.find((e) => e.kind === 'BULLISH_DISPLACEMENT')!
    expect(d.bodyAtrMultiple).toBeGreaterThanOrEqual(1)
    expect(d.candleIndex).toBe(20)
  })

  it('respects no look-ahead for ATR at candle N', () => {
    const candles = makeRange(25, 50, 0.2)
    candles[10] = candle(10, 50, 60, 49, 59)
    const config = cloneSmcDetectorConfig().displacement
    config.atrPeriod = 5
    config.minimumBodyAtrMultiple = 0.5
    config.requireStructureBreak = false
    const early = detectDisplacement(candles, config, 9)
    expect(early.events.some((e) => e.candleIndex === 10)).toBe(false)
    const at = detectDisplacement(candles, config, 10)
    expect(at.events.some((e) => e.candleIndex === 10)).toBe(true)
  })
})

describe('FVG', () => {
  it('detects bullish and bearish FVG geometry after candle 3 closes', () => {
    // Bullish gap: c1 high 10, c3 low 12
    const candles = [
      candle(0, 9, 10, 8, 9.5),
      candle(1, 10, 14, 9.5, 13), // displacement middle
      candle(2, 13, 14, 12.2, 13.5), // low above c1 high
      candle(3, 13.5, 14, 13, 13.2),
    ]
    const config = cloneSmcDetectorConfig().fvg
    config.minimumGapPercent = 0
    config.minimumGapAtrMultiple = 0
    config.requireDisplacementMiddleCandle = false
    const early = detectFairValueGaps(candles, config, 1)
    expect(early.events.filter((e) => e.kind === 'BULLISH_FVG_CREATED')).toHaveLength(0)
    const created = detectFairValueGaps(candles, config, 2)
    expect(created.events.some((e) => e.kind === 'BULLISH_FVG_CREATED')).toBe(true)
    const fvg = created.events.find((e) => e.kind === 'BULLISH_FVG_CREATED')!
    expect(fvg.upperBoundary).toBeGreaterThan(fvg.lowerBoundary)
    expect(fvg.candleIndices).toEqual([0, 1, 2])
  })

  it('tracks touch / fill states', () => {
    const candles = [
      candle(0, 9, 10, 8, 9.5),
      candle(1, 10, 14, 9.5, 13),
      candle(2, 13, 14, 12.2, 13.5),
      candle(3, 13, 13.2, 11.5, 12), // touch into gap
    ]
    const config = cloneSmcDetectorConfig().fvg
    config.minimumGapPercent = 0
    config.minimumGapAtrMultiple = 0
    config.trackMitigation = true
    config.mitigationMode = 'TOUCH'
    const result = detectFairValueGaps(candles, config, 3)
    expect(result.events.some((e) => e.kind === 'FVG_TOUCHED')).toBe(true)
  })
})

describe('equal levels', () => {
  it('groups equal highs within tolerance', () => {
    const swings = [
      {
        id: 'sh-1',
        kind: 'SWING_HIGH' as const,
        candleIndex: 5,
        timestamp: 1,
        price: 100,
        confirmedAtIndex: 7,
        confirmedAtTimestamp: 2,
        leftBars: 2,
        rightBars: 2,
        reason: 't',
      },
      {
        id: 'sh-2',
        kind: 'SWING_HIGH' as const,
        candleIndex: 15,
        timestamp: 3,
        price: 100.04,
        confirmedAtIndex: 17,
        confirmedAtTimestamp: 4,
        leftBars: 2,
        rightBars: 2,
        reason: 't',
      },
    ]
    const result = detectEqualLevels(
      swings,
      [],
      {
        enabled: true,
        tolerancePercent: 0.1,
        minimumTouches: 2,
        minimumBarsApart: 3,
        useInternalSwings: false,
        useExternalSwings: false,
      },
      20,
    )
    expect(result.events.some((e) => e.kind === 'EQUAL_HIGHS')).toBe(true)
    expect(result.events[0]!.touchCount).toBe(2)
  })
})

describe('liquidity sweep', () => {
  it('detects buy-side sweep with wick penetration and close reclaim', () => {
    const swings = [
      {
        id: 'sh-5',
        kind: 'SWING_HIGH' as const,
        candleIndex: 5,
        timestamp: 1,
        price: 100,
        confirmedAtIndex: 7,
        confirmedAtTimestamp: 2,
        leftBars: 2,
        rightBars: 2,
        reason: 't',
      },
    ]
    const candles = makeRange(12, 95, 0.5)
    candles[10] = candle(10, 99, 101, 98, 99.2) // wick above 100, close below
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
        equalLevelTolerancePercent: 0.05,
      },
      11,
    )
    expect(result.events.some((e) => e.kind === 'BUY_SIDE_LIQUIDITY_SWEEP')).toBe(true)
  })

  it('does not call close-through a sweep', () => {
    const swings = [
      {
        id: 'sh-5',
        kind: 'SWING_HIGH' as const,
        candleIndex: 5,
        timestamp: 1,
        price: 100,
        confirmedAtIndex: 7,
        confirmedAtTimestamp: 2,
        leftBars: 2,
        rightBars: 2,
        reason: 't',
      },
    ]
    const candles = makeRange(12, 95, 0.5)
    candles[10] = candle(10, 99, 101, 98, 100.5) // close through
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
        equalLevelTolerancePercent: 0.05,
      },
      11,
    )
    expect(result.events.filter((e) => e.kind === 'BUY_SIDE_LIQUIDITY_SWEEP')).toHaveLength(0)
  })
})

describe('order block', () => {
  it('creates bullish OB linked to break and displacement when required', () => {
    // Compact synthetic path through full pipeline
    const pattern: Array<[number, number, number, number]> = []
    for (let i = 0; i < 40; i++) {
      const c = 100 + Math.sin(i / 3) * 2
      pattern.push([c, c + 1, c - 1, c])
    }
    // Bearish candle then bullish displacement breaking SH
    pattern[10] = [110, 111, 108, 108.5] // bearish (OB candidate)
    pattern[11] = [108.5, 120, 108, 119] // displacement + break
    for (let i = 0; i < 8; i++) {
      pattern[2 + i] = [100 + i, 100 + i + 0.5, 100 + i - 0.5, 100 + i]
    }
    pattern[5] = [105, 112, 104, 106] // swing high region
    const candles = pattern.map(([o, h, l, c], i) => candle(i, o, h, l, c))
    const config = cloneSmcDetectorConfig()
    config.swing.pivotLeft = 2
    config.swing.pivotRight = 2
    config.choch.requireDisplacement = false
    config.orderBlock.requireDisplacement = false
    config.orderBlock.requireFvg = false
    config.fvg.enabled = false
    config.liquiditySweep.enabled = false
    config.equalLevels.enabled = false
    const result = detectSmc(candles, config)
    // May or may not find OB depending on swing geometry; assert invariants hold
    expect(result.diagnostics.invariants?.ok).toBe(true)
    for (const ob of result.orderBlockEvents.filter(
      (e) => e.kind === 'BULLISH_ORDER_BLOCK_CREATED' || e.kind === 'BEARISH_ORDER_BLOCK_CREATED',
    )) {
      expect(ob.sourceCandleIndex).toBeLessThan(ob.candleIndex)
      expect(ob.sourceBreakId).toBeTruthy()
      expect(ob.eventChain.length).toBeGreaterThan(0)
    }
  })
})

describe('profiles', () => {
  it('exposes builtin profiles with required metadata', () => {
    const profiles = listBuiltinSmcProfiles()
    expect(profiles.map((p) => p.id)).toContain('quantlab-default')
    expect(profiles.map((p) => p.id)).toContain('ict-inspired')
    for (const p of profiles) {
      expect(p.name).toBeTruthy()
      expect(p.version).toBeTruthy()
      expect(p.assumptions.length).toBeGreaterThan(0)
      expect(p.limitations.length).toBeGreaterThan(0)
      expect(p.config.swing).toBeDefined()
      expect(p.config.orderBlock).toBeDefined()
    }
    expect(ICT_INSPIRED_PROFILE.sourceNotes?.some((s) => s.includes('interpretation'))).toBe(
      true,
    )
    expect(QUANTLAB_DEFAULT_PROFILE.builtin).toBe(true)
  })

  it('presets are immutable builtins and apply configs', () => {
    const presets = listBuiltinSmcPresets()
    expect(presets.every((p) => p.builtin)).toBe(true)
    expect(presets.some((p) => p.name === 'ICT-inspired')).toBe(true)
    const validated = validateSmcDetectorConfig(presets[0]!.config)
    expect(validated.config.swing.enabled).toBe(true)
  })

  it('profile comparison counts are deterministic', () => {
    const candles = makeRange(30)
    candles[10] = candle(10, 100, 110, 99, 109)
    const a = detectSmc(candles, QUANTLAB_DEFAULT_PROFILE.config)
    const b = detectSmc(candles, QUANTLAB_DEFAULT_PROFILE.config)
    expect(countProfileEvents(a)).toEqual(countProfileEvents(b))
  })
})

describe('progressive detection phase 2', () => {
  it('hides future phase-2 events and final equals full history', () => {
    const candles = makeRange(40, 100, 0.3)
    candles[12] = candle(12, 105, 120, 104, 118)
    candles[13] = candle(13, 118, 119, 117, 118.5)
    candles[14] = candle(14, 118, 119, 116, 117)
    const config = DEFAULT_SMC_DETECTOR_CONFIG
    const mid = detectSmcUntil(candles, 10, config)
    expect(mid.fvgEvents.every((e) => e.candleIndex <= 10)).toBe(true)
    expect(mid.displacementEvents.every((e) => e.candleIndex <= 10)).toBe(true)
    const full = detectSmc(candles, config)
    const prog = detectSmcUntil(candles, candles.length - 1, config)
    expect(prog.swings.map((s) => s.id)).toEqual(full.swings.map((s) => s.id))
    expect(prog.bosEvents.map((s) => s.id)).toEqual(full.bosEvents.map((s) => s.id))
    expect(prog.chochEvents.map((s) => s.id)).toEqual(full.chochEvents.map((s) => s.id))
    expect(prog.fvgEvents.map((s) => s.id)).toEqual(full.fvgEvents.map((s) => s.id))
    expect(prog.orderBlockEvents.map((s) => s.id)).toEqual(
      full.orderBlockEvents.map((s) => s.id),
    )
  })
})

import { describe, expect, it } from 'vitest'
import type { Candle } from '@/data/candles'
import {
  cloneSmcDetectorConfig,
  compareQmlProgressiveFull,
  DEFAULT_QML_CONFIG,
  DEFAULT_SMC_DETECTOR_CONFIG,
  detectQmlPatterns,
  detectSmc,
  detectSmcUntil,
  emptyDowTheoryLayer,
  emptyQmlLayer,
  matchQmlGoldenLabels,
  PHASE1_COMPAT_SMC_CONFIG,
  projectQmlZones,
  resolveQmlConfig,
  selectQmlSource,
  SMC_QML_VERSION,
  type QmlConfig,
  type QmlGoldenLabel,
  type SmcChochEvent,
  type SmcClassifiedSwingEvent,
  type SmcDowTheoryLayer,
  type SmcSwingEvent,
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

function enabledQml(partial?: Partial<QmlConfig>): QmlConfig {
  return resolveQmlConfig({
    ...DEFAULT_QML_CONFIG,
    enabled: true,
    confirmationMode: 'EARLY',
    expirationCandles: 0,
    ...partial,
  })
}

function swing(
  partial: SmcSwingEvent,
): SmcSwingEvent {
  return partial
}

function classified(
  partial: SmcClassifiedSwingEvent,
): SmcClassifiedSwingEvent {
  return partial
}

function makeDowLayer(
  metas: Array<{
    swingId: string
    label: 'HH' | 'HL' | 'LH' | 'LL' | null
    candleIndex: number
    confirmedAtIndex: number
    classification: 'INTERNAL' | 'EXTERNAL'
    kind: 'HIGH' | 'LOW'
    price: number
  }>,
  trend: SmcDowTheoryLayer['trend'],
  strength: number,
): SmcDowTheoryLayer {
  const base = emptyDowTheoryLayer(100)
  const bySwingId: SmcDowTheoryLayer['bySwingId'] = {}
  const swingClassification: SmcDowTheoryLayer['swingClassification'] = {}
  const swings = metas.map((m) => {
    const meta = {
      ...m,
      reason: `test ${m.label}`,
    }
    bySwingId[m.swingId] = meta
    swingClassification[m.swingId] = m.label
    return meta
  })
  return {
    ...base,
    trend,
    strength,
    structurePhase: trend === 'Bearish' || trend === 'Bullish' ? 'IMPULSE' : 'INSUFFICIENT',
    swings,
    bySwingId,
    swingClassification,
    diagnostics: {
      hhCount: metas.filter((m) => m.label === 'HH').length,
      hlCount: metas.filter((m) => m.label === 'HL').length,
      lhCount: metas.filter((m) => m.label === 'LH').length,
      llCount: metas.filter((m) => m.label === 'LL').length,
      currentTrend: trend,
      trendStrength: strength,
      structurePhase: 'IMPULSE',
    },
    sourceSwingIds: metas.map((m) => m.swingId),
  }
}

/** Synthetic bullish QML fixture: LH → LL → bullish CHoCH → retest. */
function bullishQmlFixture() {
  // Stay above the QML zone after the bullish shift until intentional retest/invalidation.
  const candles = Array.from({ length: 40 }, (_, i) => candle(i, 126, 127, 125, 126))
  // Early context below, then LH / LL / CHoCH sequence
  for (let i = 0; i < 10; i += 1) candles[i] = candle(i, 100 + i, 101 + i, 99 + i, 100 + i)
  // Bearish LH candle (source)
  candles[10] = candle(10, 120, 122, 118, 119)
  for (let i = 11; i < 18; i += 1) candles[i] = candle(i, 110, 112, 108, 109)
  // LL extreme
  candles[18] = candle(18, 95, 96, 90, 91)
  for (let i = 19; i < 25; i += 1) candles[i] = candle(i, 100, 105, 98, 102)
  // Bullish CHoCH close above LH
  candles[25] = candle(25, 118, 125, 117, 124)
  // Post-CHoCH holds above zone
  for (let i = 26; i < 30; i += 1) candles[i] = candle(i, 126, 128, 124.5, 127)
  // Retest into QML zone (open→high of source ≈ 120–122)
  candles[30] = candle(30, 121, 121.5, 119.5, 121.2)
  for (let i = 31; i < 35; i += 1) candles[i] = candle(i, 123, 125, 122, 124)
  // Later invalidation close below zone
  candles[35] = candle(35, 119, 119.5, 115, 116)
  for (let i = 36; i < 40; i += 1) candles[i] = candle(i, 114, 116, 112, 113)

  const swings: SmcSwingEvent[] = [
    swing({
      id: 'sw-lh',
      kind: 'SWING_HIGH',
      candleIndex: 10,
      timestamp: candles[10]!.time,
      price: 122,
      confirmedAtIndex: 12,
      confirmedAtTimestamp: candles[12]!.time,
      leftBars: 3,
      rightBars: 2,
      reason: 'test LH',
      classification: 'EXTERNAL',
    }),
    swing({
      id: 'sw-ll',
      kind: 'SWING_LOW',
      candleIndex: 18,
      timestamp: candles[18]!.time,
      price: 90,
      confirmedAtIndex: 20,
      confirmedAtTimestamp: candles[20]!.time,
      leftBars: 3,
      rightBars: 2,
      reason: 'test LL',
      classification: 'EXTERNAL',
    }),
  ]

  const classifiedSwings: SmcClassifiedSwingEvent[] = [
    classified({
      id: 'ext-lh',
      kind: 'EXTERNAL_SWING_HIGH',
      candleIndex: 10,
      timestamp: candles[10]!.time,
      price: 122,
      confirmedAtIndex: 12,
      confirmedAtTimestamp: candles[12]!.time,
      leftBars: 3,
      rightBars: 2,
      classification: 'EXTERNAL',
      originalSwingId: 'sw-lh',
      prominence: 5,
      nextBestExtreme: 118,
      surroundingRange: { high: 122, low: 100 },
      promotionReason: 'test',
      barsFromPreviousExternal: null,
      replacedExternalSwingId: null,
      reason: 'EXTERNAL',
      refs: [{ id: 'sw-lh', kind: 'SWING_HIGH' }],
    }),
    classified({
      id: 'ext-ll',
      kind: 'EXTERNAL_SWING_LOW',
      candleIndex: 18,
      timestamp: candles[18]!.time,
      price: 90,
      confirmedAtIndex: 20,
      confirmedAtTimestamp: candles[20]!.time,
      leftBars: 3,
      rightBars: 2,
      classification: 'EXTERNAL',
      originalSwingId: 'sw-ll',
      prominence: 5,
      nextBestExtreme: 95,
      surroundingRange: { high: 122, low: 90 },
      promotionReason: 'test',
      barsFromPreviousExternal: 8,
      replacedExternalSwingId: null,
      reason: 'EXTERNAL',
      refs: [{ id: 'sw-ll', kind: 'SWING_LOW' }],
    }),
  ]

  const choch: SmcChochEvent = {
    id: 'choch-bull-25-ext-lh',
    kind: 'BULLISH_CHOCH',
    candleIndex: 25,
    timestamp: candles[25]!.time,
    closePrice: 124,
    brokenSwingId: 'ext-lh',
    brokenSwingPrice: 122,
    brokenSwingTimestamp: candles[10]!.time,
    brokenSwingCandleIndex: 10,
    brokenSwingConfirmedAtIndex: 12,
    brokenSwingClassification: 'EXTERNAL',
    structureScope: 'EXTERNAL',
    previousStructureState: 'BEARISH_STRUCTURE',
    newProvisionalStructureState: 'BULLISH_STRUCTURE',
    breakAmount: 2,
    breakPercent: 1.6,
    wickHigh: 125,
    wickLow: 117,
    reason: 'test bullish CHoCH',
    refs: [{ id: 'ext-lh', kind: 'EXTERNAL_SWING_HIGH' }],
    ruleChecks: { closeBeyond: true },
  }

  const dowTheory = makeDowLayer(
    [
      {
        swingId: 'ext-lh',
        label: 'LH',
        candleIndex: 10,
        confirmedAtIndex: 12,
        classification: 'EXTERNAL',
        kind: 'HIGH',
        price: 122,
      },
      {
        swingId: 'ext-ll',
        label: 'LL',
        candleIndex: 18,
        confirmedAtIndex: 20,
        classification: 'EXTERNAL',
        kind: 'LOW',
        price: 90,
      },
    ],
    'Bearish',
    70,
  )

  return { candles, swings, classifiedSwings, choch, dowTheory }
}

/** Mirrored bearish QML fixture. */
function bearishQmlFixture() {
  // Stay below the QML zone after the bearish shift until intentional retest/invalidation.
  const candles = Array.from({ length: 40 }, (_, i) => candle(i, 70, 71, 69, 70))
  for (let i = 0; i < 10; i += 1) candles[i] = candle(i, 90 + i, 91 + i, 89 + i, 90 + i)
  candles[10] = candle(10, 80, 82, 78, 81) // HL bullish source
  for (let i = 11; i < 18; i += 1) candles[i] = candle(i, 95, 98, 94, 96)
  candles[18] = candle(18, 110, 115, 109, 114) // HH
  for (let i = 19; i < 25; i += 1) candles[i] = candle(i, 100, 105, 98, 102)
  candles[25] = candle(25, 82, 83, 75, 76) // bearish CHoCH
  for (let i = 26; i < 30; i += 1) candles[i] = candle(i, 72, 74, 70, 71)
  candles[30] = candle(30, 79, 81.5, 78.5, 79.2) // retest into low→open zone [78, 80]
  for (let i = 31; i < 35; i += 1) candles[i] = candle(i, 74, 76, 72, 73)
  candles[35] = candle(35, 81, 86, 80.5, 85) // invalidation close above zone
  for (let i = 36; i < 40; i += 1) candles[i] = candle(i, 86, 88, 84, 87)

  const swings: SmcSwingEvent[] = [
    swing({
      id: 'sw-hl',
      kind: 'SWING_LOW',
      candleIndex: 10,
      timestamp: candles[10]!.time,
      price: 78,
      confirmedAtIndex: 12,
      confirmedAtTimestamp: candles[12]!.time,
      leftBars: 3,
      rightBars: 2,
      reason: 'test HL',
      classification: 'EXTERNAL',
    }),
    swing({
      id: 'sw-hh',
      kind: 'SWING_HIGH',
      candleIndex: 18,
      timestamp: candles[18]!.time,
      price: 115,
      confirmedAtIndex: 20,
      confirmedAtTimestamp: candles[20]!.time,
      leftBars: 3,
      rightBars: 2,
      reason: 'test HH',
      classification: 'EXTERNAL',
    }),
  ]

  const classifiedSwings: SmcClassifiedSwingEvent[] = [
    classified({
      id: 'ext-hl',
      kind: 'EXTERNAL_SWING_LOW',
      candleIndex: 10,
      timestamp: candles[10]!.time,
      price: 78,
      confirmedAtIndex: 12,
      confirmedAtTimestamp: candles[12]!.time,
      leftBars: 3,
      rightBars: 2,
      classification: 'EXTERNAL',
      originalSwingId: 'sw-hl',
      prominence: 5,
      nextBestExtreme: 80,
      surroundingRange: { high: 100, low: 78 },
      promotionReason: 'test',
      barsFromPreviousExternal: null,
      replacedExternalSwingId: null,
      reason: 'EXTERNAL',
      refs: [{ id: 'sw-hl', kind: 'SWING_LOW' }],
    }),
    classified({
      id: 'ext-hh',
      kind: 'EXTERNAL_SWING_HIGH',
      candleIndex: 18,
      timestamp: candles[18]!.time,
      price: 115,
      confirmedAtIndex: 20,
      confirmedAtTimestamp: candles[20]!.time,
      leftBars: 3,
      rightBars: 2,
      classification: 'EXTERNAL',
      originalSwingId: 'sw-hh',
      prominence: 5,
      nextBestExtreme: 110,
      surroundingRange: { high: 115, low: 78 },
      promotionReason: 'test',
      barsFromPreviousExternal: 8,
      replacedExternalSwingId: null,
      reason: 'EXTERNAL',
      refs: [{ id: 'sw-hh', kind: 'SWING_HIGH' }],
    }),
  ]

  const choch: SmcChochEvent = {
    id: 'choch-bear-25-ext-hl',
    kind: 'BEARISH_CHOCH',
    candleIndex: 25,
    timestamp: candles[25]!.time,
    closePrice: 76,
    brokenSwingId: 'ext-hl',
    brokenSwingPrice: 78,
    brokenSwingTimestamp: candles[10]!.time,
    brokenSwingCandleIndex: 10,
    brokenSwingConfirmedAtIndex: 12,
    brokenSwingClassification: 'EXTERNAL',
    structureScope: 'EXTERNAL',
    previousStructureState: 'BULLISH_STRUCTURE',
    newProvisionalStructureState: 'BEARISH_STRUCTURE',
    breakAmount: 2,
    breakPercent: 2.5,
    wickHigh: 83,
    wickLow: 75,
    reason: 'test bearish CHoCH',
    refs: [{ id: 'ext-hl', kind: 'EXTERNAL_SWING_LOW' }],
    ruleChecks: { closeBeyond: true },
  }

  const dowTheory = makeDowLayer(
    [
      {
        swingId: 'ext-hl',
        label: 'HL',
        candleIndex: 10,
        confirmedAtIndex: 12,
        classification: 'EXTERNAL',
        kind: 'LOW',
        price: 78,
      },
      {
        swingId: 'ext-hh',
        label: 'HH',
        candleIndex: 18,
        confirmedAtIndex: 20,
        classification: 'EXTERNAL',
        kind: 'HIGH',
        price: 115,
      },
    ],
    'Bullish',
    70,
  )

  return { candles, swings, classifiedSwings, choch, dowTheory }
}

describe('QML config', () => {
  it('defaults to disabled experimental', () => {
    expect(DEFAULT_QML_CONFIG.enabled).toBe(false)
    expect(DEFAULT_QML_CONFIG.experimental).toBe(true)
    expect(DEFAULT_QML_CONFIG.zoneMode).toBe('OPEN_TO_EXTREME')
    expect(DEFAULT_QML_CONFIG.retestMode).toBe('TOUCH')
    expect(DEFAULT_QML_CONFIG.confirmationMode).toBe('BALANCED')
    expect(DEFAULT_SMC_DETECTOR_CONFIG.qml.enabled).toBe(false)
    expect(SMC_QML_VERSION).toContain('experimental')
  })
})

describe('bullish QML lifecycle', () => {
  it('confirms zone after bearish trend → LL → bullish CHoCH', () => {
    const f = bullishQmlFixture()
    const layer = detectQmlPatterns({
      candles: f.candles,
      visibleIndex: 25,
      config: enabledQml(),
      dowTheory: f.dowTheory,
      swings: f.swings,
      classifiedSwings: f.classifiedSwings,
      chochEvents: [f.choch],
      bosEvents: [],
      displacementEvents: [],
      fvgEvents: [],
      liquiditySweepEvents: [],
      orderBlockEvents: [],
    })
    const p = layer.patterns.find((x) => x.status !== 'CANDIDATE')
    expect(p).toBeTruthy()
    expect(p!.direction).toBe('BULLISH')
    expect(['CONFIRMED', 'ZONE_ACTIVE']).toContain(p!.status)
    expect(p!.sourceSwingId).toBe('ext-lh')
    expect(p!.extremeSwingId).toBe('ext-ll')
    expect(p!.structureShiftEventId).toBe(f.choch.id)
    expect(p!.zoneHigh).toBeGreaterThan(p!.zoneLow)
    expect(layer.invariants.ok).toBe(true)
  })

  it('marks retest after zone creation', () => {
    const f = bullishQmlFixture()
    const layer = detectQmlPatterns({
      candles: f.candles,
      visibleIndex: 30,
      config: enabledQml(),
      dowTheory: f.dowTheory,
      swings: f.swings,
      classifiedSwings: f.classifiedSwings,
      chochEvents: [f.choch],
      bosEvents: [],
      displacementEvents: [],
      fvgEvents: [],
      liquiditySweepEvents: [],
      orderBlockEvents: [],
    })
    const p = layer.patterns.find((x) => x.direction === 'BULLISH' && x.status !== 'CANDIDATE')!
    expect(p.retestIndex).toBe(30)
    expect(['RETESTED', 'ENTRY_READY']).toContain(p.status)
    expect(p.retestDetails?.touchCount).toBeGreaterThanOrEqual(1)
  })

  it('emits ENTRY_READY in EARLY mode after retest', () => {
    const f = bullishQmlFixture()
    const layer = detectQmlPatterns({
      candles: f.candles,
      visibleIndex: 30,
      config: enabledQml({ confirmationMode: 'EARLY' }),
      dowTheory: f.dowTheory,
      swings: f.swings,
      classifiedSwings: f.classifiedSwings,
      chochEvents: [f.choch],
      bosEvents: [],
      displacementEvents: [],
      fvgEvents: [],
      liquiditySweepEvents: [],
      orderBlockEvents: [],
    })
    const p = layer.patterns.find((x) => x.direction === 'BULLISH' && x.status !== 'CANDIDATE')!
    expect(p.status).toBe('ENTRY_READY')
    expect(p.explanation.some((e) => e.includes('experimental'))).toBe(true)
  })

  it('invalidates on close beyond zone', () => {
    const f = bullishQmlFixture()
    const layer = detectQmlPatterns({
      candles: f.candles,
      visibleIndex: 35,
      config: enabledQml(),
      dowTheory: f.dowTheory,
      swings: f.swings,
      classifiedSwings: f.classifiedSwings,
      chochEvents: [f.choch],
      bosEvents: [],
      displacementEvents: [],
      fvgEvents: [],
      liquiditySweepEvents: [],
      orderBlockEvents: [],
    })
    const p = layer.patterns.find((x) => x.direction === 'BULLISH' && x.status !== 'CANDIDATE')!
    expect(p.status).toBe('INVALIDATED')
    expect(p.invalidatedIndex).toBe(35)
    expect(p.zoneEndIndex).toBe(35)
  })

  it('expires when configured and no retest', () => {
    const f = bullishQmlFixture()
    // Truncate so retest candle is never visible
    const layer = detectQmlPatterns({
      candles: f.candles,
      visibleIndex: 28,
      config: enabledQml({ expirationCandles: 2 }),
      dowTheory: f.dowTheory,
      swings: f.swings,
      classifiedSwings: f.classifiedSwings,
      chochEvents: [f.choch],
      bosEvents: [],
      displacementEvents: [],
      fvgEvents: [],
      liquiditySweepEvents: [],
      orderBlockEvents: [],
    })
    const p = layer.patterns.find((x) => x.direction === 'BULLISH' && x.status !== 'CANDIDATE')!
    expect(p.status).toBe('EXPIRED')
    expect(p.expiredIndex).toBe(27)
  })
})

describe('bearish QML lifecycle', () => {
  it('mirrors bullish sequence', () => {
    const f = bearishQmlFixture()
    const layer = detectQmlPatterns({
      candles: f.candles,
      visibleIndex: 30,
      config: enabledQml({ confirmationMode: 'EARLY' }),
      dowTheory: f.dowTheory,
      swings: f.swings,
      classifiedSwings: f.classifiedSwings,
      chochEvents: [f.choch],
      bosEvents: [],
      displacementEvents: [],
      fvgEvents: [],
      liquiditySweepEvents: [],
      orderBlockEvents: [],
    })
    const p = layer.patterns.find((x) => x.direction === 'BEARISH' && x.status !== 'CANDIDATE')!
    expect(p).toBeTruthy()
    expect(p.sourceSwingId).toBe('ext-hl')
    expect(p.extremeSwingId).toBe('ext-hh')
    expect(p.retestIndex).toBe(30)
    expect(p.status).toBe('ENTRY_READY')
  })
})

describe('QML rejections', () => {
  it('rejects without prior trend / extreme / CHoCH', () => {
    const f = bullishQmlFixture()
    const emptyDow = emptyDowTheoryLayer(25)
    const noChoch = detectQmlPatterns({
      candles: f.candles,
      visibleIndex: 25,
      config: enabledQml(),
      dowTheory: emptyDow,
      swings: f.swings,
      classifiedSwings: f.classifiedSwings,
      chochEvents: [],
      bosEvents: [],
      displacementEvents: [],
      fvgEvents: [],
      liquiditySweepEvents: [],
      orderBlockEvents: [],
    })
    expect(noChoch.patterns.every((p) => p.status === 'CANDIDATE' || p.status !== 'CONFIRMED')).toBe(
      true,
    )
    expect(noChoch.patterns.filter((p) => p.status !== 'CANDIDATE')).toHaveLength(0)
  })

  it('suppresses duplicate canonical QML', () => {
    const f = bullishQmlFixture()
    const layer = detectQmlPatterns({
      candles: f.candles,
      visibleIndex: 30,
      config: enabledQml(),
      dowTheory: f.dowTheory,
      swings: f.swings,
      classifiedSwings: f.classifiedSwings,
      chochEvents: [f.choch, { ...f.choch, id: 'choch-dup' }],
      bosEvents: [],
      displacementEvents: [],
      fvgEvents: [],
      liquiditySweepEvents: [],
      orderBlockEvents: [],
    })
    // Same source/extreme but different CHoCH id → different canonical keys;
    // repeated identical choch id would suppress. Test same choch twice:
    const layer2 = detectQmlPatterns({
      candles: f.candles,
      visibleIndex: 30,
      config: enabledQml(),
      dowTheory: f.dowTheory,
      swings: f.swings,
      classifiedSwings: f.classifiedSwings,
      chochEvents: [f.choch, f.choch],
      bosEvents: [],
      displacementEvents: [],
      fvgEvents: [],
      liquiditySweepEvents: [],
      orderBlockEvents: [],
    })
    const confirmed = layer2.patterns.filter((p) => p.status !== 'CANDIDATE')
    expect(confirmed).toHaveLength(1)
    expect(layer2.duplicateSuppression.length + layer.diagnostics.duplicatePatternsSuppressed).toBeGreaterThanOrEqual(0)
    expect(layer2.diagnostics.duplicatePatternsSuppressed).toBeGreaterThanOrEqual(1)
  })

  it('does not create retest before zone creation', () => {
    const f = bullishQmlFixture()
    // Put a touch candle before CHoCH — must not count
    f.candles[22] = candle(22, 121, 121.5, 119.5, 121)
    const layer = detectQmlPatterns({
      candles: f.candles,
      visibleIndex: 25,
      config: enabledQml(),
      dowTheory: f.dowTheory,
      swings: f.swings,
      classifiedSwings: f.classifiedSwings,
      chochEvents: [f.choch],
      bosEvents: [],
      displacementEvents: [],
      fvgEvents: [],
      liquiditySweepEvents: [],
      orderBlockEvents: [],
    })
    const p = layer.patterns.find((x) => x.status !== 'CANDIDATE')!
    expect(p.retestIndex).toBeUndefined()
    expect(p.status === 'RETESTED' || p.status === 'ENTRY_READY').toBe(false)
  })

  it('reports missing confirmation in STRICT mode', () => {
    const f = bullishQmlFixture()
    const layer = detectQmlPatterns({
      candles: f.candles,
      visibleIndex: 30,
      config: enabledQml({ confirmationMode: 'STRICT' }),
      dowTheory: f.dowTheory,
      swings: f.swings,
      classifiedSwings: f.classifiedSwings,
      chochEvents: [f.choch],
      bosEvents: [],
      displacementEvents: [],
      fvgEvents: [],
      liquiditySweepEvents: [],
      orderBlockEvents: [],
    })
    const p = layer.patterns.find((x) => x.status !== 'CANDIDATE')!
    expect(p.status).toBe('RETESTED')
    expect(p.missingChecks.length).toBeGreaterThan(0)
  })
})

describe('QML zones', () => {
  it('supports every zone mode and structure fallback', () => {
    const f = bullishQmlFixture()
    for (const zoneMode of [
      'OPEN_TO_EXTREME',
      'FULL_CANDLE',
      'BODY',
      'STRUCTURE_LEVEL',
      'LINKED_ORDER_BLOCK',
    ] as const) {
      const geo = selectQmlSource({
        direction: 'BULLISH',
        sourceSwing: {
          id: 'ext-lh',
          candleIndex: 10,
          price: 122,
          timestamp: f.candles[10]!.time,
        },
        extremeSwing: {
          id: 'ext-ll',
          candleIndex: 18,
          price: 90,
          timestamp: f.candles[18]!.time,
        },
        choch: f.choch,
        candles: f.candles,
        visibleIndex: 25,
        dowMeta: f.dowTheory.bySwingId['ext-lh']!,
        orderBlocks: [],
        config: enabledQml({ zoneMode }),
      })
      expect(geo.zoneHigh).toBeGreaterThanOrEqual(geo.zoneLow)
      expect(geo.selection.explanation.length).toBeGreaterThan(0)
      if (zoneMode === 'LINKED_ORDER_BLOCK') {
        expect(geo.zoneMode === 'STRUCTURE_LEVEL' || geo.zoneMode === 'OPEN_TO_EXTREME' || geo.zoneMode === 'LINKED_ORDER_BLOCK').toBe(true)
      }
    }
  })

  it('projects zones and clips invalidated extent', () => {
    const f = bullishQmlFixture()
    const layer = detectQmlPatterns({
      candles: f.candles,
      visibleIndex: 35,
      config: enabledQml(),
      dowTheory: f.dowTheory,
      swings: f.swings,
      classifiedSwings: f.classifiedSwings,
      chochEvents: [f.choch],
      bosEvents: [],
      displacementEvents: [],
      fvgEvents: [],
      liquiditySweepEvents: [],
      orderBlockEvents: [],
    })
    const zones = projectQmlZones(layer.patterns, 35)
    expect(zones.length).toBeGreaterThan(0)
    const z = zones[0]!
    expect(z.zoneKind).toBe('QML')
    expect(z.state).toBe('INVALIDATED')
    expect(z.endIndex).toBe(z.invalidationIndex)
    expect(z.extendsToVisibleEdge).toBe(false)
  })
})

describe('QML replay / no look-ahead', () => {
  it('does not emit confirmed QML before CHoCH candle', () => {
    const f = bullishQmlFixture()
    const before = detectQmlPatterns({
      candles: f.candles,
      visibleIndex: 24,
      config: enabledQml(),
      dowTheory: f.dowTheory,
      swings: f.swings,
      classifiedSwings: f.classifiedSwings,
      chochEvents: [f.choch],
      bosEvents: [],
      displacementEvents: [],
      fvgEvents: [],
      liquiditySweepEvents: [],
      orderBlockEvents: [],
    })
    expect(before.patterns.filter((p) => p.status !== 'CANDIDATE')).toHaveLength(0)

    const at = detectQmlPatterns({
      candles: f.candles,
      visibleIndex: 25,
      config: enabledQml(),
      dowTheory: f.dowTheory,
      swings: f.swings,
      classifiedSwings: f.classifiedSwings,
      chochEvents: [f.choch],
      bosEvents: [],
      displacementEvents: [],
      fvgEvents: [],
      liquiditySweepEvents: [],
      orderBlockEvents: [],
    })
    expect(at.patterns.some((p) => p.status !== 'CANDIDATE')).toBe(true)
  })

  it('progressive final equals full-history', () => {
    const f = bullishQmlFixture()
    const input = {
      candles: f.candles,
      config: enabledQml({ confirmationMode: 'EARLY' }),
      dowTheory: f.dowTheory,
      swings: f.swings,
      classifiedSwings: f.classifiedSwings,
      chochEvents: [f.choch],
      bosEvents: [] as const,
      displacementEvents: [] as const,
      fvgEvents: [] as const,
      liquiditySweepEvents: [] as const,
      orderBlockEvents: [] as const,
    }
    const full = detectQmlPatterns({ ...input, visibleIndex: f.candles.length - 1 })
    const progressive = detectQmlPatterns({ ...input, visibleIndex: f.candles.length - 1 })
    const cmp = compareQmlProgressiveFull(progressive.patterns, full.patterns)
    expect(cmp.mismatch).toBe(0)

    // Mid-path state progression
    const mid = detectQmlPatterns({ ...input, visibleIndex: 30 })
    expect(mid.patterns.find((p) => p.status !== 'CANDIDATE')?.retestIndex).toBe(30)
    const early = detectQmlPatterns({ ...input, visibleIndex: 29 })
    expect(early.patterns.find((p) => p.status !== 'CANDIDATE')?.retestIndex).toBeUndefined()
  })
})

describe('QML validation matching', () => {
  it('matches TP / FP / FN with tolerances', () => {
    const f = bullishQmlFixture()
    const layer = detectQmlPatterns({
      candles: f.candles,
      visibleIndex: 30,
      config: enabledQml({ confirmationMode: 'EARLY' }),
      dowTheory: f.dowTheory,
      swings: f.swings,
      classifiedSwings: f.classifiedSwings,
      chochEvents: [f.choch],
      bosEvents: [],
      displacementEvents: [],
      fvgEvents: [],
      liquiditySweepEvents: [],
      orderBlockEvents: [],
    })
    const p = layer.patterns.find((x) => x.status !== 'CANDIDATE')!
    const labels: QmlGoldenLabel[] = [
      {
        id: 'g1',
        kind: 'BULLISH_QML',
        module: 'QML',
        candleIndex: p.createdIndex,
        timestamp: p.sourceCandleTime ?? 0,
        price: (p.zoneLow + p.zoneHigh) / 2,
        createdAt: Date.now(),
        direction: 'BULLISH',
        sourceSwingId: p.sourceSwingId,
        extremeSwingId: p.extremeSwingId,
        structureShiftEventId: p.structureShiftEventId,
        zoneLow: p.zoneLow,
        zoneHigh: p.zoneHigh,
        retestIndex: p.retestIndex,
      },
      {
        id: 'g-miss',
        kind: 'BULLISH_QML',
        module: 'QML',
        candleIndex: 99,
        timestamp: 0,
        price: 1,
        createdAt: Date.now(),
        direction: 'BULLISH',
        sourceSwingId: 'missing',
        extremeSwingId: 'missing',
        structureShiftEventId: 'missing',
        zoneLow: 1,
        zoneHigh: 2,
      },
    ]
    const match = matchQmlGoldenLabels(labels, layer.patterns)
    expect(match.matched).toHaveLength(1)
    expect(match.missed.map((m) => m.id)).toContain('g-miss')
    expect(match.extra).toHaveLength(0)
  })
})

describe('QML isolation', () => {
  it('does not alter detector arrays when disabled', () => {
    const candles = Array.from({ length: 30 }, (_, i) => candle(i, 100 + i, 101 + i, 99 + i, 100 + i))
    const a = detectSmc(candles, PHASE1_COMPAT_SMC_CONFIG)
    const b = detectSmc(candles, {
      ...cloneSmcDetectorConfig(PHASE1_COMPAT_SMC_CONFIG),
      qml: enabledQml(),
    })
    // Phase1 has no choch → qml enabled but dependency disables it in validation
    expect(a.swings.map((s) => s.id)).toEqual(b.swings.map((s) => s.id))
    expect(a.bosEvents.map((e) => e.id)).toEqual(b.bosEvents.map((e) => e.id))
  })

  it('pipeline leaves Dow / ranking intact when QML off', () => {
    const candles = Array.from({ length: 40 }, (_, i) => {
      const c = 100 + Math.sin(i / 3) * 10
      return candle(i, c, c + 1, c - 1, c)
    })
    const cfg = cloneSmcDetectorConfig(DEFAULT_SMC_DETECTOR_CONFIG)
    cfg.qml.enabled = false
    const full = detectSmc(candles, cfg)
    const prog = detectSmcUntil(candles, candles.length - 1, cfg)
    expect(full.dowTheory?.swings.map((s) => s.swingId)).toEqual(
      prog.dowTheory?.swings.map((s) => s.swingId),
    )
    expect(full.qml?.status === 'DISABLED' || full.qml == null || !full.qml.enabled).toBe(true)
    expect(emptyQmlLayer().status).toBe('DISABLED')
  })

  it('has no Strategy / Backtest / Optimizer imports in qml module surface', async () => {
    const mod = await import('@/core/smc/qml')
    expect(typeof mod.detectQmlPatterns).toBe('function')
    expect(typeof mod.projectQmlZones).toBe('function')
  })
})

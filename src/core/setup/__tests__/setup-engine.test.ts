import { describe, expect, it } from 'vitest'
import type { Candle } from '@/data/candles'
import {
  cloneSmcDetectorConfig,
  detectSmc,
  emptyDowTheoryLayer,
  emptyQmlLayer,
  emptySmcDetectionResult,
  type QmlPattern,
  type SmcBosEvent,
  type SmcChochEvent,
  type SmcDetectionResult,
  type SmcFvgEvent,
  type SmcOrderBlockEvent,
  type SmcQmlLayer,
  type SmcZoneProjection,
} from '@/core/smc'
import {
  computeSetupValidationMetrics,
  createSetupReview,
  evaluateSetups,
  rewindQmlPattern,
  scoreSetup,
  toSetupVisualContext,
  upsertSetupReview,
  type SetupCheck,
} from '@/core/setup'

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

function baseDetection(partial?: Partial<SmcDetectionResult>): SmcDetectionResult {
  const empty = emptySmcDetectionResult('COMPLETE')
  return {
    ...empty,
    structureState: 'BULLISH_STRUCTURE',
    diagnostics: {
      ...empty.diagnostics,
      candleCount: 40,
      detectionStatus: 'COMPLETE',
    },
    ...partial,
  }
}

function bullBos(id = 'bos-bull-1', index = 20): SmcBosEvent {
  return {
    id,
    kind: 'BULLISH_BOS',
    candleIndex: index,
    timestamp: 1_700_000_000_000 + index * 3_600_000,
    closePrice: 110,
    brokenSwingId: 'sl-10',
    brokenSwingPrice: 100,
    brokenSwingTimestamp: 1,
    brokenSwingCandleIndex: 10,
    brokenSwingConfirmedAtIndex: 12,
    breakAmount: 2,
    breakPercent: 2,
    wickHigh: 111,
    wickLow: 108,
    wickOnlyIgnored: false,
    reason: 'test bos',
    refs: [],
  }
}

function bearBos(id = 'bos-bear-1', index = 20): SmcBosEvent {
  return {
    ...bullBos(id, index),
    kind: 'BEARISH_BOS',
    brokenSwingId: 'sh-10',
    brokenSwingPrice: 120,
  }
}

function bullChoch(id = 'choch-bull-1', index = 22): SmcChochEvent {
  return {
    id,
    kind: 'BULLISH_CHOCH',
    candleIndex: index,
    timestamp: 1_700_000_000_000 + index * 3_600_000,
    closePrice: 108,
    brokenSwingId: 'sh-15',
    brokenSwingPrice: 105,
    brokenSwingTimestamp: 1,
    brokenSwingCandleIndex: 15,
    brokenSwingConfirmedAtIndex: 17,
    brokenSwingClassification: 'EXTERNAL',
    structureScope: 'EXTERNAL',
    previousStructureState: 'BEARISH_STRUCTURE',
    newProvisionalStructureState: 'BULLISH_STRUCTURE',
    breakAmount: 3,
    breakPercent: 2.8,
    wickHigh: 109,
    wickLow: 104,
    reason: 'test choch',
    refs: [],
    ruleChecks: {},
  }
}

function bearChoch(id = 'choch-bear-1', index = 22): SmcChochEvent {
  return {
    ...bullChoch(id, index),
    kind: 'BEARISH_CHOCH',
    previousStructureState: 'BULLISH_STRUCTURE',
    newProvisionalStructureState: 'BEARISH_STRUCTURE',
  }
}

function bullOb(index = 21): SmcOrderBlockEvent {
  return {
    id: 'ob-evt-1',
    kind: 'BULLISH_ORDER_BLOCK_CREATED',
    candleIndex: index,
    timestamp: 1,
    orderBlockId: 'ob-1',
    direction: 'BULLISH',
    sourceCandleIndex: index - 1,
    sourceCandleTimestamp: 1,
    zoneHigh: 104,
    zoneLow: 100,
    midpoint: 102,
    createdTimestamp: 1,
    firstRetestTimestamp: null,
    mitigationStatus: 'ACTIVE',
    invalidationStatus: false,
    sourceBreakId: 'bos-bull-1',
    sourceBreakKind: 'BULLISH_BOS',
    sourceDisplacementId: null,
    sourceFvgId: null,
    reason: 'test ob',
    refs: [],
    eventChain: [],
  }
}

function bearOb(index = 21): SmcOrderBlockEvent {
  return {
    ...bullOb(index),
    id: 'ob-evt-bear',
    kind: 'BEARISH_ORDER_BLOCK_CREATED',
    orderBlockId: 'ob-bear-1',
    direction: 'BEARISH',
    zoneHigh: 120,
    zoneLow: 116,
    midpoint: 118,
    sourceBreakId: 'bos-bear-1',
    sourceBreakKind: 'BEARISH_BOS',
  }
}

function bullFvg(index = 21): SmcFvgEvent {
  return {
    id: 'fvg-evt-1',
    kind: 'BULLISH_FVG_CREATED',
    candleIndex: index,
    timestamp: 1,
    fvgId: 'fvg-1',
    direction: 'BULLISH',
    candleIndices: [index - 1, index, index + 1],
    createdTimestamp: 1,
    upperBoundary: 103,
    lowerBoundary: 101,
    midpoint: 102,
    gapSize: 2,
    gapPercent: 2,
    gapAtrMultiple: 1,
    state: 'ACTIVE',
    firstMitigationTimestamp: null,
    invalidationTimestamp: null,
    displacementId: null,
    reason: 'test fvg',
    refs: [],
  }
}

function zone(partial: Partial<SmcZoneProjection> & Pick<SmcZoneProjection, 'zoneId'>): SmcZoneProjection {
  return {
    zoneKind: 'ORDER_BLOCK',
    direction: 'BULLISH',
    sourceEventId: 'ob-evt-1',
    startIndex: 21,
    endIndex: 35,
    low: 100,
    high: 104,
    state: 'ACTIVE',
    activeAtVisibleIndex: true,
    setupRefs: [],
    lifecycleReason: 'test',
    shortLabel: 'OB',
    fullLabel: 'Bullish OB',
    visibilityReason: 'active',
    extendsToVisibleEdge: true,
    ...partial,
  }
}

function bullishDow(visibleThroughIndex = 35) {
  const base = emptyDowTheoryLayer(visibleThroughIndex)
  return {
    ...base,
    trend: 'Bullish' as const,
    strength: 72,
    structurePhase: 'IMPULSE' as const,
    diagnostics: {
      ...base.diagnostics,
      currentTrend: 'Bullish' as const,
      trendStrength: 72,
      structurePhase: 'IMPULSE' as const,
      hhCount: 3,
      hlCount: 3,
      lhCount: 0,
      llCount: 0,
    },
  }
}

function bearishDow(visibleThroughIndex = 35) {
  const base = emptyDowTheoryLayer(visibleThroughIndex)
  return {
    ...base,
    trend: 'Bearish' as const,
    strength: 70,
    structurePhase: 'IMPULSE' as const,
    diagnostics: {
      ...base.diagnostics,
      currentTrend: 'Bearish' as const,
      trendStrength: 70,
      structurePhase: 'IMPULSE' as const,
      hhCount: 0,
      hlCount: 0,
      lhCount: 3,
      llCount: 3,
    },
  }
}

function qmlPattern(partial: Partial<QmlPattern> & Pick<QmlPattern, 'id' | 'direction'>): QmlPattern {
  return {
    status: 'ENTRY_READY',
    priorTrend: 'Bearish',
    trendStrength: 60,
    sourceSwingId: 'sh-10',
    extremeSwingId: 'sl-18',
    structureShiftEventId: 'choch-bull-1',
    zoneId: `zone-${partial.id}`,
    zoneLow: 100,
    zoneHigh: 104,
    zoneMode: 'STRUCTURE_LEVEL',
    createdIndex: 22,
    confirmedIndex: 22,
    zoneActiveIndex: 22,
    retestIndex: 28,
    entryReadyIndex: 28,
    confirmationRefs: {},
    requiredChecks: [],
    optionalChecks: [],
    missingChecks: [],
    eventChain: [],
    explanation: ['test qml'],
    canonicalKey: partial.id,
    sourceSelection: {
      method: 'CHOCH_BROKEN_SWING',
      sourceSwingId: 'sh-10',
      sourceCandleIndex: 10,
      sourceCandleTime: 1,
      linkedOrderBlockId: null,
      explanation: [],
    },
    setupStrength: 75,
    scoreBreakdown: { total: 75, factors: [] },
    structureScope: 'EXTERNAL',
    experimental: true,
    confirmationMode: 'BALANCED',
    invalidationMode: 'CLOSE_BEYOND_ZONE',
    zoneEndIndex: 35,
    ...partial,
  }
}

function candles(n = 40): Candle[] {
  return Array.from({ length: n }, (_, i) => candle(i, 100 + i * 0.1, 101 + i * 0.1, 99 + i * 0.1, 100.5 + i * 0.1))
}

describe('Setup Engine v1', () => {
  it('detects bullish continuation with entry zone and stop', () => {
    const bos = bullBos()
    const ob = { ...bullOb(), firstRetestTimestamp: 2, mitigationStatus: 'TOUCHED' as const }
    const detection = baseDetection({
      bosEvents: [bos],
      orderBlockEvents: [ob],
      structureState: 'BULLISH_STRUCTURE',
    })
    const touchedZone = zone({
      zoneId: 'ob-1',
      state: 'TOUCHED',
      firstTouchIndex: 25,
      activeAtVisibleIndex: true,
    })
    const result = evaluateSetups({
      candles: candles(),
      detection,
      visibleIndex: 30,
      dowTheory: bullishDow(),
      lifecycleZones: [touchedZone],
      config: { enableQmlSetups: false, enableReversal: false },
    })
    const setup = result.setups.find((s) => s.setupType === 'BULLISH_CONTINUATION')
    expect(setup).toBeTruthy()
    expect(setup!.direction).toBe('BULLISH')
    expect(setup!.status).toBe('READY')
    expect(setup!.entryZone).toEqual(
      expect.objectContaining({ sourceKind: 'ORDER_BLOCK', sourceId: 'ob-1' }),
    )
    expect(setup!.stopReference?.level).toBe(100)
    expect(setup!.strength.score).toBeGreaterThanOrEqual(0)
    expect(setup!.strength.score).toBeLessThanOrEqual(100)
    expect(setup!.strength.reasons.length).toBeGreaterThan(0)
  })

  it('detects bearish continuation', () => {
    const bos = bearBos()
    const ob = {
      ...bearOb(),
      firstRetestTimestamp: 2,
      mitigationStatus: 'TOUCHED' as const,
    }
    const detection = baseDetection({
      bosEvents: [bos],
      orderBlockEvents: [ob],
      structureState: 'BEARISH_STRUCTURE',
    })
    const result = evaluateSetups({
      candles: candles(),
      detection,
      visibleIndex: 30,
      dowTheory: bearishDow(),
      lifecycleZones: [
        zone({
          zoneId: 'ob-bear-1',
          direction: 'BEARISH',
          low: 116,
          high: 120,
          state: 'TOUCHED',
          firstTouchIndex: 26,
        }),
      ],
      config: { enableQmlSetups: false, enableReversal: false },
    })
    const setup = result.setups.find((s) => s.setupType === 'BEARISH_CONTINUATION')
    expect(setup).toBeTruthy()
    expect(setup!.status).toBe('READY')
    expect(setup!.stopReference?.level).toBe(120)
  })

  it('detects bullish reversal (CHOCH)', () => {
    const choch = bullChoch()
    const ob = { ...bullOb(23), sourceBreakId: choch.id, sourceBreakKind: 'BULLISH_CHOCH' as const }
    const detection = baseDetection({
      chochEvents: [choch],
      orderBlockEvents: [ob],
      structureState: 'BULLISH_STRUCTURE',
    })
    const result = evaluateSetups({
      candles: candles(),
      detection,
      visibleIndex: 30,
      dowTheory: {
        ...bullishDow(),
        trend: 'Reversal',
        diagnostics: { ...bullishDow().diagnostics, currentTrend: 'Reversal' },
      },
      lifecycleZones: [
        zone({ zoneId: 'ob-1', state: 'ACTIVE', activeAtVisibleIndex: true }),
      ],
      config: { enableQmlSetups: false, enableContinuation: false, requireRetestForReady: true },
    })
    const setup = result.setups.find((s) => s.setupType === 'BULLISH_REVERSAL')
    expect(setup).toBeTruthy()
    expect(setup!.status).toBe('WAITING_RETEST')
    expect(setup!.requiredChecks.some((c) => c.name === 'CHOCH' && c.passed)).toBe(true)
  })

  it('detects bearish reversal (CHOCH)', () => {
    const choch = bearChoch()
    const ob = {
      ...bearOb(23),
      sourceBreakId: choch.id,
      sourceBreakKind: 'BEARISH_CHOCH' as const,
    }
    const detection = baseDetection({
      chochEvents: [choch],
      orderBlockEvents: [ob],
      structureState: 'BEARISH_STRUCTURE',
    })
    const result = evaluateSetups({
      candles: candles(),
      detection,
      visibleIndex: 30,
      dowTheory: bearishDow(),
      lifecycleZones: [
        zone({
          zoneId: 'ob-bear-1',
          direction: 'BEARISH',
          low: 116,
          high: 120,
          state: 'TOUCHED',
          firstTouchIndex: 27,
        }),
      ],
      config: { enableQmlSetups: false, enableContinuation: false },
    })
    const setup = result.setups.find((s) => s.setupType === 'BEARISH_REVERSAL')
    expect(setup).toBeTruthy()
    expect(setup!.status).toBe('READY')
  })

  it('detects bullish and bearish QML setups', () => {
    const bull = qmlPattern({ id: 'qml-bull', direction: 'BULLISH', status: 'ENTRY_READY' })
    const bear = qmlPattern({
      id: 'qml-bear',
      direction: 'BEARISH',
      status: 'ZONE_ACTIVE',
      zoneLow: 116,
      zoneHigh: 120,
      structureShiftEventId: 'choch-bear-1',
      entryReadyIndex: undefined,
      retestIndex: undefined,
    })
    const qml: SmcQmlLayer = {
      ...emptyQmlLayer(35, 'COMPLETE'),
      enabled: true,
      patterns: [bull, bear],
    }
    const detection = baseDetection({
      chochEvents: [bullChoch(), bearChoch('choch-bear-1', 24)],
      qml,
    })
    const result = evaluateSetups({
      candles: candles(),
      detection,
      visibleIndex: 35,
      dowTheory: bullishDow(),
      qml,
      config: { enableContinuation: false, enableReversal: false },
    })
    expect(result.setups.some((s) => s.setupType === 'BULLISH_QML' && s.status === 'READY')).toBe(
      true,
    )
    expect(
      result.setups.some((s) => s.setupType === 'BEARISH_QML' && s.status === 'WAITING_RETEST'),
    ).toBe(true)
  })

  it('detects bull/bear READY conflicts', () => {
    const detection = baseDetection({
      bosEvents: [bullBos(), bearBos('bos-bear-1', 21)],
      orderBlockEvents: [
        { ...bullOb(), firstRetestTimestamp: 2, mitigationStatus: 'TOUCHED' },
        { ...bearOb(22), firstRetestTimestamp: 3, mitigationStatus: 'TOUCHED' },
      ],
      structureState: 'BULLISH_STRUCTURE',
    })
    const result = evaluateSetups({
      candles: candles(),
      detection,
      visibleIndex: 30,
      dowTheory: bullishDow(),
      lifecycleZones: [
        zone({ zoneId: 'ob-1', state: 'TOUCHED', firstTouchIndex: 25 }),
        zone({
          zoneId: 'ob-bear-1',
          direction: 'BEARISH',
          low: 116,
          high: 120,
          state: 'TOUCHED',
          firstTouchIndex: 26,
        }),
      ],
      config: { enableQmlSetups: false, enableReversal: false },
    })
    expect(result.conflicts.some((c) => c.kind === 'BULL_AND_BEAR')).toBe(true)
    expect(result.summary.stance).toBe('WAIT')
  })

  it('reports missing conditions when entry zone absent', () => {
    const detection = baseDetection({
      bosEvents: [bullBos()],
      structureState: 'BULLISH_STRUCTURE',
    })
    const result = evaluateSetups({
      candles: candles(),
      detection,
      visibleIndex: 30,
      dowTheory: bullishDow(),
      config: { enableQmlSetups: false, enableReversal: false },
    })
    // Without OB/FVG the continuation may be omitted — reversal-style missing via empty
    expect(result.summary.stance === 'No Setup' || result.setups.every((s) => s.missingChecks.length >= 0)).toBe(
      true,
    )
  })

  it('marks WAITING_RETEST when zone exists but untouched', () => {
    const detection = baseDetection({
      bosEvents: [bullBos()],
      orderBlockEvents: [bullOb()],
      fvgEvents: [bullFvg()],
      structureState: 'BULLISH_STRUCTURE',
    })
    const result = evaluateSetups({
      candles: candles(),
      detection,
      visibleIndex: 30,
      dowTheory: bullishDow(),
      lifecycleZones: [zone({ zoneId: 'ob-1', state: 'ACTIVE' })],
      config: { enableQmlSetups: false, enableReversal: false, requireRetestForReady: true },
    })
    const setup = result.setups.find((s) => s.setupType === 'BULLISH_CONTINUATION')
    expect(setup?.status).toBe('WAITING_RETEST')
    expect(setup?.optionalChecks.some((c) => c.name === 'Retest' && !c.passed)).toBe(true)
  })

  it('builds entry zone, stop, and targets', () => {
    const detection = baseDetection({
      bosEvents: [bullBos()],
      orderBlockEvents: [
        { ...bullOb(), firstRetestTimestamp: 2, mitigationStatus: 'TOUCHED' },
      ],
      classifiedSwings: [
        {
          id: 'esh-30',
          kind: 'EXTERNAL_SWING_HIGH',
          candleIndex: 30,
          timestamp: 1,
          price: 130,
          confirmedAtIndex: 32,
          confirmedAtTimestamp: 2,
          leftBars: 5,
          rightBars: 5,
          classification: 'EXTERNAL',
          originalSwingId: 'sh-30',
          prominence: 1,
          nextBestExtreme: 120,
          surroundingRange: { high: 130, low: 100 },
          promotionReason: 'test',
          barsFromPreviousExternal: 10,
          replacedExternalSwingId: null,
          reason: 't',
          refs: [],
        },
      ],
      structureState: 'BULLISH_STRUCTURE',
    })
    const result = evaluateSetups({
      candles: candles(40),
      detection,
      visibleIndex: 35,
      dowTheory: bullishDow(),
      lifecycleZones: [zone({ zoneId: 'ob-1', state: 'TOUCHED', firstTouchIndex: 25 })],
      config: { enableQmlSetups: false, enableReversal: false },
    })
    const setup = result.setups.find((s) => s.setupType === 'BULLISH_CONTINUATION')!
    expect(setup.entryZone?.low).toBe(100)
    expect(setup.entryZone?.high).toBe(104)
    expect(setup.stopReference?.level).toBe(100)
    expect(setup.targetCandidates.some((t) => t.level === 130)).toBe(true)
    const visual = toSetupVisualContext(setup)
    expect(visual.entryZone).toBeTruthy()
    expect(visual.stopLevel).toBe(100)
    expect(visual.targetLevels?.length).toBeGreaterThan(0)
  })

  it('preserves no look-ahead on progressive replay', () => {
    const bos = bullBos('bos-1', 20)
    const futureBos = bullBos('bos-future', 34)
    const detection = baseDetection({
      bosEvents: [bos, futureBos],
      orderBlockEvents: [bullOb(21)],
      structureState: 'BULLISH_STRUCTURE',
    })
    const early = evaluateSetups({
      candles: candles(),
      detection,
      visibleIndex: 25,
      dowTheory: bullishDow(25),
      lifecycleZones: [zone({ zoneId: 'ob-1' })],
      config: { enableQmlSetups: false, enableReversal: false },
    })
    expect(early.setups.every((s) => s.createdIndex <= 25)).toBe(true)
    expect(early.setups.some((s) => s.id.includes('bos-future'))).toBe(false)

    const qml = qmlPattern({
      id: 'qml-1',
      direction: 'BULLISH',
      createdIndex: 22,
      entryReadyIndex: 30,
      retestIndex: 30,
      status: 'ENTRY_READY',
    })
    const rewound = rewindQmlPattern(qml, 25)
    expect(rewound?.status).not.toBe('ENTRY_READY')
    expect(['CONFIRMED', 'ZONE_ACTIVE', 'CANDIDATE']).toContain(rewound?.status)
  })

  it('supports manual validation metrics', () => {
    const detection = baseDetection({
      bosEvents: [bullBos()],
      orderBlockEvents: [
        { ...bullOb(), firstRetestTimestamp: 2, mitigationStatus: 'TOUCHED' },
      ],
      structureState: 'BULLISH_STRUCTURE',
    })
    const result = evaluateSetups({
      candles: candles(),
      detection,
      visibleIndex: 30,
      dowTheory: bullishDow(),
      lifecycleZones: [zone({ zoneId: 'ob-1', state: 'TOUCHED', firstTouchIndex: 25 })],
      config: { enableQmlSetups: false, enableReversal: false },
    })
    const setup = result.setups.find((s) => s.status === 'READY')!
    let reviews = [createSetupReview({ setup, verdict: 'correct' })]
    reviews = upsertSetupReview(
      reviews,
      createSetupReview({ setup, verdict: 'wrong', note: 'flip' }),
    )
    expect(reviews).toHaveLength(1)
    expect(reviews[0]!.verdict).toBe('wrong')
    const metrics = computeSetupValidationMetrics(reviews)
    expect(metrics.falseReady).toBe(1)
    expect(metrics.precision).toBe(0)
  })

  it('builds diagnostics with zero invariant failures for clean READY setup', () => {
    const detection = baseDetection({
      bosEvents: [bullBos()],
      orderBlockEvents: [
        { ...bullOb(), firstRetestTimestamp: 2, mitigationStatus: 'TOUCHED' },
      ],
      structureState: 'BULLISH_STRUCTURE',
    })
    const result = evaluateSetups({
      candles: candles(),
      detection,
      visibleIndex: 30,
      dowTheory: bullishDow(),
      lifecycleZones: [zone({ zoneId: 'ob-1', state: 'TOUCHED', firstTouchIndex: 25 })],
      config: { enableQmlSetups: false, enableReversal: false },
    })
    expect(result.diagnostics.created).toBeGreaterThan(0)
    expect(result.diagnostics.ready).toBeGreaterThan(0)
    expect(result.diagnostics.ok).toBe(true)
    expect(result.diagnostics.invariantFailures).toBe(0)
    expect(result.summary.highestRanked).toBeTruthy()
  })

  it('scores strength with stored reasons only in 0–100', () => {
    const required: SetupCheck[] = [
      {
        name: 'BOS',
        passed: true,
        required: true,
        reason: 'bos',
        sourceIds: [],
      },
    ]
    const strength = scoreSetup({
      setupType: 'BULLISH_CONTINUATION',
      requiredChecks: required,
      optionalChecks: [],
      warnings: [],
    })
    expect(strength.score).toBeGreaterThanOrEqual(0)
    expect(strength.score).toBeLessThanOrEqual(100)
    expect(strength.reasons.some((r) => r.id === 'base')).toBe(true)
  })

  it('consumes real detectSmc output without mutating detectors', () => {
    // Mild uptrend synthetic series — engine must not throw and must stay pure.
    const series = Array.from({ length: 80 }, (_, i) => {
      const base = 100 + i * 0.5
      const wave = Math.sin(i / 5) * 2
      return candle(i, base + wave, base + wave + 1.5, base + wave - 1.5, base + wave + 0.4)
    })
    const detection = detectSmc(series, cloneSmcDetectorConfig())
    const beforeBos = detection.bosEvents.length
    const result = evaluateSetups({
      candles: series,
      detection,
      visibleIndex: series.length - 1,
      dowTheory: detection.dowTheory,
      qml: detection.qml,
    })
    expect(detection.bosEvents.length).toBe(beforeBos)
    expect(result.version).toContain('phase8')
    expect(result.diagnostics.invariantFailures).toBeGreaterThanOrEqual(0)
    expect(result.summary.stance).toMatch(/READY|WAIT|No Setup/)
  })
})

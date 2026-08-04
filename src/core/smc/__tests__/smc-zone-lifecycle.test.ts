import { describe, expect, it } from 'vitest'
import {
  createMockSetupVisualContext,
  emptySmcDetectionResult,
  filterZonesBySmartVisibility,
  projectFvgZones,
  projectLiquidityZones,
  projectOrderBlockZones,
  projectSmcLifecycle,
  DEFAULT_ZONE_LIFECYCLE_SETTINGS,
  type SmcDetectionResult,
  type SmcEqualLevelEvent,
  type SmcFvgEvent,
  type SmcLiquiditySweepEvent,
  type SmcOrderBlockEvent,
  type SmcSetupVisualContext,
} from '@/core/smc'

function baseFvg(
  overrides: Partial<SmcFvgEvent> & Pick<SmcFvgEvent, 'id' | 'kind' | 'candleIndex'>,
): SmcFvgEvent {
  return {
    fvgId: 'fvg-1',
    direction: 'BULLISH',
    candleIndices: [8, 9, 10],
    createdTimestamp: 1_000,
    upperBoundary: 110,
    lowerBoundary: 100,
    midpoint: 105,
    gapSize: 10,
    gapPercent: 1,
    gapAtrMultiple: 1,
    state: 'ACTIVE',
    firstMitigationTimestamp: null,
    invalidationTimestamp: null,
    displacementId: null,
    reason: 'test',
    refs: [],
    timestamp: 1_000 + overrides.candleIndex,
    ...overrides,
  }
}

function baseOb(
  overrides: Partial<SmcOrderBlockEvent> &
    Pick<SmcOrderBlockEvent, 'id' | 'kind' | 'candleIndex'>,
): SmcOrderBlockEvent {
  return {
    orderBlockId: 'ob-1',
    direction: 'BULLISH',
    sourceCandleIndex: 5,
    sourceCandleTimestamp: 500,
    zoneHigh: 120,
    zoneLow: 110,
    midpoint: 115,
    createdTimestamp: 500,
    firstRetestTimestamp: null,
    mitigationStatus: 'ACTIVE',
    invalidationStatus: false,
    sourceBreakId: 'bos-1',
    sourceBreakKind: 'BULLISH_BOS',
    sourceDisplacementId: null,
    sourceFvgId: null,
    reason: 'test',
    refs: [],
    eventChain: [],
    timestamp: 1_000 + overrides.candleIndex,
    ...overrides,
  }
}

function mockBos(id: string, candleIndex: number): SmcDetectionResult['bosEvents'][number] {
  return {
    id,
    kind: 'BULLISH_BOS',
    candleIndex,
    timestamp: 1000 + candleIndex,
    closePrice: 100,
    brokenSwingId: 'sw-1',
    brokenSwingPrice: 95,
    brokenSwingTimestamp: 300,
    brokenSwingCandleIndex: 3,
    brokenSwingConfirmedAtIndex: 5,
    brokenSwingClassification: 'EXTERNAL',
    structureScope: 'EXTERNAL',
    breakAmount: 5,
    breakPercent: 5,
    wickHigh: 101,
    wickLow: 99,
    wickOnlyIgnored: false,
    reason: 'test',
    refs: [],
  }
}

function detectionWith(partial: Partial<SmcDetectionResult>): SmcDetectionResult {
  return {
    ...emptySmcDetectionResult('COMPLETE'),
    ...partial,
  }
}

describe('FVG lifecycle projection', () => {
  const created = baseFvg({
    id: 'fvg-c',
    kind: 'BULLISH_FVG_CREATED',
    candleIndex: 10,
  })

  it('active untouched extends to visible candle', () => {
    const zones = projectFvgZones([created], 40)
    expect(zones).toHaveLength(1)
    expect(zones[0]!.state).toBe('ACTIVE')
    expect(zones[0]!.endIndex).toBe(40)
    expect(zones[0]!.extendsToVisibleEdge).toBe(true)
    expect(zones[0]!.activeAtVisibleIndex).toBe(true)
  })

  it('touch changes state and still extends while valid', () => {
    const touch = baseFvg({
      id: 'fvg-t',
      kind: 'FVG_TOUCHED',
      candleIndex: 15,
      state: 'TOUCHED',
    })
    const zones = projectFvgZones([created, touch], 40)
    expect(zones[0]!.state).toBe('TOUCHED')
    expect(zones[0]!.firstTouchIndex).toBe(15)
    expect(zones[0]!.endIndex).toBe(40)
  })

  it('fill clips zone at fill candle', () => {
    const fill = baseFvg({
      id: 'fvg-f',
      kind: 'FVG_FULLY_FILLED',
      candleIndex: 22,
      state: 'FULLY_FILLED',
    })
    const zones = projectFvgZones([created, fill], 40)
    expect(zones[0]!.state).toBe('FILLED')
    expect(zones[0]!.endIndex).toBe(22)
    expect(zones[0]!.extendsToVisibleEdge).toBe(false)
  })

  it('invalidation clips zone', () => {
    const inv = baseFvg({
      id: 'fvg-i',
      kind: 'FVG_INVALIDATED',
      candleIndex: 18,
      state: 'INVALIDATED',
    })
    const zones = projectFvgZones([created, inv], 40)
    expect(zones[0]!.state).toBe('INVALIDATED')
    expect(zones[0]!.endIndex).toBe(18)
  })

  it('future fill does not affect earlier progressive view', () => {
    const fill = baseFvg({
      id: 'fvg-f',
      kind: 'FVG_FULLY_FILLED',
      candleIndex: 22,
      state: 'FULLY_FILLED',
    })
    const early = projectFvgZones([created, fill], 16)
    expect(early[0]!.state).toBe('ACTIVE')
    expect(early[0]!.endIndex).toBe(16)
    const late = projectFvgZones([created, fill], 30)
    expect(late[0]!.state).toBe('FILLED')
    expect(late[0]!.endIndex).toBe(22)
  })
})

describe('Order Block lifecycle projection', () => {
  const created = baseOb({
    id: 'ob-c',
    kind: 'BULLISH_ORDER_BLOCK_CREATED',
    candleIndex: 10,
  })

  it('fresh extends to visible candle', () => {
    const zones = projectOrderBlockZones([created], 50)
    expect(zones[0]!.state).toBe('ACTIVE')
    expect(zones[0]!.endIndex).toBe(50)
    expect(zones[0]!.fullLabel).toContain('Fresh')
  })

  it('touch / mitigation lifecycle', () => {
    const touch = baseOb({
      id: 'ob-t',
      kind: 'ORDER_BLOCK_TOUCHED',
      candleIndex: 14,
      mitigationStatus: 'TOUCHED',
    })
    const mit = baseOb({
      id: 'ob-m',
      kind: 'ORDER_BLOCK_MITIGATED',
      candleIndex: 20,
      mitigationStatus: 'MITIGATED',
    })
    const touched = projectOrderBlockZones([created, touch], 30)
    expect(touched[0]!.state).toBe('TOUCHED')
    expect(touched[0]!.endIndex).toBe(30)

    const mitigated = projectOrderBlockZones([created, touch, mit], 30)
    expect(mitigated[0]!.state).toBe('MITIGATED')
    expect(mitigated[0]!.endIndex).toBe(20)
  })

  it('mitigated hidden by default; invalidated clipped', () => {
    const mit = baseOb({
      id: 'ob-m',
      kind: 'ORDER_BLOCK_MITIGATED',
      candleIndex: 20,
      mitigationStatus: 'MITIGATED',
    })
    const inv = baseOb({
      id: 'ob-x',
      kind: 'ORDER_BLOCK_INVALIDATED',
      candleIndex: 25,
      mitigationStatus: 'INVALIDATED',
      invalidationStatus: true,
    })
    const zones = projectOrderBlockZones([created, mit], 40)
    const visible = filterZonesBySmartVisibility(
      zones,
      'balanced',
      DEFAULT_ZONE_LIFECYCLE_SETTINGS,
    )
    expect(visible).toHaveLength(0)

    const invZones = projectOrderBlockZones([created, inv], 40)
    expect(invZones[0]!.endIndex).toBe(25)
  })

  it('active untouched remains visible despite age', () => {
    const zones = projectOrderBlockZones([created], 500)
    const visible = filterZonesBySmartVisibility(
      zones,
      'balanced',
      DEFAULT_ZONE_LIFECYCLE_SETTINGS,
    )
    expect(visible).toHaveLength(1)
    expect(visible[0]!.endIndex).toBe(500)
  })
})

describe('Liquidity lifecycle projection', () => {
  const equal: SmcEqualLevelEvent = {
    id: 'eq-1',
    kind: 'EQUAL_HIGHS',
    candleIndex: 12,
    timestamp: 1200,
    level: 200,
    minMemberPrice: 199.5,
    maxMemberPrice: 200.5,
    firstTimestamp: 1000,
    latestTimestamp: 1200,
    touchCount: 2,
    memberSwingIds: ['s1', 's2'],
    reason: 'test',
    refs: [],
  }

  it('unswept extends; swept stops', () => {
    const unswept = projectLiquidityZones([equal], [], 40)
    expect(unswept[0]!.state).toBe('ACTIVE')
    expect(unswept[0]!.endIndex).toBe(40)

    const sweep: SmcLiquiditySweepEvent = {
      id: 'sw-1',
      kind: 'BUY_SIDE_LIQUIDITY_SWEEP',
      candleIndex: 28,
      timestamp: 2800,
      sweptSwingIds: ['s1'],
      canonicalLevelId: 'c1',
      sweptLevel: 200,
      wickExtreme: 201,
      close: 199,
      penetration: 1,
      penetrationPercent: 0.5,
      closeBackDistance: 1,
      closeBackDistancePercent: 0.5,
      structuralScope: 'EXTERNAL',
      displacementId: null,
      equalLevelId: 'eq-1',
      reason: 'test',
      refs: [],
      ruleChecks: {},
    }
    const swept = projectLiquidityZones([equal], [sweep], 40)
    const match = swept.find((z) => z.sourceEventId === 'eq-1')!
    expect(match.state).toBe('SWEPT')
    expect(match.endIndex).toBe(28)
  })

  it('consumed/superseded-style finished liquidity hidden in Balanced', () => {
    const sweep: SmcLiquiditySweepEvent = {
      id: 'sw-1',
      kind: 'BUY_SIDE_LIQUIDITY_SWEEP',
      candleIndex: 28,
      timestamp: 2800,
      sweptSwingIds: ['s1'],
      canonicalLevelId: 'c1',
      sweptLevel: 200,
      wickExtreme: 201,
      close: 199,
      penetration: 1,
      penetrationPercent: 0.5,
      closeBackDistance: 1,
      closeBackDistancePercent: 0.5,
      structuralScope: 'EXTERNAL',
      displacementId: null,
      equalLevelId: 'eq-1',
      reason: 'test',
      refs: [],
      ruleChecks: {},
    }
    const zones = projectLiquidityZones([equal], [sweep], 40)
    const balanced = filterZonesBySmartVisibility(
      zones,
      'balanced',
      DEFAULT_ZONE_LIFECYCLE_SETTINGS,
    )
    expect(balanced.every((z) => z.state !== 'SWEPT')).toBe(true)
  })
})

describe('Smart visibility presets', () => {
  const created = baseFvg({
    id: 'fvg-c',
    kind: 'BULLISH_FVG_CREATED',
    candleIndex: 10,
  })
  const fill = baseFvg({
    id: 'fvg-f',
    kind: 'FVG_FULLY_FILLED',
    candleIndex: 22,
    state: 'FULLY_FILLED',
  })

  it('Active Only / Balanced hide finished; History / Debug show clipped', () => {
    const zones = projectFvgZones([created, fill], 40)
    const settings = DEFAULT_ZONE_LIFECYCLE_SETTINGS
    expect(filterZonesBySmartVisibility(zones, 'active-only', settings)).toHaveLength(0)
    expect(filterZonesBySmartVisibility(zones, 'balanced', settings)).toHaveLength(0)
    const history = filterZonesBySmartVisibility(zones, 'history', settings)
    expect(history).toHaveLength(1)
    expect(history[0]!.endIndex).toBe(22)
    expect(filterZonesBySmartVisibility(zones, 'debug', settings)).toHaveLength(1)
  })

  it('setup reference forces visibility', () => {
    const zones = projectFvgZones([created, fill], 40)
    const visible = filterZonesBySmartVisibility(
      zones,
      'balanced',
      DEFAULT_ZONE_LIFECYCLE_SETTINGS,
      new Set(['fvg-1']),
    )
    expect(visible).toHaveLength(1)
    expect(visible[0]!.visibilityReason).toContain('Setup')
  })
})

describe('Setup Focus API', () => {
  it('exact event chain visible; exit restores prior mode', () => {
    const fvg = baseFvg({
      id: 'fvg-c',
      kind: 'BULLISH_FVG_CREATED',
      candleIndex: 10,
    })
    const fill = baseFvg({
      id: 'fvg-f',
      kind: 'FVG_FULLY_FILLED',
      candleIndex: 22,
      state: 'FULLY_FILLED',
    })
    const other = baseFvg({
      id: 'fvg-c2',
      kind: 'BEARISH_FVG_CREATED',
      candleIndex: 12,
      fvgId: 'fvg-2',
      direction: 'BEARISH',
      upperBoundary: 90,
      lowerBoundary: 80,
      midpoint: 85,
    })
    const detection = detectionWith({
      fvgEvents: [fvg, fill, other],
      bosEvents: [mockBos('bos-1', 8)],
    })
    const setup: SmcSetupVisualContext = {
      setupId: 'mock-setup-1',
      direction: 'BULLISH',
      status: 'WATCHING',
      eventIds: ['bos-1', 'fvg-c'],
      zoneIds: ['fvg-1'],
      entryZone: { low: 100, high: 110 },
      stopLevel: 99,
      targetLevels: [120],
    }
    const focused = projectSmcLifecycle({
      detection,
      visibleIndex: 40,
      preset: 'setup-focus',
      setup,
    })
    expect(focused.visibleZones.map((z) => z.zoneId)).toEqual(['fvg-1'])
    expect(focused.structureEvents.find((s) => s.eventId === 'bos-1')?.visible).toBe(true)
    expect(focused.setup?.entryZone).toEqual({ low: 100, high: 110 })
    expect(focused.setup?.stopLevel).toBe(99)

    const restored = projectSmcLifecycle({
      detection,
      visibleIndex: 40,
      preset: 'balanced',
      setup: null,
    })
    expect(restored.preset).toBe('balanced')
    expect(restored.setup).toBeNull()
  })

  it('createMockSetupVisualContext does not expose future events', () => {
    const detection = detectionWith({
      fvgEvents: [
        baseFvg({ id: 'fvg-c', kind: 'BULLISH_FVG_CREATED', candleIndex: 10 }),
        baseFvg({
          id: 'fvg-future',
          kind: 'BULLISH_FVG_CREATED',
          candleIndex: 50,
          fvgId: 'fvg-future',
        }),
      ],
      bosEvents: [mockBos('bos-1', 8)],
    })
    const mock = createMockSetupVisualContext(detection, 20)
    expect(mock).not.toBeNull()
    expect(mock!.eventIds).not.toContain('fvg-future')
    expect(mock!.zoneIds).not.toContain('fvg-future')
  })
})

describe('Lifecycle diagnostics + isolation', () => {
  it('projection invariants are zero for well-formed lifecycle', () => {
    const created = baseFvg({
      id: 'fvg-c',
      kind: 'BULLISH_FVG_CREATED',
      candleIndex: 10,
    })
    const fill = baseFvg({
      id: 'fvg-f',
      kind: 'FVG_FULLY_FILLED',
      candleIndex: 22,
      state: 'FULLY_FILLED',
    })
    const detection = detectionWith({ fvgEvents: [created, fill] })
    const result = projectSmcLifecycle({
      detection,
      visibleIndex: 40,
      preset: 'history',
    })
    expect(result.diagnostics.invariants.ok).toBe(true)
    expect(result.diagnostics.status).toBe('COMPLETE')
    expect(result.diagnostics.invariants.filledFvgExtendingPastFill).toBe(0)
  })

  it('does not mutate detector arrays; progressive equals full at final candle', () => {
    const created = baseFvg({
      id: 'fvg-c',
      kind: 'BULLISH_FVG_CREATED',
      candleIndex: 10,
    })
    const fill = baseFvg({
      id: 'fvg-f',
      kind: 'FVG_FULLY_FILLED',
      candleIndex: 22,
      state: 'FULLY_FILLED',
    })
    const events = [created, fill]
    const before = JSON.stringify(events)
    const detection = detectionWith({ fvgEvents: events })
    const mid = projectSmcLifecycle({ detection, visibleIndex: 16, preset: 'debug' })
    const final = projectSmcLifecycle({ detection, visibleIndex: 40, preset: 'debug' })
    expect(JSON.stringify(events)).toBe(before)
    expect(mid.zones[0]!.state).toBe('ACTIVE')
    expect(final.zones[0]!.state).toBe('FILLED')
    // Progressive at fill candle equals full-history projection at that candle.
    const atFill = projectSmcLifecycle({ detection, visibleIndex: 22, preset: 'debug' })
    const fullKnown = projectFvgZones(events.filter((e) => e.candleIndex <= 22), 22)
    expect(atFill.zones[0]!.endIndex).toBe(fullKnown[0]!.endIndex)
    expect(atFill.zones[0]!.state).toBe(fullKnown[0]!.state)
  })
})

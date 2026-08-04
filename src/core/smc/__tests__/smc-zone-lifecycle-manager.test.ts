import { describe, expect, it } from 'vitest'
import {
  buildZoneLifecycleReport,
  emptySmcDetectionResult,
  filterZonesByLifecycleVisibility,
  fromChartZoneState,
  projectSmcLifecycle,
  renderStyleForLifecycleState,
  runZoneLifecycleEngine,
  toChartZoneState,
  transitionZoneLifecycle,
  type SmcDetectionResult,
  type SmcEqualLevelEvent,
  type SmcFvgEvent,
  type SmcLiquiditySweepEvent,
  type SmcOrderBlockEvent,
  type ZoneLifecycleMeta,
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

function detectionWith(partial: Partial<SmcDetectionResult>): SmcDetectionResult {
  return {
    ...emptySmcDetectionResult('COMPLETE'),
    ...partial,
  }
}

describe('Phase 6 — transition table', () => {
  it('covers FVG happy path NEW → ACTIVE → TOUCHED → PARTIAL → MITIGATED → EXPIRED', () => {
    let state = transitionZoneLifecycle({
      from: 'NEW',
      event: 'PROMOTE',
      family: 'FVG',
    }).to
    expect(state).toBe('ACTIVE')
    state = transitionZoneLifecycle({ from: state, event: 'TOUCH', family: 'FVG' }).to
    expect(state).toBe('TOUCHED')
    state = transitionZoneLifecycle({
      from: state,
      event: 'PARTIAL_FILL',
      family: 'FVG',
    }).to
    expect(state).toBe('PARTIAL')
    state = transitionZoneLifecycle({
      from: state,
      event: 'FULL_FILL',
      family: 'FVG',
    }).to
    expect(state).toBe('MITIGATED')
    state = transitionZoneLifecycle({ from: state, event: 'EXPIRE', family: 'FVG' }).to
    expect(state).toBe('EXPIRED')
  })

  it('allows ACTIVE → INVALIDATED', () => {
    const result = transitionZoneLifecycle({
      from: 'ACTIVE',
      event: 'INVALIDATE',
      family: 'ORDER_BLOCK',
    })
    expect(result.ok).toBe(true)
    expect(result.to).toBe('INVALIDATED')
  })

  it('covers liquidity ACTIVE → SWEEPED → CONSUMED', () => {
    let state = transitionZoneLifecycle({
      from: 'NEW',
      event: 'PROMOTE',
      family: 'LIQUIDITY',
    }).to
    expect(state).toBe('ACTIVE')
    state = transitionZoneLifecycle({ from: state, event: 'SWEEP', family: 'LIQUIDITY' }).to
    expect(state).toBe('SWEEPED')
    state = transitionZoneLifecycle({
      from: state,
      event: 'CONSUME',
      family: 'LIQUIDITY',
    }).to
    expect(state).toBe('CONSUMED')
  })

  it('covers equal high/low ACTIVE → SWEPT → CONSUMED', () => {
    let state = transitionZoneLifecycle({
      from: 'ACTIVE',
      event: 'SWEEP',
      family: 'EQUAL_LEVEL',
    }).to
    expect(state).toBe('SWEPT')
    state = transitionZoneLifecycle({
      from: state,
      event: 'CONSUME',
      family: 'EQUAL_LEVEL',
    }).to
    expect(state).toBe('CONSUMED')
  })

  it('rejects invalid transitions without mutating state', () => {
    const result = transitionZoneLifecycle({
      from: 'MITIGATED',
      event: 'TOUCH',
      family: 'FVG',
    })
    expect(result.ok).toBe(false)
    expect(result.to).toBe('MITIGATED')
  })

  it('rejects CONSUMED → SWEEP', () => {
    const result = transitionZoneLifecycle({
      from: 'CONSUMED',
      event: 'SWEEP',
      family: 'LIQUIDITY',
    })
    expect(result.ok).toBe(false)
    expect(result.to).toBe('CONSUMED')
  })
})

describe('Phase 6 — engine replay / progressive', () => {
  const created = baseFvg({
    id: 'fvg-c',
    kind: 'BULLISH_FVG_CREATED',
    candleIndex: 10,
  })
  const touch = baseFvg({
    id: 'fvg-t',
    kind: 'FVG_TOUCHED',
    candleIndex: 15,
    state: 'TOUCHED',
  })
  const half = baseFvg({
    id: 'fvg-h',
    kind: 'FVG_HALF_FILLED',
    candleIndex: 18,
    state: 'HALF_FILLED',
  })
  const fill = baseFvg({
    id: 'fvg-f',
    kind: 'FVG_FULLY_FILLED',
    candleIndex: 22,
    state: 'FULLY_FILLED',
  })

  it('replays candle-by-candle without future leakage', () => {
    const events = [created, touch, half, fill]
    const at14 = runZoneLifecycleEngine({
      fvgEvents: events,
      orderBlockEvents: [],
      equalLevelEvents: [],
      liquiditySweepEvents: [],
      visibleIndex: 14,
    })
    expect(at14.zones[0]!.currentState).toBe('ACTIVE')
    expect(at14.zones[0]!.firstTouchIndex).toBeNull()

    const at16 = runZoneLifecycleEngine({
      fvgEvents: events,
      orderBlockEvents: [],
      equalLevelEvents: [],
      liquiditySweepEvents: [],
      visibleIndex: 16,
    })
    expect(at16.zones[0]!.currentState).toBe('TOUCHED')
    expect(at16.zones[0]!.touchCount).toBe(1)

    const at19 = runZoneLifecycleEngine({
      fvgEvents: events,
      orderBlockEvents: [],
      equalLevelEvents: [],
      liquiditySweepEvents: [],
      visibleIndex: 19,
    })
    expect(at19.zones[0]!.currentState).toBe('PARTIAL')
    expect(at19.zones[0]!.fillPercent).toBe(50)

    const at40 = runZoneLifecycleEngine({
      fvgEvents: events,
      orderBlockEvents: [],
      equalLevelEvents: [],
      liquiditySweepEvents: [],
      visibleIndex: 40,
    })
    expect(at40.zones[0]!.currentState).toBe('MITIGATED')
    expect(at40.zones[0]!.fillPercent).toBe(100)
    expect(at40.zones[0]!.endIndex).toBe(22)
  })

  it('progressive mid-path matches full history truncated to same cursor', () => {
    const events = [created, touch, half, fill]
    const progressive = runZoneLifecycleEngine({
      fvgEvents: events,
      orderBlockEvents: [],
      equalLevelEvents: [],
      liquiditySweepEvents: [],
      visibleIndex: 18,
    })
    const truncated = runZoneLifecycleEngine({
      fvgEvents: events.filter((e) => e.candleIndex <= 18),
      orderBlockEvents: [],
      equalLevelEvents: [],
      liquiditySweepEvents: [],
      visibleIndex: 18,
    })
    expect(progressive.zones[0]!.currentState).toBe(truncated.zones[0]!.currentState)
    expect(progressive.zones[0]!.fillPercent).toBe(truncated.zones[0]!.fillPercent)
    expect(progressive.zones[0]!.endIndex).toBe(truncated.zones[0]!.endIndex)
  })

  it('does not mutate detector event arrays', () => {
    const events = [created, touch, fill]
    const before = JSON.stringify(events)
    runZoneLifecycleEngine({
      fvgEvents: events,
      orderBlockEvents: [],
      equalLevelEvents: [],
      liquiditySweepEvents: [],
      visibleIndex: 40,
    })
    expect(JSON.stringify(events)).toBe(before)
  })

  it('expires mitigated zones after expireAfterCandles', () => {
    const result = runZoneLifecycleEngine({
      fvgEvents: [created, fill],
      orderBlockEvents: [],
      equalLevelEvents: [],
      liquiditySweepEvents: [],
      visibleIndex: 22 + 48,
      expireAfterCandles: 48,
    })
    expect(result.zones[0]!.currentState).toBe('EXPIRED')
    expect(result.zones[0]!.expiredIndex).toBe(22 + 48)
  })
})

describe('Phase 6 — OB / equal / liquidity engine paths', () => {
  it('OB deep penetration → PARTIAL then MITIGATED', () => {
    const create = baseOb({
      id: 'ob-c',
      kind: 'BULLISH_ORDER_BLOCK_CREATED',
      candleIndex: 5,
    })
    const touch = baseOb({
      id: 'ob-t',
      kind: 'ORDER_BLOCK_TOUCHED',
      candleIndex: 12,
      mitigationStatus: 'HALF_FILLED',
    })
    const mit = baseOb({
      id: 'ob-m',
      kind: 'ORDER_BLOCK_MITIGATED',
      candleIndex: 20,
      mitigationStatus: 'MITIGATED',
    })
    const result = runZoneLifecycleEngine({
      fvgEvents: [],
      orderBlockEvents: [create, touch, mit],
      equalLevelEvents: [],
      liquiditySweepEvents: [],
      visibleIndex: 30,
    })
    expect(result.zones[0]!.currentState).toBe('MITIGATED')
    expect(result.zones[0]!.type).toBe('BULLISH_ORDER_BLOCK')
    expect(result.zones[0]!.mitigatedIndex).toBe(20)
  })

  it('equal high sweeps then consumes', () => {
    const equal: SmcEqualLevelEvent = {
      id: 'eq-1',
      kind: 'EQUAL_HIGHS',
      candleIndex: 10,
      timestamp: 1000,
      level: 200,
      minMemberPrice: 199.5,
      maxMemberPrice: 200.5,
      firstTimestamp: 800,
      latestTimestamp: 1000,
      touchCount: 2,
      memberSwingIds: ['s1', 's2'],
      reason: 'test',
      refs: [],
    }
    const sweep: SmcLiquiditySweepEvent = {
      id: 'sw-1',
      kind: 'BUY_SIDE_LIQUIDITY_SWEEP',
      candleIndex: 16,
      timestamp: 1600,
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
    const atSweep = runZoneLifecycleEngine({
      fvgEvents: [],
      orderBlockEvents: [],
      equalLevelEvents: [equal],
      liquiditySweepEvents: [sweep],
      visibleIndex: 16,
    })
    expect(atSweep.zones[0]!.id).toBe('liq-eq-1')
    expect(atSweep.zones[0]!.currentState).toBe('SWEPT')

    const after = runZoneLifecycleEngine({
      fvgEvents: [],
      orderBlockEvents: [],
      equalLevelEvents: [equal],
      liquiditySweepEvents: [sweep],
      visibleIndex: 18,
    })
    expect(after.zones[0]!.currentState).toBe('CONSUMED')
  })
})

describe('Phase 6 — chart rendering styles', () => {
  it('maps lifecycle states to solid / faded / dashed / low / cross / hidden', () => {
    expect(renderStyleForLifecycleState('ACTIVE').fillClassHint).toBe('solid')
    expect(renderStyleForLifecycleState('ACTIVE').strokeDasharray).toBeUndefined()
    expect(renderStyleForLifecycleState('TOUCHED').opacity).toBeLessThan(
      renderStyleForLifecycleState('ACTIVE').opacity,
    )
    expect(renderStyleForLifecycleState('PARTIAL').strokeDasharray).toBeTruthy()
    expect(renderStyleForLifecycleState('MITIGATED').opacity).toBeLessThan(
      renderStyleForLifecycleState('TOUCHED').opacity,
    )
    expect(renderStyleForLifecycleState('INVALIDATED').showInvalidationCross).toBe(true)
    expect(renderStyleForLifecycleState('EXPIRED').hiddenByDefault).toBe(true)
  })

  it('maps Phase 6 → chart states with family-aware mitigated', () => {
    expect(toChartZoneState('MITIGATED', 'FVG')).toBe('FILLED')
    expect(toChartZoneState('MITIGATED', 'ORDER_BLOCK')).toBe('MITIGATED')
    expect(toChartZoneState('PARTIAL')).toBe('PARTIALLY_MITIGATED')
    expect(fromChartZoneState('FILLED')).toBe('MITIGATED')
  })
})

describe('Phase 6 — visibility modes', () => {
  function zone(state: ZoneLifecycleMeta['currentState'], age = 10): ZoneLifecycleMeta {
    return {
      id: `z-${state}`,
      type: 'BULLISH_FVG',
      family: 'FVG',
      direction: 'BULLISH',
      createdIndex: 0,
      createdTime: 0,
      firstTouchIndex: null,
      firstTouchTime: null,
      mitigatedIndex: null,
      invalidatedIndex: null,
      expiredIndex: null,
      currentState: state,
      previousState: null,
      touchCount: 0,
      fillPercent: 0,
      ageCandles: age,
      importance: 50,
      visibilityWeight: 1,
      reason: 'test',
      sourceEventId: 'e1',
      low: 1,
      high: 2,
      midpoint: 1.5,
      startIndex: 0,
      endIndex: 10,
      extendsToVisibleEdge: true,
    }
  }

  it('Active Only keeps ACTIVE/NEW only', () => {
    const zones = [zone('ACTIVE'), zone('TOUCHED'), zone('PARTIAL')]
    const visible = filterZonesByLifecycleVisibility(zones, 'active-only')
    expect(visible.map((z) => z.currentState)).toEqual(['ACTIVE'])
  })

  it('Balanced keeps ACTIVE, TOUCHED, recent PARTIAL', () => {
    const zones = [
      zone('ACTIVE'),
      zone('TOUCHED'),
      zone('PARTIAL', 10),
      zone('PARTIAL', 80),
      zone('MITIGATED'),
    ]
    const visible = filterZonesByLifecycleVisibility(zones, 'balanced')
    expect(visible.map((z) => z.currentState).sort()).toEqual([
      'ACTIVE',
      'PARTIAL',
      'TOUCHED',
    ])
  })

  it('History hides EXPIRED; Debug shows all', () => {
    const zones = [zone('ACTIVE'), zone('MITIGATED'), zone('EXPIRED')]
    expect(filterZonesByLifecycleVisibility(zones, 'history')).toHaveLength(2)
    expect(filterZonesByLifecycleVisibility(zones, 'debug')).toHaveLength(3)
  })
})

describe('Phase 6 — report + pipeline persistence', () => {
  it('builds lifecycle report counts', () => {
    const created = baseFvg({
      id: 'fvg-c',
      kind: 'BULLISH_FVG_CREATED',
      candleIndex: 10,
    })
    const touch = baseFvg({
      id: 'fvg-t',
      kind: 'FVG_TOUCHED',
      candleIndex: 15,
      state: 'TOUCHED',
    })
    const managed = runZoneLifecycleEngine({
      fvgEvents: [created, touch],
      orderBlockEvents: [],
      equalLevelEvents: [],
      liquiditySweepEvents: [],
      visibleIndex: 20,
    })
    const report = buildZoneLifecycleReport(managed.zones)
    expect(report.zonesCreated).toBe(1)
    expect(report.touched).toBe(1)
    expect(report.active).toBe(0)
    expect(report.averageLifetimeCandles).toBeGreaterThan(0)
  })

  it('projectSmcLifecycle attaches managedZones + lifecycleReport + lifecycle meta', () => {
    const detection = detectionWith({
      fvgEvents: [
        baseFvg({ id: 'fvg-c', kind: 'BULLISH_FVG_CREATED', candleIndex: 10 }),
        baseFvg({
          id: 'fvg-t',
          kind: 'FVG_TOUCHED',
          candleIndex: 15,
          state: 'TOUCHED',
        }),
      ],
    })
    const result = projectSmcLifecycle({
      detection,
      visibleIndex: 20,
      preset: 'debug',
    })
    expect(result.managedZones).toHaveLength(1)
    expect(result.lifecycleReport.touched).toBe(1)
    expect(result.zones[0]!.lifecycle?.currentState).toBe('TOUCHED')
    expect(result.zones[0]!.lifecycle?.touchCount).toBe(1)
    expect(result.zones[0]!.state).toBe('TOUCHED')
  })

  it('pipeline result shape is stable across progressive steps (persistence-safe)', () => {
    const detection = detectionWith({
      fvgEvents: [
        baseFvg({ id: 'fvg-c', kind: 'BULLISH_FVG_CREATED', candleIndex: 10 }),
        baseFvg({
          id: 'fvg-f',
          kind: 'FVG_FULLY_FILLED',
          candleIndex: 22,
          state: 'FULLY_FILLED',
        }),
      ],
    })
    const a = projectSmcLifecycle({ detection, visibleIndex: 16, preset: 'debug' })
    const b = projectSmcLifecycle({ detection, visibleIndex: 40, preset: 'debug' })
    expect(Object.keys(a).sort()).toEqual(Object.keys(b).sort())
    expect(a.zones[0]!.zoneId).toBe(b.zones[0]!.zoneId)
    expect(a.zones[0]!.lifecycle?.id).toBe(b.zones[0]!.lifecycle?.id)
    expect(a.lifecycleReport.zonesCreated).toBe(b.lifecycleReport.zonesCreated)
  })
})

import type {
  SmcEqualLevelEvent,
  SmcFvgEvent,
  SmcLiquiditySweepEvent,
  SmcOrderBlockEvent,
} from '../types'
import {
  isLiveLifecycleState,
  isTerminalLifecycleState,
  transitionZoneLifecycle,
} from './zone-lifecycle-transition'
import {
  DEFAULT_EXPIRE_AFTER_CANDLES,
  type ZoneLifecycleEngineInput,
  type ZoneLifecycleEngineResult,
  type ZoneLifecycleFamily,
  type ZoneLifecycleMeta,
  type ZoneLifecycleState,
  type ZoneLifecycleType,
} from './zone-lifecycle-types'

function timeAt(
  candleTimes: readonly number[] | undefined,
  index: number,
  fallback: number,
): number {
  if (candleTimes && index >= 0 && index < candleTimes.length) {
    const t = candleTimes[index]
    if (typeof t === 'number' && Number.isFinite(t)) return t
  }
  return fallback
}

function clampImportance(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

function visibilityWeightFor(state: ZoneLifecycleState, ageCandles: number): number {
  switch (state) {
    case 'NEW':
    case 'ACTIVE':
      return 1
    case 'TOUCHED':
      return 0.85
    case 'PARTIAL':
      return 0.65
    case 'MITIGATED':
    case 'SWEEPED':
    case 'SWEPT':
      return 0.35
    case 'INVALIDATED':
      return 0.4
    case 'CONSUMED':
      return 0.2
    case 'EXPIRED':
      return 0
    default:
      return Math.max(0.15, 1 - ageCandles / 200)
  }
}

function importanceFor(
  family: ZoneLifecycleFamily,
  state: ZoneLifecycleState,
  ageCandles: number,
  fillPercent: number | null,
): number {
  let base =
    family === 'ORDER_BLOCK' ? 70 : family === 'FVG' ? 65 : family === 'EQUAL_LEVEL' ? 55 : 60
  if (state === 'ACTIVE' || state === 'NEW') base += 15
  else if (state === 'TOUCHED') base += 8
  else if (state === 'PARTIAL') base += 4
  else if (state === 'INVALIDATED') base -= 20
  else if (state === 'EXPIRED' || state === 'CONSUMED') base -= 35
  if (fillPercent != null && fillPercent >= 50 && fillPercent < 100) base += 5
  base -= Math.min(25, Math.floor(ageCandles / 8))
  return clampImportance(base)
}

function applyEvent(
  state: ZoneLifecycleState,
  family: ZoneLifecycleFamily,
  event: Parameters<typeof transitionZoneLifecycle>[0]['event'],
): { state: ZoneLifecycleState; reason: string; ok: boolean } {
  const result = transitionZoneLifecycle({ from: state, event, family })
  return { state: result.to, reason: result.reason, ok: result.ok }
}

function buildFvgZone(
  create: SmcFvgEvent,
  updates: readonly SmcFvgEvent[],
  visibleIndex: number,
  candleTimes: readonly number[] | undefined,
  extendActiveRight: boolean,
  expireAfter: number,
): ZoneLifecycleMeta {
  const type: ZoneLifecycleType =
    create.kind === 'BULLISH_FVG_CREATED' ? 'BULLISH_FVG' : 'BEARISH_FVG'
  const family: ZoneLifecycleFamily = 'FVG'
  let state: ZoneLifecycleState = 'NEW'
  let previousState: ZoneLifecycleState | null = null
  let firstTouchIndex: number | null = null
  let firstTouchTime: number | null = null
  let mitigatedIndex: number | null = null
  let invalidatedIndex: number | null = null
  let expiredIndex: number | null = null
  let touchCount = 0
  let fillPercent: number | null = 0
  let reason = 'Zone created.'

  // Promote NEW → ACTIVE immediately after create (deterministic).
  {
    const promo = applyEvent(state, family, 'PROMOTE')
    previousState = state
    state = promo.state
    reason = promo.reason
  }

  for (const u of updates) {
    if (u.candleIndex > visibleIndex) break
    if (u.kind === 'BULLISH_FVG_CREATED' || u.kind === 'BEARISH_FVG_CREATED') continue

    if (u.kind === 'FVG_TOUCHED') {
      const next = applyEvent(state, family, 'TOUCH')
      if (next.ok) {
        previousState = state
        state = next.state
        reason = next.reason
        touchCount += 1
        if (firstTouchIndex == null) {
          firstTouchIndex = u.candleIndex
          firstTouchTime = u.timestamp
        }
      }
    } else if (u.kind === 'FVG_HALF_FILLED') {
      const next = applyEvent(state, family, 'PARTIAL_FILL')
      if (next.ok) {
        previousState = state
        state = next.state
        reason = next.reason
        fillPercent = 50
        if (firstTouchIndex == null) {
          firstTouchIndex = u.candleIndex
          firstTouchTime = u.timestamp
        }
      }
    } else if (u.kind === 'FVG_FULLY_FILLED') {
      const next = applyEvent(state, family, 'FULL_FILL')
      if (next.ok) {
        previousState = state
        state = next.state
        reason = next.reason
        fillPercent = 100
        mitigatedIndex = u.candleIndex
      }
    } else if (u.kind === 'FVG_INVALIDATED') {
      const next = applyEvent(state, family, 'INVALIDATE')
      if (next.ok) {
        previousState = state
        state = next.state
        reason = next.reason
        invalidatedIndex = u.candleIndex
      }
    }
  }

  const ageCandles = Math.max(0, visibleIndex - create.candleIndex)
  {
    const terminal = Math.max(mitigatedIndex ?? -1, invalidatedIndex ?? -1)
    if (
      (state === 'MITIGATED' || state === 'INVALIDATED') &&
      terminal >= 0 &&
      visibleIndex - terminal >= expireAfter
    ) {
      const next = applyEvent(state, family, 'EXPIRE')
      if (next.ok) {
        previousState = state
        state = next.state
        reason = next.reason
        expiredIndex = terminal + expireAfter
      }
    }
  }

  const live = isLiveLifecycleState(state)
  const terminalIdx =
    expiredIndex ?? invalidatedIndex ?? mitigatedIndex ?? null
  const endIndex = live
    ? extendActiveRight
      ? visibleIndex
      : create.candleIndex
    : (terminalIdx ?? create.candleIndex)
  const extendsToVisibleEdge = live && extendActiveRight && endIndex >= visibleIndex

  return {
    id: create.fvgId,
    type,
    family,
    direction: create.direction,
    createdIndex: create.candleIndex,
    createdTime: timeAt(candleTimes, create.candleIndex, create.createdTimestamp),
    firstTouchIndex,
    firstTouchTime,
    mitigatedIndex,
    invalidatedIndex,
    expiredIndex,
    currentState: state,
    previousState,
    touchCount,
    fillPercent,
    ageCandles,
    importance: importanceFor(family, state, ageCandles, fillPercent),
    visibilityWeight: visibilityWeightFor(state, ageCandles),
    reason,
    sourceEventId: create.id,
    low: create.lowerBoundary,
    high: create.upperBoundary,
    midpoint: create.midpoint,
    startIndex: create.candleIndex,
    endIndex,
    extendsToVisibleEdge,
  }
}

function buildObZone(
  create: SmcOrderBlockEvent,
  updates: readonly SmcOrderBlockEvent[],
  visibleIndex: number,
  candleTimes: readonly number[] | undefined,
  extendActiveRight: boolean,
  expireAfter: number,
): ZoneLifecycleMeta {
  const type: ZoneLifecycleType =
    create.kind === 'BULLISH_ORDER_BLOCK_CREATED'
      ? 'BULLISH_ORDER_BLOCK'
      : 'BEARISH_ORDER_BLOCK'
  const family: ZoneLifecycleFamily = 'ORDER_BLOCK'
  let state: ZoneLifecycleState = 'NEW'
  let previousState: ZoneLifecycleState | null = null
  let firstTouchIndex: number | null = null
  let firstTouchTime: number | null = null
  let mitigatedIndex: number | null = null
  let invalidatedIndex: number | null = null
  let expiredIndex: number | null = null
  let touchCount = 0
  let fillPercent: number | null = 0
  let reason = 'Zone created.'

  {
    const promo = applyEvent(state, family, 'PROMOTE')
    previousState = state
    state = promo.state
    reason = promo.reason
  }

  for (const u of updates) {
    if (u.candleIndex > visibleIndex) break
    if (
      u.kind === 'BULLISH_ORDER_BLOCK_CREATED' ||
      u.kind === 'BEARISH_ORDER_BLOCK_CREATED'
    ) {
      continue
    }
    if (u.kind === 'ORDER_BLOCK_TOUCHED') {
      const next = applyEvent(state, family, 'TOUCH')
      if (next.ok) {
        previousState = state
        state = next.state
        reason = next.reason
        touchCount += 1
        if (firstTouchIndex == null) {
          firstTouchIndex = u.candleIndex
          firstTouchTime = u.timestamp
        }
      }
      if (u.mitigationStatus === 'HALF_FILLED') {
        const partial = applyEvent(state, family, 'PARTIAL_FILL')
        if (partial.ok) {
          previousState = state
          state = partial.state
          reason = partial.reason
          fillPercent = 50
        }
      }
    } else if (u.kind === 'ORDER_BLOCK_MITIGATED') {
      if (u.mitigationStatus === 'HALF_FILLED') {
        const partial = applyEvent(state, family, 'PARTIAL_FILL')
        if (partial.ok) {
          previousState = state
          state = partial.state
          reason = partial.reason
          fillPercent = 50
          if (firstTouchIndex == null) {
            firstTouchIndex = u.candleIndex
            firstTouchTime = u.timestamp
          }
        }
      } else {
        const next = applyEvent(state, family, 'MITIGATE')
        if (next.ok) {
          previousState = state
          state = next.state
          reason = next.reason
          fillPercent = 100
          mitigatedIndex = u.candleIndex
        }
      }
    } else if (u.kind === 'ORDER_BLOCK_INVALIDATED') {
      const next = applyEvent(state, family, 'INVALIDATE')
      if (next.ok) {
        previousState = state
        state = next.state
        reason = next.reason
        invalidatedIndex = u.candleIndex
      }
    }
  }

  const ageCandles = Math.max(0, visibleIndex - create.candleIndex)
  const terminal = Math.max(mitigatedIndex ?? -1, invalidatedIndex ?? -1)
  if (
    (state === 'MITIGATED' || state === 'INVALIDATED') &&
    terminal >= 0 &&
    visibleIndex - terminal >= expireAfter
  ) {
    const next = applyEvent(state, family, 'EXPIRE')
    if (next.ok) {
      previousState = state
      state = next.state
      reason = next.reason
      expiredIndex = terminal + expireAfter
    }
  }

  const live = isLiveLifecycleState(state)
  const terminalIdx = expiredIndex ?? invalidatedIndex ?? mitigatedIndex ?? null
  const endIndex = live
    ? extendActiveRight
      ? visibleIndex
      : create.candleIndex
    : (terminalIdx ?? create.candleIndex)

  return {
    id: create.orderBlockId,
    type,
    family,
    direction: create.direction,
    createdIndex: create.candleIndex,
    createdTime: timeAt(candleTimes, create.candleIndex, create.createdTimestamp),
    firstTouchIndex,
    firstTouchTime,
    mitigatedIndex,
    invalidatedIndex,
    expiredIndex,
    currentState: state,
    previousState,
    touchCount,
    fillPercent,
    ageCandles,
    importance: importanceFor(family, state, ageCandles, fillPercent),
    visibilityWeight: visibilityWeightFor(state, ageCandles),
    reason,
    sourceEventId: create.id,
    low: create.zoneLow,
    high: create.zoneHigh,
    midpoint: create.midpoint,
    startIndex: create.candleIndex,
    endIndex,
    extendsToVisibleEdge: live && extendActiveRight && endIndex >= visibleIndex,
  }
}

function buildEqualLiquidityZones(
  equals: readonly SmcEqualLevelEvent[],
  sweeps: readonly SmcLiquiditySweepEvent[],
  visibleIndex: number,
  candleTimes: readonly number[] | undefined,
  extendActiveRight: boolean,
  expireAfter: number,
): ZoneLifecycleMeta[] {
  const knownEquals = equals.filter((e) => e.candleIndex <= visibleIndex)
  const knownSweeps = sweeps.filter((e) => e.candleIndex <= visibleIndex)
  const out: ZoneLifecycleMeta[] = []

  for (const level of knownEquals) {
    const isHigh = level.kind === 'EQUAL_HIGHS'
    const type: ZoneLifecycleType = isHigh ? 'EQUAL_HIGH' : 'EQUAL_LOW'
    const family: ZoneLifecycleFamily = 'EQUAL_LEVEL'
    let state: ZoneLifecycleState = 'NEW'
    let previousState: ZoneLifecycleState | null = null
    let reason = 'Equal level created.'
    {
      const promo = applyEvent(state, family, 'PROMOTE')
      previousState = state
      state = promo.state
      reason = promo.reason
    }

    const sweep = knownSweeps.find(
      (s) =>
        s.equalLevelId === level.id ||
        (Math.abs(s.sweptLevel - level.level) < 1e-8 &&
          ((isHigh && s.kind === 'BUY_SIDE_LIQUIDITY_SWEEP') ||
            (!isHigh && s.kind === 'SELL_SIDE_LIQUIDITY_SWEEP'))),
    )

    let mitigatedIndex: number | null = null
    let expiredIndex: number | null = null
    let firstTouchIndex: number | null = null
    let firstTouchTime: number | null = null
    let touchCount = 0

    if (sweep) {
      const swept = applyEvent(state, family, 'SWEEP')
      if (swept.ok) {
        previousState = state
        state = swept.state
        reason = swept.reason
        firstTouchIndex = sweep.candleIndex
        firstTouchTime = sweep.timestamp
        touchCount = 1
        mitigatedIndex = sweep.candleIndex
      }
      // Auto-consume shortly after sweep for progressive clarity.
      if (visibleIndex > sweep.candleIndex) {
        const consumed = applyEvent(state, family, 'CONSUME')
        if (consumed.ok) {
          previousState = state
          state = consumed.state
          reason = consumed.reason
        }
      }
    }

    const ageCandles = Math.max(0, visibleIndex - level.candleIndex)
    if (
      (state === 'SWEPT' || state === 'SWEEPED' || state === 'CONSUMED') &&
      mitigatedIndex != null &&
      visibleIndex - mitigatedIndex >= expireAfter
    ) {
      // CONSUMED is terminal; allow expire only from SWEPT/SWEEPED
      if (state === 'SWEPT' || state === 'SWEEPED') {
        const next = applyEvent(state, family, 'EXPIRE')
        if (next.ok) {
          previousState = state
          state = next.state
          reason = next.reason
          expiredIndex = mitigatedIndex + expireAfter
        }
      }
    }

    const live = isLiveLifecycleState(state)
    const band = Math.max(Math.abs(level.level) * 1e-4, 1e-6)
    const endIndex = live
      ? extendActiveRight
        ? visibleIndex
        : level.candleIndex
      : (expiredIndex ?? mitigatedIndex ?? level.candleIndex)

    out.push({
      // Keep legacy liq-* id so setup refs / prefs stay compatible.
      id: `liq-${level.id}`,
      type,
      family,
      direction: isHigh ? 'BEARISH' : 'BULLISH',
      createdIndex: level.candleIndex,
      createdTime: timeAt(candleTimes, level.candleIndex, level.timestamp),
      firstTouchIndex,
      firstTouchTime,
      mitigatedIndex,
      invalidatedIndex: null,
      expiredIndex,
      currentState: state,
      previousState,
      touchCount,
      fillPercent: state === 'CONSUMED' || state === 'SWEPT' || state === 'SWEEPED' ? 100 : 0,
      ageCandles,
      importance: importanceFor(family, state, ageCandles, null),
      visibilityWeight: visibilityWeightFor(state, ageCandles),
      reason,
      sourceEventId: level.id,
      low: level.level - band,
      high: level.level + band,
      midpoint: level.level,
      startIndex: level.candleIndex,
      endIndex,
      extendsToVisibleEdge: live && extendActiveRight && endIndex >= visibleIndex,
    })
  }

  // Orphan sweeps → standalone liquidity zones
  for (const sweep of knownSweeps) {
    const already = out.some(
      (z) =>
        z.mitigatedIndex === sweep.candleIndex &&
        Math.abs((z.midpoint ?? 0) - sweep.sweptLevel) < 1e-8,
    )
    if (already) continue
    const bullish = sweep.kind === 'SELL_SIDE_LIQUIDITY_SWEEP'
    const band = Math.max(Math.abs(sweep.sweptLevel) * 1e-4, 1e-6)
    let state: ZoneLifecycleState = 'SWEEPED'
    let previousState: ZoneLifecycleState | null = 'ACTIVE'
    let reason = 'Orphan sweep — liquidity consumed.'
    if (visibleIndex > sweep.candleIndex) {
      const consumed = applyEvent(state, 'LIQUIDITY', 'CONSUME')
      if (consumed.ok) {
        previousState = state
        state = consumed.state
        reason = consumed.reason
      }
    }
    const ageCandles = Math.max(0, visibleIndex - sweep.candleIndex)
    out.push({
      id: `liq-sweep-${sweep.id}`,
      type: 'LIQUIDITY_LEVEL',
      family: 'LIQUIDITY',
      direction: bullish ? 'BULLISH' : 'BEARISH',
      createdIndex: sweep.candleIndex,
      createdTime: timeAt(candleTimes, sweep.candleIndex, sweep.timestamp),
      firstTouchIndex: sweep.candleIndex,
      firstTouchTime: sweep.timestamp,
      mitigatedIndex: sweep.candleIndex,
      invalidatedIndex: null,
      expiredIndex: null,
      currentState: state,
      previousState,
      touchCount: 1,
      fillPercent: 100,
      ageCandles,
      importance: importanceFor('LIQUIDITY', state, ageCandles, 100),
      visibilityWeight: visibilityWeightFor(state, ageCandles),
      reason,
      sourceEventId: sweep.id,
      low: sweep.sweptLevel - band,
      high: sweep.sweptLevel + band,
      midpoint: sweep.sweptLevel,
      startIndex: sweep.candleIndex,
      endIndex: sweep.candleIndex,
      extendsToVisibleEdge: false,
    })
  }

  return out
}

/**
 * Phase 6 Zone Lifecycle Manager engine.
 * Pure / immutable / progressive-safe. Does not mutate detector events.
 */
export function runZoneLifecycleEngine(
  input: ZoneLifecycleEngineInput,
): ZoneLifecycleEngineResult {
  const visibleIndex = Math.max(0, input.visibleIndex)
  const extendActiveRight = input.extendActiveRight !== false
  const expireAfter = input.expireAfterCandles ?? DEFAULT_EXPIRE_AFTER_CANDLES
  const candleTimes = input.candleTimes

  const fvgKnown = input.fvgEvents.filter((e) => e.candleIndex <= visibleIndex)
  const fvgCreates = fvgKnown.filter(
    (e) => e.kind === 'BULLISH_FVG_CREATED' || e.kind === 'BEARISH_FVG_CREATED',
  )
  const fvgZones = fvgCreates.map((create) => {
    const updates = fvgKnown
      .filter((e) => e.fvgId === create.fvgId)
      .sort((a, b) => a.candleIndex - b.candleIndex || a.id.localeCompare(b.id))
    return buildFvgZone(
      create,
      updates,
      visibleIndex,
      candleTimes,
      extendActiveRight,
      expireAfter,
    )
  })

  const obKnown = input.orderBlockEvents.filter((e) => e.candleIndex <= visibleIndex)
  const obCreates = obKnown.filter(
    (e) =>
      e.kind === 'BULLISH_ORDER_BLOCK_CREATED' || e.kind === 'BEARISH_ORDER_BLOCK_CREATED',
  )
  const obZones = obCreates.map((create) => {
    const updates = obKnown
      .filter((e) => e.orderBlockId === create.orderBlockId)
      .sort((a, b) => a.candleIndex - b.candleIndex || a.id.localeCompare(b.id))
    return buildObZone(
      create,
      updates,
      visibleIndex,
      candleTimes,
      extendActiveRight,
      expireAfter,
    )
  })

  const liqZones = buildEqualLiquidityZones(
    input.equalLevelEvents,
    input.liquiditySweepEvents,
    visibleIndex,
    candleTimes,
    extendActiveRight,
    expireAfter,
  )

  const zones = [...fvgZones, ...obZones, ...liqZones].sort(
    (a, b) => a.createdIndex - b.createdIndex || a.id.localeCompare(b.id),
  )

  // Freeze-ish copy for immutability contract
  const frozen = zones.map((z) => ({ ...z }))
  const byId: Record<string, ZoneLifecycleMeta> = {}
  for (const z of frozen) byId[z.id] = z

  return { visibleIndex, zones: frozen, byId }
}

/** Filter managed zones by Phase 6 visibility mode. */
export function filterZonesByLifecycleVisibility(
  zones: readonly ZoneLifecycleMeta[],
  mode: import('./zone-lifecycle-types').ZoneLifecycleVisibilityMode,
): ZoneLifecycleMeta[] {
  return zones.filter((z) => {
    switch (mode) {
      case 'active-only':
        return z.currentState === 'ACTIVE' || z.currentState === 'NEW'
      case 'balanced':
        return (
          z.currentState === 'ACTIVE' ||
          z.currentState === 'NEW' ||
          z.currentState === 'TOUCHED' ||
          (z.currentState === 'PARTIAL' && z.ageCandles <= 48)
        )
      case 'history':
        return z.currentState !== 'EXPIRED'
      case 'debug':
        return true
      default:
        return true
    }
  })
}

export { isLiveLifecycleState, isTerminalLifecycleState }

/**
 * Setup check evaluators — read-only consumers of detector outputs.
 */

import type { SmcDowTheoryLayer } from '@/core/smc/dow-theory/types'
import type { SmcZoneProjection } from '@/core/smc/lifecycle/types'
import type { QmlPattern } from '@/core/smc/qml/qml-types'
import type {
  SmcBosEvent,
  SmcChochEvent,
  SmcDetectionResult,
  SmcDisplacementEvent,
  SmcFvgEvent,
  SmcLiquiditySweepEvent,
  SmcOrderBlockEvent,
} from '@/core/smc/types'
import type {
  SetupCheck,
  SetupCheckName,
  SetupDirection,
  SetupEngineConfig,
} from './setup-types'

export interface SetupCheckContext {
  detection: SmcDetectionResult
  dowTheory: SmcDowTheoryLayer
  visibleIndex: number
  direction: SetupDirection
  config: SetupEngineConfig
  lifecycleZones: readonly SmcZoneProjection[]
  /** Anchor event index (BOS / CHOCH / QML created). */
  anchorIndex: number
  bos?: SmcBosEvent | null
  choch?: SmcChochEvent | null
  sweep?: SmcLiquiditySweepEvent | null
  displacement?: SmcDisplacementEvent | null
  fvg?: SmcFvgEvent | null
  ob?: SmcOrderBlockEvent | null
  qml?: QmlPattern | null
  zone?: SmcZoneProjection | null
}

function check(
  name: SetupCheckName,
  passed: boolean,
  required: boolean,
  reason: string,
  sourceIds: string[] = [],
): SetupCheck {
  return { name, passed, required, reason, sourceIds }
}

export function checkTrend(ctx: SetupCheckContext, required: boolean): SetupCheck {
  const trend = ctx.dowTheory.trend
  const bullishOk =
    ctx.direction === 'BULLISH' &&
    (trend === 'Bullish' || trend === 'Pullback' || trend === 'Reversal')
  const bearishOk =
    ctx.direction === 'BEARISH' &&
    (trend === 'Bearish' || trend === 'Pullback' || trend === 'Reversal')
  const passed = bullishOk || bearishOk
  return check(
    'Trend',
    passed,
    required,
    passed
      ? `Dow trend ${trend} aligns with ${ctx.direction} setup`
      : `Dow trend ${trend} conflicts with ${ctx.direction} setup`,
    [],
  )
}

export function checkDowTheory(ctx: SetupCheckContext, required: boolean): SetupCheck {
  const strength = ctx.dowTheory.strength
  const phase = ctx.dowTheory.structurePhase
  const passed = strength >= 35 && phase !== 'INSUFFICIENT'
  return check(
    'Dow Theory',
    passed,
    required,
    passed
      ? `Dow strength ${strength}, phase ${phase}`
      : `Dow insufficient (strength ${strength}, phase ${phase})`,
    ctx.dowTheory.sourceSwingIds.slice(0, 4),
  )
}

export function checkStructure(ctx: SetupCheckContext, required: boolean): SetupCheck {
  const state = ctx.detection.structureState
  const passed =
    (ctx.direction === 'BULLISH' &&
      (state === 'BULLISH_STRUCTURE' || Boolean(ctx.bos?.kind === 'BULLISH_BOS'))) ||
    (ctx.direction === 'BEARISH' &&
      (state === 'BEARISH_STRUCTURE' || Boolean(ctx.bos?.kind === 'BEARISH_BOS'))) ||
    Boolean(ctx.choch)
  return check(
    'Structure',
    passed,
    required,
    passed
      ? `Structure state ${state}${ctx.bos ? ` with ${ctx.bos.kind}` : ''}${ctx.choch ? ` with ${ctx.choch.kind}` : ''}`
      : `Structure state ${state} does not support ${ctx.direction} setup`,
    [ctx.bos?.id, ctx.choch?.id].filter(Boolean) as string[],
  )
}

export function checkBos(ctx: SetupCheckContext, required: boolean): SetupCheck {
  const ok =
    ctx.bos != null &&
    ((ctx.direction === 'BULLISH' && ctx.bos.kind === 'BULLISH_BOS') ||
      (ctx.direction === 'BEARISH' && ctx.bos.kind === 'BEARISH_BOS'))
  return check(
    'BOS',
    ok,
    required,
    ok ? `${ctx.bos!.kind} at index ${ctx.bos!.candleIndex}` : 'No matching BOS',
    ctx.bos ? [ctx.bos.id] : [],
  )
}

export function checkChoch(ctx: SetupCheckContext, required: boolean): SetupCheck {
  const ok =
    ctx.choch != null &&
    ((ctx.direction === 'BULLISH' && ctx.choch.kind === 'BULLISH_CHOCH') ||
      (ctx.direction === 'BEARISH' && ctx.choch.kind === 'BEARISH_CHOCH'))
  return check(
    'CHOCH',
    ok,
    required,
    ok ? `${ctx.choch!.kind} at index ${ctx.choch!.candleIndex}` : 'No matching CHoCH',
    ctx.choch ? [ctx.choch.id] : [],
  )
}

export function checkLiquidity(ctx: SetupCheckContext, required: boolean): SetupCheck {
  const equals = ctx.detection.equalLevelEvents.filter((e) => e.candleIndex <= ctx.visibleIndex)
  const passed = equals.length > 0 || ctx.sweep != null
  return check(
    'Liquidity',
    passed,
    required,
    passed
      ? ctx.sweep
        ? `Liquidity context via sweep ${ctx.sweep.id}`
        : `Equal levels present (${equals.length})`
      : 'No equal-level / liquidity context',
    ctx.sweep ? [ctx.sweep.id] : equals.slice(0, 2).map((e) => e.id),
  )
}

export function checkSweep(ctx: SetupCheckContext, required: boolean): SetupCheck {
  const ok =
    ctx.sweep != null &&
    ((ctx.direction === 'BULLISH' && ctx.sweep.kind === 'SELL_SIDE_LIQUIDITY_SWEEP') ||
      (ctx.direction === 'BEARISH' && ctx.sweep.kind === 'BUY_SIDE_LIQUIDITY_SWEEP'))
  return check(
    'Sweep',
    ok,
    required,
    ok
      ? `${ctx.sweep!.kind} at ${ctx.sweep!.candleIndex}`
      : 'No opposing liquidity sweep',
    ctx.sweep ? [ctx.sweep.id] : [],
  )
}

export function checkDisplacement(ctx: SetupCheckContext, required: boolean): SetupCheck {
  const ok =
    ctx.displacement != null &&
    ((ctx.direction === 'BULLISH' && ctx.displacement.kind === 'BULLISH_DISPLACEMENT') ||
      (ctx.direction === 'BEARISH' && ctx.displacement.kind === 'BEARISH_DISPLACEMENT'))
  return check(
    'Displacement',
    ok,
    required,
    ok
      ? `${ctx.displacement!.kind} body/ATR ${ctx.displacement!.bodyAtrMultiple.toFixed(2)}`
      : 'No matching displacement',
    ctx.displacement ? [ctx.displacement.id] : [],
  )
}

export function checkFvg(ctx: SetupCheckContext, required: boolean): SetupCheck {
  const ok =
    ctx.fvg != null &&
    ctx.fvg.direction === ctx.direction &&
    (ctx.fvg.kind === 'BULLISH_FVG_CREATED' || ctx.fvg.kind === 'BEARISH_FVG_CREATED') &&
    ctx.fvg.state !== 'INVALIDATED' &&
    ctx.fvg.state !== 'FULLY_FILLED'
  return check(
    'FVG',
    ok,
    required,
    ok
      ? `${ctx.direction} FVG ${ctx.fvg!.fvgId} state ${ctx.fvg!.state}`
      : ctx.fvg
        ? `FVG ${ctx.fvg.fvgId} unusable (state ${ctx.fvg.state})`
        : 'No matching FVG',
    ctx.fvg ? [ctx.fvg.id, ctx.fvg.fvgId] : [],
  )
}

export function checkOb(ctx: SetupCheckContext, required: boolean): SetupCheck {
  const ok =
    ctx.ob != null &&
    ctx.ob.direction === ctx.direction &&
    !ctx.ob.invalidationStatus &&
    ctx.ob.mitigationStatus !== 'INVALIDATED' &&
    ctx.ob.mitigationStatus !== 'MITIGATED' &&
    ctx.ob.mitigationStatus !== 'FULLY_FILLED'
  return check(
    'OB',
    ok,
    required,
    ok
      ? `${ctx.direction} OB ${ctx.ob!.orderBlockId} state ${ctx.ob!.mitigationStatus}`
      : ctx.ob
        ? `OB ${ctx.ob.orderBlockId} unusable (${ctx.ob.mitigationStatus})`
        : 'No matching Order Block',
    ctx.ob ? [ctx.ob.id, ctx.ob.orderBlockId] : [],
  )
}

export function checkZoneLifecycle(ctx: SetupCheckContext, required: boolean): SetupCheck {
  const zone = ctx.zone
  if (!zone) {
    return check('Zone Lifecycle', false, required, 'No projected zone for entry', [])
  }
  const live =
    zone.activeAtVisibleIndex &&
    (zone.state === 'ACTIVE' ||
      zone.state === 'NEW' ||
      zone.state === 'TOUCHED' ||
      zone.state === 'PARTIAL' ||
      zone.state === 'PARTIALLY_MITIGATED')
  return check(
    'Zone Lifecycle',
    live,
    required,
    live
      ? `Zone ${zone.zoneId} live (${zone.state})`
      : `Zone ${zone.zoneId} not live (${zone.state})`,
    [zone.zoneId, zone.sourceEventId],
  )
}

export function checkRetest(ctx: SetupCheckContext, required: boolean): SetupCheck {
  const zoneTouched =
    ctx.zone != null &&
    (ctx.zone.state === 'TOUCHED' ||
      ctx.zone.state === 'PARTIAL' ||
      ctx.zone.state === 'PARTIALLY_MITIGATED' ||
      ctx.zone.firstTouchIndex != null)
  const obTouched =
    ctx.ob != null &&
    (ctx.ob.mitigationStatus === 'TOUCHED' ||
      ctx.ob.mitigationStatus === 'HALF_FILLED' ||
      ctx.ob.firstRetestTimestamp != null)
  const fvgTouched =
    ctx.fvg != null &&
    (ctx.fvg.state === 'TOUCHED' ||
      ctx.fvg.state === 'HALF_FILLED' ||
      ctx.fvg.firstMitigationTimestamp != null)
  const qmlRetest =
    ctx.qml != null &&
    (ctx.qml.status === 'RETESTED' ||
      ctx.qml.status === 'ENTRY_READY' ||
      ctx.qml.retestIndex != null)
  const passed = Boolean(zoneTouched || obTouched || fvgTouched || qmlRetest)
  return check(
    'Retest',
    passed,
    required,
    passed ? 'Entry zone retested' : 'Awaiting retest of entry zone',
    [ctx.zone?.zoneId, ctx.ob?.orderBlockId, ctx.fvg?.fvgId, ctx.qml?.id].filter(
      Boolean,
    ) as string[],
  )
}

export function checkQml(ctx: SetupCheckContext, required: boolean): SetupCheck {
  const ok =
    ctx.qml != null &&
    ctx.qml.direction === ctx.direction &&
    ctx.qml.status !== 'INVALIDATED' &&
    ctx.qml.status !== 'EXPIRED'
  return check(
    'QML',
    ok,
    required,
    ok
      ? `QML ${ctx.qml!.id} status ${ctx.qml!.status}`
      : ctx.qml
        ? `QML ${ctx.qml.id} not actionable (${ctx.qml.status})`
        : 'No QML pattern',
    ctx.qml ? [ctx.qml.id, ctx.qml.zoneId] : [],
  )
}

export function checkFreshness(ctx: SetupCheckContext, required: boolean): SetupCheck {
  const age = ctx.visibleIndex - ctx.anchorIndex
  const passed = age >= 0 && age <= ctx.config.freshnessMaxAgeCandles
  return check(
    'Freshness',
    passed,
    required,
    passed
      ? `Setup age ${age} candles (≤ ${ctx.config.freshnessMaxAgeCandles})`
      : `Setup stale (age ${age} > ${ctx.config.freshnessMaxAgeCandles})`,
    [],
  )
}

export function checkConflictFlag(
  hasConflict: boolean,
  reason: string,
  required: boolean,
): SetupCheck {
  return check(
    'Conflict',
    !hasConflict,
    required,
    hasConflict ? reason : 'No active conflict for this setup',
    [],
  )
}

export function missingFromChecks(checks: readonly SetupCheck[]): string[] {
  return checks.filter((c) => c.required && !c.passed).map((c) => c.name)
}

export function latestCreatedFvg(
  events: readonly SmcFvgEvent[],
  direction: SetupDirection,
  afterIndex: number,
  visibleIndex: number,
): SmcFvgEvent | null {
  const created = events.filter(
    (e) =>
      e.candleIndex <= visibleIndex &&
      e.candleIndex >= afterIndex &&
      e.direction === direction &&
      (e.kind === 'BULLISH_FVG_CREATED' || e.kind === 'BEARISH_FVG_CREATED'),
  )
  return created.at(-1) ?? null
}

export function latestCreatedOb(
  events: readonly SmcOrderBlockEvent[],
  direction: SetupDirection,
  afterIndex: number,
  visibleIndex: number,
): SmcOrderBlockEvent | null {
  const created = events.filter(
    (e) =>
      e.candleIndex <= visibleIndex &&
      e.candleIndex >= Math.max(0, afterIndex - 5) &&
      e.direction === direction &&
      (e.kind === 'BULLISH_ORDER_BLOCK_CREATED' || e.kind === 'BEARISH_ORDER_BLOCK_CREATED'),
  )
  return created.at(-1) ?? null
}

export function latestDisplacement(
  events: readonly SmcDisplacementEvent[],
  direction: SetupDirection,
  aroundIndex: number,
  visibleIndex: number,
  window = 8,
): SmcDisplacementEvent | null {
  const kind =
    direction === 'BULLISH' ? 'BULLISH_DISPLACEMENT' : 'BEARISH_DISPLACEMENT'
  return (
    events
      .filter(
        (e) =>
          e.kind === kind &&
          e.candleIndex <= visibleIndex &&
          Math.abs(e.candleIndex - aroundIndex) <= window,
      )
      .at(-1) ?? null
  )
}

export function latestOpposingSweep(
  events: readonly SmcLiquiditySweepEvent[],
  direction: SetupDirection,
  beforeOrAt: number,
  visibleIndex: number,
  lookback = 24,
): SmcLiquiditySweepEvent | null {
  const kind =
    direction === 'BULLISH'
      ? 'SELL_SIDE_LIQUIDITY_SWEEP'
      : 'BUY_SIDE_LIQUIDITY_SWEEP'
  return (
    events
      .filter(
        (e) =>
          e.kind === kind &&
          e.candleIndex <= visibleIndex &&
          e.candleIndex <= beforeOrAt &&
          e.candleIndex >= beforeOrAt - lookback,
      )
      .at(-1) ?? null
  )
}

export function findZoneForSource(
  zones: readonly SmcZoneProjection[],
  sourceIds: readonly string[],
): SmcZoneProjection | null {
  const set = new Set(sourceIds)
  return (
    zones.find(
      (z) => set.has(z.zoneId) || set.has(z.sourceEventId) || z.setupRefs.some((r) => set.has(r)),
    ) ?? null
  )
}

/** Rewind QML status to what was knowable at visibleIndex (no look-ahead). */
export function qmlStatusAtVisibleIndex(
  pattern: QmlPattern,
  visibleIndex: number,
): QmlPattern['status'] | null {
  if (pattern.createdIndex > visibleIndex) return null
  if (pattern.invalidatedIndex != null && pattern.invalidatedIndex <= visibleIndex) {
    return 'INVALIDATED'
  }
  if (pattern.expiredIndex != null && pattern.expiredIndex <= visibleIndex) {
    return 'EXPIRED'
  }
  if (pattern.entryReadyIndex != null && pattern.entryReadyIndex <= visibleIndex) {
    return 'ENTRY_READY'
  }
  if (pattern.retestIndex != null && pattern.retestIndex <= visibleIndex) {
    return 'RETESTED'
  }
  if (pattern.zoneActiveIndex != null && pattern.zoneActiveIndex <= visibleIndex) {
    return 'ZONE_ACTIVE'
  }
  if (pattern.confirmedIndex != null && pattern.confirmedIndex <= visibleIndex) {
    return 'CONFIRMED'
  }
  return pattern.status === 'CANDIDATE' ? 'CANDIDATE' : 'CONFIRMED'
}

export function rewindQmlPattern(pattern: QmlPattern, visibleIndex: number): QmlPattern | null {
  const status = qmlStatusAtVisibleIndex(pattern, visibleIndex)
  if (status == null) return null
  return { ...pattern, status }
}

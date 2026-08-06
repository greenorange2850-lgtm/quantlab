// ─── Playbook Engine — Evaluator ──────────────────────────────────────────────
//
// Consumes existing detector outputs + market structure and evaluates trading
// rules for the built-in playbooks. Deterministic: given the same context the
// result is identical. Never mutates detector outputs.

import { resolveParameters, validateParameters } from './parameters.js'
import {
  atr,
  detectSweep,
  detectStructureTrend,
  evaluateZoneLifecycle,
  findBrokenSwingZone,
  hasDisplacement,
  hasHigherHighs,
  hasHigherLows,
  hasLowerHighs,
  hasLowerLows,
  isBearishRejection,
  isBullishRejection,
} from './structure.js'
import { canonicalStringify, fingerprintHash } from './json.js'
import { round1, scoreSetupStrength } from './scoring.js'
import type {
  EntryZone,
  EventChainLink,
  NextExpectedEvent,
  PlaybookAction,
  PlaybookCheck,
  PlaybookContext,
  PlaybookDirection,
  PlaybookEvaluation,
  PlaybookEvent,
  PlaybookParameters,
  PlaybookStatus,
  PriceZone,
  StopReference,
  Target,
  ZoneSnapshot,
} from './types.js'

export interface EvaluationFacts {
  checks: PlaybookCheck[]
  direction: PlaybookDirection
  zone: ZoneSnapshot | null
  entryZone: EntryZone | null
  stopReference: StopReference | null
  targets: Target[]
  eventChain: EventChainLink[]
  nextExpectedEvent: NextExpectedEvent | null
  warnings: string[]
  explanationParts: string[]
}

// ─── Parameter helpers ────────────────────────────────────────────────────────

export function paramNumber(params: PlaybookParameters, key: string, fallback: number): number {
  const v = params[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

export function paramBool(params: PlaybookParameters, key: string, fallback: boolean): boolean {
  const v = params[key]
  return typeof v === 'boolean' ? v : fallback
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function findCandleIndex(candles: PlaybookContext['candles'], timestamp: string): number {
  const t = new Date(timestamp).getTime()
  for (let i = candles.length - 1; i >= 0; i--) {
    if (new Date(candles[i].timestamp).getTime() <= t) return i
  }
  return 0
}

function promote(
  check: { id: string; label: string; required: boolean },
  enabled: boolean,
): PlaybookCheck {
  return { ...check, required: check.required || enabled, passed: false }
}

function zoneSnapshot(
  kind: ZoneSnapshot['kind'],
  direction: PlaybookDirection,
  zone: PriceZone,
  formedAtIndex: number,
  index: number,
  maxAge: number,
  maxTouches: number,
  candles: PlaybookContext['candles'],
  label: string,
): ZoneSnapshot {
  const dir: 'long' | 'short' = direction === 'long' ? 'long' : 'short'
  const lifecycle = evaluateZoneLifecycle(zone, candles, formedAtIndex, index, maxAge, maxTouches, dir)
  const expired = !lifecycle.alive && lifecycle.reason?.startsWith('Zone too old') === true
  const stale = !lifecycle.alive && lifecycle.reason?.startsWith('Zone touched') === true
  return {
    kind,
    direction,
    zone,
    formedAtTimestamp: candles[Math.min(formedAtIndex, candles.length - 1)]?.timestamp ?? '',
    formedAtIndex,
    touchedCount: lifecycle.touchedCount,
    ageBars: lifecycle.ageBars,
    invalidated: !lifecycle.alive && !expired && !stale,
    expired: expired || stale,
    invalidationReason: lifecycle.reason,
    label,
  }
}

function isRetest(
  candles: PlaybookContext['candles'],
  zone: PriceZone,
  fromIndex: number,
  index: number,
  direction: 'long' | 'short',
): boolean {
  for (let i = fromIndex + 1; i <= index; i++) {
    const c = candles[i]
    if (direction === 'long' && c.low <= zone.top && c.close > zone.top) return true
    if (direction === 'short' && c.high >= zone.bottom && c.close < zone.bottom) return true
  }
  return false
}

function buildTargets(
  entry: number,
  stop: number,
  rr: number,
  direction: 'long' | 'short',
  extension: number | null,
): Target[] {
  const risk = Math.abs(entry - stop)
  if (risk <= 0) return []
  const t1Price = direction === 'long' ? entry + risk * rr : entry - risk * rr
  const targets: Target[] = [
    {
      order: 1,
      price: round1(t1Price),
      kind: 'rr',
      label: `RR ${rr}`,
    },
  ]
  if (extension !== null && Number.isFinite(extension)) {
    targets.push({
      order: 2,
      price: direction === 'long' ? Math.max(extension, t1Price) : Math.min(extension, t1Price),
      kind: 'structure',
      label: 'Next structure',
    })
  }
  return targets
}

// ─── QML Reversal evaluation ──────────────────────────────────────────────────

function evaluateQml(context: PlaybookContext, params: PlaybookParameters): EvaluationFacts {
  const { candles, index, definition, events } = context
  const lookback = paramNumber(params, 'swingLookback', 5)
  const trendStrength = Math.max(1, Math.round(paramNumber(params, 'trendStrength', 2)))
  const maxAge = paramNumber(params, 'maxZoneAge', 20)
  const maxTouches = paramNumber(params, 'maxTouches', 3)
  const requireSweep = paramBool(params, 'requireSweep', false)
  const requireRejection = paramBool(params, 'requireRejection', false)
  const requireDisplacement = paramBool(params, 'requireDisplacement', false)
  const requireFvg = paramBool(params, 'requireFvg', false)
  const requireOb = paramBool(params, 'requireOb', false)
  const tolerance = paramNumber(params, 'sweepTolerance', 0.0002)

  const bullish = definition.bias === 'bullish'
  const direction: PlaybookDirection = bullish ? 'long' : 'short'

  const checks: PlaybookCheck[] = []
  const eventChain: EventChainLink[] = []
  const warnings: string[] = []
  const explanationParts: string[] = []

  // 0. The broken structural swing anchors the QML zone. Resolve it first so
  // the opposing-context and LH+LL checks can be evaluated over the window
  // *before* the break — that is the structure that the reversal invalidates.
  const broken = findBrokenSwingZone(candles, index, lookback, bullish ? 'bullish' : 'bearish')
  const contextWindow = broken ? broken.brokenAtIndex : index

  // 1. Context (opposing trend).
  const trend = detectStructureTrend(candles, contextWindow, lookback)
  const contextOk = bullish ? trend === 'bearish' : trend === 'bullish'
  checks.push({
    id: 'qml-context',
    label: bullish ? 'Bearish context' : 'Bullish context',
    required: true,
    passed: contextOk,
    source: 'structure',
    detail: contextOk
      ? `Structure trend before the break is ${trend}`
      : `Structure trend before the break is ${trend}, expected ${bullish ? 'bearish' : 'bullish'}`,
  })

  // 2. LH + LL (or HH + HL) structure.
  const structureOk = bullish
    ? hasLowerHighs(candles, contextWindow, lookback, trendStrength) &&
      hasLowerLows(candles, contextWindow, lookback, trendStrength)
    : hasHigherHighs(candles, contextWindow, lookback, trendStrength) &&
      hasHigherLows(candles, contextWindow, lookback, trendStrength)
  checks.push({
    id: 'qml-lh-ll',
    label: bullish ? 'Lower highs + lower lows structure' : 'Higher highs + higher lows structure',
    required: true,
    passed: structureOk,
    source: 'structure',
    detail: structureOk
      ? `Confirmed with ${trendStrength} swing pairs before the break`
      : `Needs ${trendStrength} consecutive swing pairs before the break`,
  })

  // 3. Break above latest valid LH / below latest valid HL.
  const breakOk = broken !== null
  checks.push({
    id: 'qml-break',
    label: bullish ? 'Break above latest valid LH' : 'Break below latest valid HL',
    required: true,
    passed: breakOk,
    source: 'structure',
    detail: breakOk
      ? `Broken swing at index ${broken!.swing.index} (${broken!.swing.price.toFixed(5)})`
      : 'No broken structural swing found',
  })

  // 4. CHoCH — prefer detector event, fall back to structure.
  const chochEvent = latestEventFor(events, 'CHOCH', bullish ? 'bullish' : 'bearish', index)
  const chochOk = chochEvent !== null || breakOk
  checks.push({
    id: 'qml-choch',
    label: bullish ? 'Bullish CHoCH' : 'Bearish CHoCH',
    required: true,
    passed: chochOk,
    source: chochEvent ? 'event' : 'structure',
    detail: chochEvent ? 'Detected by CHOCH rule' : 'Derived from structure break',
  })

  // 5. Broken swing becomes the QML zone.
  let zone: ZoneSnapshot | null = null
  let entryZone: EntryZone | null = null
  let stopReference: StopReference | null = null
  let targets: Target[] = []
  let retestOk = false
  let entryPrice = 0
  let stopPrice = 0

  if (broken) {
    const snap = zoneSnapshot(
      'qml',
      direction,
      broken.zone,
      broken.brokenAtIndex,
      index,
      maxAge,
      maxTouches,
      candles,
      bullish ? 'Bullish QML zone' : 'Bearish QML zone',
    )
    zone = snap
    checks.push({
      id: 'qml-zone',
      label: bullish ? 'Broken LH becomes QML zone' : 'Broken HL becomes QML zone',
      required: true,
      passed: !snap.invalidated,
      source: 'structure',
      detail: snap.invalidated
        ? snap.invalidationReason
        : `Zone ${snap.zone.bottom.toFixed(5)}–${snap.zone.top.toFixed(5)} (${snap.ageBars} bars old, ${snap.touchedCount} touches)`,
    })

    retestOk = isRetest(candles, broken.zone, broken.brokenAtIndex, index, bullish ? 'long' : 'short')
    checks.push({
      id: 'qml-retest',
      label: 'Later retest of QML zone',
      required: true,
      passed: retestOk,
      source: 'structure',
      detail: retestOk ? 'Zone retested and held' : 'No retest yet — zone waiting',
    })

    const atrValue = atr(candles, paramNumber(params, 'atrPeriod', 14), index)
    const buffer = paramNumber(params, 'stopBuffer', 0) * atrValue
    if (bullish) {
      entryPrice = broken.zone.top
      stopPrice = broken.zone.bottom - buffer
    } else {
      entryPrice = broken.zone.bottom
      stopPrice = broken.zone.top + buffer
    }
    entryZone = {
      zone: broken.zone,
      kind: 'qml',
      label: bullish ? 'QML zone (broken LH)' : 'QML zone (broken HL)',
      timestamp: candles[broken.brokenAtIndex]?.timestamp,
    }
    stopReference = {
      price: round1(stopPrice),
      kind: 'zone_beyond',
      label: bullish ? 'Below QML zone' : 'Above QML zone',
    }
    targets = buildTargets(
      entryPrice,
      stopPrice,
      paramNumber(params, 'rr', 2),
      bullish ? 'long' : 'short',
      nextStructureLevel(candles, broken.brokenAtIndex, index, lookback, bullish ? 'long' : 'short'),
    )
  } else {
    checks.push({
      id: 'qml-zone',
      label: bullish ? 'Broken LH becomes QML zone' : 'Broken HL becomes QML zone',
      required: true,
      passed: false,
      source: 'structure',
      detail: 'No broken swing to anchor the QML zone',
    })
    checks.push({
      id: 'qml-retest',
      label: 'Later retest of QML zone',
      required: true,
      passed: false,
      source: 'structure',
      detail: 'Zone not formed yet',
    })
  }

  // 6. Optional checks.
  const swept = detectSweep(candles, index, lookback, tolerance, bullish ? 'long' : 'short')
  const sweepEvent = latestEventFor(events, 'Liquidity Sweep', bullish ? 'bullish' : 'bearish', index)
  const sweepOk = sweepEvent !== null || swept !== null
  checks.push(promote(
    {
      id: 'qml-sweep',
      label: bullish ? 'Sell-side liquidity sweep' : 'Buy-side liquidity sweep',
      required: false,
    },
    requireSweep,
  ))
  setCheckPassed(checks, 'qml-sweep', sweepOk, sweepEvent ? 'event' : 'structure',
    sweepOk ? 'Sweep detected' : 'No sweep of opposing liquidity')

  const lastRetestCandle = zone && retestOk ? candles[index] : null
  const rejectionOk = lastRetestCandle !== null
    ? (bullish ? isBullishRejection(lastRetestCandle) : isBearishRejection(lastRetestCandle))
    : false
  checks.push(promote(
    { id: 'qml-rejection', label: bullish ? 'Bullish rejection' : 'Bearish rejection', required: false },
    requireRejection,
  ))
  setCheckPassed(checks, 'qml-rejection', rejectionOk, 'structure',
    rejectionOk ? 'Rejection candle on retest' : 'No rejection candle at zone')

  const displacementOk = hasDisplacement(candles, index, 2, lookback)
  checks.push(promote(
    { id: 'qml-displacement', label: 'Displacement', required: false },
    requireDisplacement,
  ))
  setCheckPassed(checks, 'qml-displacement', displacementOk, 'structure',
    displacementOk ? 'Impulse candle present' : 'No displacement')

  const fvgOk = zone !== null && nearestEventNearZone(events, ['FVG'], bullish ? 'bullish' : 'bearish', zone.zone, index) !== null
  checks.push(promote(
    { id: 'qml-fvg', label: 'FVG confluence', required: false },
    requireFvg,
  ))
  setCheckPassed(checks, 'qml-fvg', fvgOk, 'event', fvgOk ? 'FVG overlaps zone' : 'No FVG near zone')

  const obOk = zone !== null && nearestEventNearZone(events, ['Order Block'], bullish ? 'bullish' : 'bearish', zone.zone, index) !== null
  checks.push(promote(
    { id: 'qml-ob', label: 'OB confluence', required: false },
    requireOb,
  ))
  setCheckPassed(checks, 'qml-ob', obOk, 'event', obOk ? 'OB overlaps zone' : 'No OB near zone')

  // Event chain. Context and structure facts are dated at the pre-break window
  // so the chain is chronological (the structure existed *before* the break).
  const contextCandle = candles[Math.min(contextWindow, candles.length - 1)]
  eventChain.push({
    label: `${bullish ? 'Bearish' : 'Bullish'} context confirmed`,
    timestamp: contextCandle.timestamp,
    candleIndex: contextWindow,
    direction: 'neutral',
  })
  if (structureOk) {
    eventChain.push({
      label: 'LH + LL structure',
      timestamp: contextCandle.timestamp,
      candleIndex: contextWindow,
      direction,
    })
  }
  if (chochEvent) {
    eventChain.push({ label: `${bullish ? 'Bullish' : 'Bearish'} CHoCH`, timestamp: chochEvent.timestamp, candleIndex: chochEvent.candleIndex ?? index, sourceEventId: chochEvent.id, direction })
  }
  if (broken) {
    eventChain.push({
      label: 'QML zone formed',
      timestamp: candles[broken.brokenAtIndex].timestamp,
      candleIndex: broken.brokenAtIndex,
      direction,
    })
  }
  if (retestOk) eventChain.push({ label: 'Zone retested', timestamp: candles[index].timestamp, candleIndex: index, direction })

  explanationParts.push(
    bullish
      ? 'Bullish QML Reversal: broken lower high formed the QML zone'
      : 'Bearish QML Reversal: broken higher low formed the QML zone',
  )

  if (zone?.expired) warnings.push(`Zone expired (${zone.invalidationReason ?? 'too old/touched'})`)

  return {
    checks,
    direction,
    zone,
    entryZone,
    stopReference,
    targets,
    eventChain,
    nextExpectedEvent: null,
    warnings,
    explanationParts,
  }
}

// ─── Continuation evaluation ──────────────────────────────────────────────────

function evaluateContinuation(context: PlaybookContext, params: PlaybookParameters): EvaluationFacts {
  const { candles, index, definition, events } = context
  const bullish = definition.bias === 'bullish'
  const direction: PlaybookDirection = bullish ? 'long' : 'short'
  const lookback = paramNumber(params, 'swingLookback', 5)
  const trendStrength = Math.max(1, Math.round(paramNumber(params, 'trendStrength', 2)))
  const maxAge = paramNumber(params, 'maxZoneAge', 20)
  const maxTouches = paramNumber(params, 'maxTouches', 3)
  const requireFvg = paramBool(params, 'requireFvg', false)
  const requireOb = paramBool(params, 'requireOb', false)
  const requireSweep = paramBool(params, 'requireSweep', false)
  const requireDisplacement = paramBool(params, 'requireDisplacement', false)
  const requireDow = paramBool(params, 'requireDowAlignment', true)
  const requireFresh = paramBool(params, 'requireFreshZone', false)
  const requireFirstRetest = paramBool(params, 'requireFirstRetest', false)
  const tolerance = paramNumber(params, 'sweepTolerance', 0.0002)

  const checks: PlaybookCheck[] = []
  const eventChain: EventChainLink[] = []
  const warnings: string[] = []
  const explanationParts: string[] = []

  // 1. Valid BOS.
  const bosEvent = latestEventFor(events, 'BOS', bullish ? 'bullish' : 'bearish', index)
  checks.push({
    id: 'cont-bos',
    label: 'Valid BOS in trend direction',
    required: true,
    passed: bosEvent !== null,
    source: 'event',
    detail: bosEvent ? `BOS at ${bosEvent.timestamp}` : 'No BOS in trend direction',
  })

  // 2. Active FVG/OB zone.
  const fvgEvent = latestEventFor(events, 'FVG', bullish ? 'bullish' : 'bearish', index)
  const obEvent = latestEventFor(events, 'Order Block', bullish ? 'bullish' : 'bearish', index)
  const hasFvg = fvgEvent !== null
  const hasOb = obEvent !== null
  const zoneEvent = pickZoneEvent(bullish, fvgEvent, obEvent, requireFvg, requireOb)
  const zoneFromEvent = zoneEvent !== null
  const zoneOk = zoneFromEvent && (!requireFvg || hasFvg) && (!requireOb || hasOb)
  checks.push({
    id: 'cont-zone',
    label: 'Active FVG/OB zone',
    required: true,
    passed: zoneOk,
    source: 'event',
    detail: zoneFromEvent
      ? `${zoneEvent!.ruleName} zone active${requireFvg && !hasFvg ? ' — FVG required but missing' : ''}${requireOb && !hasOb ? ' — OB required but missing' : ''}`
      : 'No FVG or OB zone found',
  })

  // 3. Zone alive + 4. no opposing conflict.
  let zone: ZoneSnapshot | null = null
  let entryZone: EntryZone | null = null
  let stopReference: StopReference | null = null
  let targets: Target[] = []
  let conflictOk = false
  let entryPrice = 0
  let stopPrice = 0
  let formedIndex = 0
  let zonePrice: PriceZone | null = null

  if (zoneEvent) {
    const meta = zoneEvent.metadata
    const top = (meta.obHigh as number) ?? (meta.gapTop as number) ?? NaN
    const bottom = (meta.obLow as number) ?? (meta.gapBottom as number) ?? NaN
    if (Number.isFinite(top) && Number.isFinite(bottom) && top >= bottom) {
      zonePrice = { top, bottom }
      formedIndex = zoneEvent.candleIndex ?? findCandleIndex(candles, zoneEvent.timestamp)
      const snap = zoneSnapshot(
        'continuation',
        direction,
        zonePrice,
        formedIndex,
        index,
        maxAge,
        maxTouches,
        candles,
        `${zoneEvent.ruleName} zone`,
      )
      zone = snap

      const opposing = latestEventFor(events, bullish ? ['BOS', 'CHOCH'] : ['BOS', 'CHOCH'], bullish ? 'bearish' : 'bullish', index)
      const opposingAfterZone = opposing !== null && (opposing.candleIndex ?? findCandleIndex(candles, opposing.timestamp)) > formedIndex
      let structuralConflict = false
      for (let i = formedIndex; i <= index; i++) {
        if (bullish && candles[i].close < zonePrice.bottom) structuralConflict = true
        if (!bullish && candles[i].close > zonePrice.top) structuralConflict = true
      }
      conflictOk = !snap.invalidated && !opposingAfterZone && !structuralConflict
    }
  }

  checks.push({
    id: 'cont-zone-alive',
    label: 'Zone alive',
    required: true,
    passed: zone !== null && !zone.invalidated && !zone.expired,
    source: 'structure',
    detail: zone
      ? zone.invalidated
        ? zone.invalidationReason
        : zone.expired
          ? zone.invalidationReason
          : `Zone ${zone.zone.bottom.toFixed(5)}–${zone.zone.top.toFixed(5)} alive (${zone.ageBars} bars, ${zone.touchedCount} touches)`
      : 'No zone to track',
  })
  checks.push({
    id: 'cont-conflict',
    label: 'No opposing structure conflict',
    required: true,
    passed: conflictOk,
    source: 'structure',
    detail: conflictOk ? 'No opposing break after zone' : 'Opposing structure broke through zone',
  })

  if (zone && zonePrice) {
    const atrValue = atr(candles, paramNumber(params, 'atrPeriod', 14), index)
    const buffer = paramNumber(params, 'stopBuffer', 0) * atrValue
    if (bullish) {
      entryPrice = zonePrice.top
      stopPrice = zonePrice.bottom - buffer
    } else {
      entryPrice = zonePrice.bottom
      stopPrice = zonePrice.top + buffer
    }
    entryZone = {
      zone: zonePrice,
      kind: zoneEvent!.ruleName === 'FVG' ? 'fvg' : 'order_block',
      label: `${zoneEvent!.ruleName} zone`,
      timestamp: candles[formedIndex]?.timestamp,
    }
    stopReference = {
      price: round1(stopPrice),
      kind: 'zone_beyond',
      label: bullish ? 'Below zone' : 'Above zone',
    }
    targets = buildTargets(
      entryPrice,
      stopPrice,
      paramNumber(params, 'rr', 2),
      bullish ? 'long' : 'short',
      nextStructureLevel(candles, formedIndex, index, lookback, bullish ? 'long' : 'short'),
    )
  }

  // 5. Optional checks.
  const swept = detectSweep(candles, index, lookback, tolerance, bullish ? 'long' : 'short')
  const sweepEvent = latestEventFor(events, 'Liquidity Sweep', bullish ? 'bullish' : 'bearish', index)
  const sweepOk = sweepEvent !== null || swept !== null
  checks.push(promote({ id: 'cont-sweep', label: 'Sweep of opposing liquidity', required: false }, requireSweep))
  setCheckPassed(checks, 'cont-sweep', sweepOk, sweepEvent ? 'event' : 'structure', sweepOk ? 'Sweep detected' : 'No sweep')

  const displacementOk = hasDisplacement(candles, index, 2, lookback)
  checks.push(promote({ id: 'cont-displacement', label: 'Displacement', required: false }, requireDisplacement))
  setCheckPassed(checks, 'cont-displacement', displacementOk, 'structure', displacementOk ? 'Impulse candle present' : 'No displacement')

  const dowOk = bullish
    ? hasHigherHighs(candles, index, lookback, trendStrength) && hasHigherLows(candles, index, lookback, trendStrength)
    : hasLowerHighs(candles, index, lookback, trendStrength) && hasLowerLows(candles, index, lookback, trendStrength)
  checks.push(promote({ id: 'cont-dow', label: 'Dow alignment', required: false }, requireDow))
  setCheckPassed(checks, 'cont-dow', dowOk, 'structure', dowOk ? 'Structure aligned with bias' : 'Structure not aligned')

  const freshZoneOk = zone !== null && zone.touchedCount === 0
  checks.push(promote({ id: 'cont-fresh-zone', label: 'Fresh zone', required: false }, requireFresh))
  setCheckPassed(checks, 'cont-fresh-zone', freshZoneOk, 'structure', freshZoneOk ? 'Zone untouched' : `Zone already touched ${zone?.touchedCount ?? 0} times`)

  const firstRetestOk = zone !== null && zone.touchedCount === 1
  checks.push(promote({ id: 'cont-first-retest', label: 'First retest', required: false }, requireFirstRetest))
  setCheckPassed(checks, 'cont-first-retest', firstRetestOk, 'structure', firstRetestOk ? 'Current move is the first retest' : `Zone touched ${zone?.touchedCount ?? 0} times`)

  if (bosEvent) eventChain.push({ label: 'BOS', timestamp: bosEvent.timestamp, candleIndex: bosEvent.candleIndex ?? index, sourceEventId: bosEvent.id, direction })
  if (zoneEvent) eventChain.push({ label: 'Zone active', timestamp: zoneEvent.timestamp, candleIndex: formedIndex, sourceEventId: zoneEvent.id, direction })

  explanationParts.push(
    bullish
      ? 'Bullish Continuation: BOS in bullish structure with active zone'
      : 'Bearish Continuation: BOS in bearish structure with active zone',
  )
  if (zone?.expired) warnings.push(`Zone expired (${zone.invalidationReason ?? 'too old/touched'})`)

  return {
    checks,
    direction,
    zone,
    entryZone,
    stopReference,
    targets,
    eventChain,
    nextExpectedEvent: null,
    warnings,
    explanationParts,
  }
}

// ─── Event helpers (internal) ─────────────────────────────────────────────────

function latestEventFor(
  events: PlaybookEvent[],
  ruleNames: string | string[],
  direction: PlaybookEvent['direction'],
  endIndex: number,
): PlaybookEvent | null {
  const names = Array.isArray(ruleNames) ? ruleNames : [ruleNames]
  const matches = events.filter((e) => {
    if (!names.includes(e.ruleName)) return false
    if (e.direction !== direction) return false
    const idx = e.candleIndex ?? Number.MAX_SAFE_INTEGER
    return idx <= endIndex
  })
  matches.sort((a, b) => (a.candleIndex ?? 0) - (b.candleIndex ?? 0))
  return matches.length > 0 ? matches[matches.length - 1] : null
}

function nearestEventNearZone(
  events: PlaybookEvent[],
  ruleNames: string[],
  direction: PlaybookEvent['direction'],
  zone: PriceZone,
  endIndex: number,
): PlaybookEvent | null {
  const candidates = events.filter((e) => {
    if (!ruleNames.includes(e.ruleName)) return false
    if (e.direction !== direction) return false
    const idx = e.candleIndex ?? Number.MAX_SAFE_INTEGER
    return idx <= endIndex
  })
  let best: PlaybookEvent | null = null
  let bestDist = Infinity
  for (const e of candidates) {
    const anchor = eventAnchor(e)
    if (anchor === null) continue
    const distance = Math.min(Math.abs(anchor - zone.top), Math.abs(anchor - zone.bottom))
    const reference = Math.max(Math.abs(zone.top), Math.abs(zone.bottom), 1e-9)
    if (distance / reference <= 0.01 && distance < bestDist) {
      best = e
      bestDist = distance
    }
  }
  return best
}

function eventAnchor(e: PlaybookEvent): number | null {
  const m = e.metadata
  if (typeof m.level === 'number') return m.level
  if (typeof m.gapTop === 'number' && typeof m.gapBottom === 'number') return (m.gapTop + m.gapBottom) / 2
  if (typeof m.obHigh === 'number' && typeof m.obLow === 'number') return (m.obHigh + m.obLow) / 2
  if (typeof m.sweptLevel === 'number') return m.sweptLevel
  return null
}

function pickZoneEvent(
  bullish: boolean,
  fvg: PlaybookEvent | null,
  ob: PlaybookEvent | null,
  requireFvg: boolean,
  requireOb: boolean,
): PlaybookEvent | null {
  if (requireFvg && requireOb) {
    if (!fvg || !ob) return null
    return (fvg.candleIndex ?? 0) >= (ob.candleIndex ?? 0) ? fvg : ob
  }
  if (requireFvg) return fvg
  if (requireOb) return ob
  const preferred = bullish ? fvg ?? ob : fvg ?? ob
  if (preferred) return preferred
  return fvg ?? ob
}

function nextStructureLevel(
  candles: PlaybookContext['candles'],
  fromIndex: number,
  index: number,
  lookback: number,
  direction: 'long' | 'short',
): number | null {
  const slice = candles.slice(fromIndex, index + 1)
  if (slice.length < lookback) return null
  let level: number | null = null
  for (let i = lookback; i < slice.length - lookback; i++) {
    let isSwing = true
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j !== i) {
        if (direction === 'long' && slice[j].high >= slice[i].high) { isSwing = false; break }
        if (direction === 'short' && slice[j].low <= slice[i].low) { isSwing = false; break }
      }
    }
    if (isSwing) {
      const value = direction === 'long' ? slice[i].high : slice[i].low
      if (level === null || (direction === 'long' ? value > level : value < level)) {
        level = value
      }
    }
  }
  return level
}

function setCheckPassed(
  checks: PlaybookCheck[],
  id: string,
  passed: boolean,
  source: PlaybookCheck['source'],
  detail: string,
): void {
  const check = checks.find((c) => c.id === id)
  if (check) {
    check.passed = passed
    check.source = source
    check.detail = detail
  }
}

// ─── Status / action resolution ───────────────────────────────────────────────

function resolveStatus(
  facts: EvaluationFacts,
  requiredAllPassed: boolean,
  retestPassed: boolean,
): PlaybookStatus {
  if (facts.zone?.invalidated) return 'INVALIDATED'
  if (facts.zone?.expired) return 'EXPIRED'
  if (requiredAllPassed) return 'READY'
  if (facts.zone && retestPassed) return 'WATCHING'
  if (facts.zone) return 'WAITING_RETEST'
  return 'WATCHING'
}

function resolveAction(
  direction: PlaybookDirection,
  status: PlaybookStatus,
  strength: number,
  minScore: number,
): PlaybookAction {
  if (status === 'READY' && strength >= minScore) {
    return direction === 'long' ? 'BUY' : direction === 'short' ? 'SELL' : 'WAIT'
  }
  if (status === 'READY' && strength < minScore) return 'WAIT'
  if (status === 'WAITING_RETEST') return 'WAIT'
  return 'NO_TRADE'
}

// ─── Public evaluator ─────────────────────────────────────────────────────────

export function evaluatePlaybookAt(context: PlaybookContext): PlaybookEvaluation {
  const started = performance.now()
  const { definition, candles, index } = context

  const issues = validateParameters(definition, context.parameters)
  const params = resolveParameters(definition, context.parameters)
  const visibleEvents = context.events.filter((e) => (e.candleIndex ?? findCandleIndex(candles, e.timestamp)) <= index)

  const structureStart = performance.now()
  const base: EvaluationFacts = definition.kind === 'qml-reversal'
    ? evaluateQml({ ...context, events: visibleEvents, parameters: params }, params)
    : evaluateContinuation({ ...context, events: visibleEvents, parameters: params }, params)
  const structureDurationMs = performance.now() - structureStart

  const required = base.checks.filter((c) => c.required)
  const optional = base.checks.filter((c) => !c.required)
  const requiredPassed = required.filter((c) => c.passed).length
  const requiredAllPassed = required.length > 0 && requiredPassed === required.length

  const zone = base.zone
  const retestPassed = required.find((c) => c.id === 'qml-retest' || c.id === 'cont-zone')?.passed ?? false
  const status = resolveStatus(base, requiredAllPassed, retestPassed)

  const strength = round1(scoreSetupStrength({
    checks: base.checks,
    zone,
    maxTouches: paramNumber(params, 'maxTouches', 3),
    maxZoneAge: paramNumber(params, 'maxZoneAge', 20),
  }))
  const minScore = paramNumber(params, 'minScore', 60)
  const action = resolveAction(base.direction, status, strength, minScore)

  const missingConditions = required.filter((c) => !c.passed).map((c) => c.label)
  const nextExpectedEvent = buildNextExpected(base, status, required.filter((c) => !c.passed))

  const explanation = [
    ...base.explanationParts,
    ...(issues.length > 0 ? [`Parameter warnings: ${issues.map((i) => i.message).join('; ')}`] : []),
  ].join('. ') + '.'

  const evaluation: PlaybookEvaluation = {
    id: `pb-${definition.id}-${index}`,
    playbookId: definition.id,
    playbookVersion: definition.version,
    symbol: context.symbol,
    timeframe: context.timeframe,
    timestamp: candles[index]?.timestamp ?? '',
    candleIndex: index,
    direction: base.direction,
    status,
    action,
    strength,
    checks: base.checks,
    requiredChecks: required,
    optionalChecks: optional,
    missingConditions,
    warnings: base.warnings,
    entryZone: base.entryZone,
    stopReference: base.stopReference,
    targets: base.targets,
    eventChain: base.eventChain,
    nextExpectedEvent,
    zone: base.zone,
    explanation,
    parameters: params,
    diagnostics: {
      evaluationDurationMs: round1(performance.now() - started),
      structureDurationMs: round1(structureDurationMs),
      eventDurationMs: round1(performance.now() - started - structureDurationMs),
    },
    serialized: '',
  }
  evaluation.serialized = canonicalStringify(serializable(evaluation))
  return evaluation
}

function buildNextExpected(
  _facts: EvaluationFacts,
  status: PlaybookStatus,
  missingRequired: PlaybookCheck[],
): NextExpectedEvent | null {
  if (status === 'WAITING_RETEST') {
    return { label: 'Retest of the zone', detail: 'Price pullback into the active zone to trigger entry' }
  }
  if (status === 'WATCHING' && missingRequired.length > 0) {
    return {
      label: missingRequired[0].label,
      detail: 'First missing required condition',
    }
  }
  if (status === 'READY') {
    return { label: 'Entry trigger', detail: 'Price trading at the entry zone with strength above the minimum' }
  }
  return null
}

function serializable(evaluation: PlaybookEvaluation): unknown {
  return {
    id: evaluation.id,
    playbookId: evaluation.playbookId,
    playbookVersion: evaluation.playbookVersion,
    symbol: evaluation.symbol,
    timeframe: evaluation.timeframe,
    timestamp: evaluation.timestamp,
    candleIndex: evaluation.candleIndex,
    direction: evaluation.direction,
    status: evaluation.status,
    action: evaluation.action,
    strength: evaluation.strength,
    missingConditions: evaluation.missingConditions,
    warnings: evaluation.warnings,
    entryZone: evaluation.entryZone,
    stopReference: evaluation.stopReference,
    targets: evaluation.targets,
    nextExpectedEvent: evaluation.nextExpectedEvent,
    explanation: evaluation.explanation,
    parameters: evaluation.parameters,
  }
}

export function evaluationFingerprint(evaluation: PlaybookEvaluation): string {
  return fingerprintHash(`${evaluation.playbookId}:${evaluation.candleIndex}:${evaluation.serialized}`)
}

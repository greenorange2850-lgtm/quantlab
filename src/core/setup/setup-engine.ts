/**
 * QuantLab Setup Engine v1.
 *
 * Transforms independent detector events into complete trading setups.
 * Never detects structure — only evaluates whether a valid setup exists.
 */

import { analyzeDowTheory, emptyDowTheoryLayer } from '@/core/smc/dow-theory'
import type { SmcDowTheoryLayer } from '@/core/smc/dow-theory/types'
import type { SmcZoneProjection } from '@/core/smc/lifecycle/types'
import type { QmlPattern } from '@/core/smc/qml/qml-types'
import type {
  SmcBosEvent,
  SmcChochEvent,
  SmcDetectionResult,
  SmcFvgEvent,
  SmcOrderBlockEvent,
} from '@/core/smc/types'
import {
  checkBos,
  checkChoch,
  checkConflictFlag,
  checkDisplacement,
  checkDowTheory,
  checkFreshness,
  checkFvg,
  checkLiquidity,
  checkOb,
  checkQml,
  checkRetest,
  checkStructure,
  checkSweep,
  checkTrend,
  checkZoneLifecycle,
  findZoneForSource,
  latestCreatedFvg,
  latestCreatedOb,
  latestDisplacement,
  latestOpposingSweep,
  missingFromChecks,
  rewindQmlPattern,
  type SetupCheckContext,
} from './setup-checks'
import { buildSetupDiagnostics } from './setup-diagnostics'
import { rankedSetupIds } from './setup-ranking'
import { scoreSetup } from './setup-scoring'
import { buildSetupSummary } from './setup-summary'
import {
  DEFAULT_SETUP_ENGINE_CONFIG,
  SETUP_ENGINE_VERSION,
  type EvaluateSetupsInput,
  type SetupConflict,
  type SetupDirection,
  type SetupEngineConfig,
  type SetupEngineResult,
  type SetupEntryZone,
  type SetupEventRef,
  type SetupStatus,
  type SetupStopReference,
  type SetupTargetCandidate,
  type SetupType,
  type TradingSetup,
} from './setup-types'

function resolveConfig(partial?: Partial<SetupEngineConfig> | null): SetupEngineConfig {
  return { ...DEFAULT_SETUP_ENGINE_CONFIG, ...partial }
}

function filterDetection(
  detection: SmcDetectionResult,
  visibleIndex: number,
): SmcDetectionResult {
  const byIndex = <T extends { candleIndex: number; confirmedAtIndex?: number }>(
    events: T[],
  ): T[] =>
    events.filter((e) => {
      if (typeof e.confirmedAtIndex === 'number') {
        return e.confirmedAtIndex <= visibleIndex
      }
      return e.candleIndex <= visibleIndex
    })

  return {
    ...detection,
    swings: byIndex(detection.swings),
    classifiedSwings: byIndex(detection.classifiedSwings),
    bosEvents: byIndex(detection.bosEvents),
    chochEvents: byIndex(detection.chochEvents),
    displacementEvents: byIndex(detection.displacementEvents),
    fvgEvents: byIndex(detection.fvgEvents),
    equalLevelEvents: byIndex(detection.equalLevelEvents),
    liquiditySweepEvents: byIndex(detection.liquiditySweepEvents),
    orderBlockEvents: byIndex(detection.orderBlockEvents),
  }
}

function resolveDow(
  detection: SmcDetectionResult,
  visibleIndex: number,
  provided?: SmcDowTheoryLayer | null,
): SmcDowTheoryLayer {
  if (provided) return provided
  if (detection.dowTheory && detection.dowTheory.visibleThroughIndex <= visibleIndex) {
    return detection.dowTheory
  }
  if (detection.classifiedSwings.length > 0) {
    return analyzeDowTheory(detection.classifiedSwings, visibleIndex)
  }
  return emptyDowTheoryLayer(visibleIndex)
}

function progressiveQmlPatterns(
  detection: SmcDetectionResult,
  visibleIndex: number,
  provided?: EvaluateSetupsInput['qml'],
): QmlPattern[] {
  const layer = provided ?? detection.qml
  if (!layer || !layer.enabled) return []
  return layer.patterns
    .map((p) => rewindQmlPattern(p, visibleIndex))
    .filter((p): p is QmlPattern => p != null)
}

function buildEntryFromObOrFvg(
  ob: SmcOrderBlockEvent | null,
  fvg: SmcFvgEvent | null,
  qml: QmlPattern | null,
): SetupEntryZone | null {
  if (qml) {
    return {
      low: Math.min(qml.zoneLow, qml.zoneHigh),
      high: Math.max(qml.zoneLow, qml.zoneHigh),
      sourceKind: 'QML',
      sourceId: qml.zoneId,
    }
  }
  if (ob) {
    return {
      low: Math.min(ob.zoneLow, ob.zoneHigh),
      high: Math.max(ob.zoneLow, ob.zoneHigh),
      sourceKind: 'ORDER_BLOCK',
      sourceId: ob.orderBlockId,
    }
  }
  if (fvg) {
    return {
      low: Math.min(fvg.lowerBoundary, fvg.upperBoundary),
      high: Math.max(fvg.lowerBoundary, fvg.upperBoundary),
      sourceKind: 'FVG',
      sourceId: fvg.fvgId,
    }
  }
  return null
}

function buildStop(
  direction: SetupDirection,
  entry: SetupEntryZone | null,
  brokenSwingPrice?: number | null,
): SetupStopReference | null {
  if (entry) {
    return {
      level: direction === 'BULLISH' ? entry.low : entry.high,
      reason:
        direction === 'BULLISH'
          ? 'Stop below entry zone low'
          : 'Stop above entry zone high',
      sourceId: entry.sourceId,
    }
  }
  if (brokenSwingPrice != null && Number.isFinite(brokenSwingPrice)) {
    return {
      level: brokenSwingPrice,
      reason: 'Stop at broken swing reference',
      sourceId: null,
    }
  }
  return null
}

function buildTargets(
  detection: SmcDetectionResult,
  direction: SetupDirection,
  visibleIndex: number,
  entry: SetupEntryZone | null,
): SetupTargetCandidate[] {
  const targets: SetupTargetCandidate[] = []
  const swings = detection.classifiedSwings.filter((s) => s.confirmedAtIndex <= visibleIndex)

  if (direction === 'BULLISH') {
    const highs = swings
      .filter((s) => s.kind.includes('HIGH'))
      .filter((s) => (entry ? s.price > entry.high : true))
      .slice(-3)
    for (const h of highs) {
      targets.push({
        level: h.price,
        label: `${h.classification} swing high`,
        sourceId: h.id,
      })
    }
  } else {
    const lows = swings
      .filter((s) => s.kind.includes('LOW'))
      .filter((s) => (entry ? s.price < entry.low : true))
      .slice(-3)
    for (const l of lows) {
      targets.push({
        level: l.price,
        label: `${l.classification} swing low`,
        sourceId: l.id,
      })
    }
  }

  const eqs = detection.equalLevelEvents.filter((e) => e.candleIndex <= visibleIndex)
  for (const eq of eqs.slice(-2)) {
    if (direction === 'BULLISH' && eq.kind === 'EQUAL_HIGHS') {
      targets.push({ level: eq.level, label: 'Equal highs liquidity', sourceId: eq.id })
    }
    if (direction === 'BEARISH' && eq.kind === 'EQUAL_LOWS') {
      targets.push({ level: eq.level, label: 'equal lows liquidity', sourceId: eq.id })
    }
  }

  // Dedup by rounded level
  const seen = new Set<string>()
  return targets.filter((t) => {
    const key = t.level.toFixed(6)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function deriveContinuationStatus(
  ctx: SetupCheckContext,
  config: SetupEngineConfig,
  zoneInvalid: boolean,
  opposingChoch: boolean,
): SetupStatus {
  if (zoneInvalid || opposingChoch) return 'INVALIDATED'
  if (!checkFreshness(ctx, true).passed) return 'EXPIRED'
  const retest = checkRetest(ctx, true).passed
  const hasZone = ctx.ob != null || ctx.fvg != null || ctx.zone != null
  if (retest && hasZone) return 'READY'
  if (hasZone && !retest) {
    return config.requireRetestForReady ? 'WAITING_RETEST' : 'READY'
  }
  return 'WATCHING'
}

function deriveReversalStatus(
  ctx: SetupCheckContext,
  config: SetupEngineConfig,
  zoneInvalid: boolean,
): SetupStatus {
  if (zoneInvalid) return 'INVALIDATED'
  if (!checkFreshness(ctx, true).passed) return 'EXPIRED'
  const retest = checkRetest(ctx, true).passed
  const hasZone = ctx.ob != null || ctx.fvg != null || ctx.zone != null
  if (retest && hasZone) return 'READY'
  if (hasZone) return config.requireRetestForReady ? 'WAITING_RETEST' : 'READY'
  return 'WATCHING'
}

function mapQmlStatus(status: QmlPattern['status']): SetupStatus {
  switch (status) {
    case 'ENTRY_READY':
      return 'READY'
    case 'RETESTED':
      return 'WAITING_RETEST'
    case 'ZONE_ACTIVE':
    case 'CONFIRMED':
      return 'WAITING_RETEST'
    case 'INVALIDATED':
      return 'INVALIDATED'
    case 'EXPIRED':
      return 'EXPIRED'
    case 'CANDIDATE':
    default:
      return 'WATCHING'
  }
}

function assembleSetup(input: {
  id: string
  setupType: SetupType
  direction: SetupDirection
  status: SetupStatus
  trendContext: string
  ctx: SetupCheckContext
  requiredChecks: ReturnType<typeof checkTrend>[]
  optionalChecks: ReturnType<typeof checkTrend>[]
  warnings: string[]
  reason: string
  createdIndex: number
  updatedIndex: number
  qmlStrength?: number | null
  brokenSwingPrice?: number | null
}): TradingSetup {
  const missingChecks = missingFromChecks(input.requiredChecks)
  const entryZone = buildEntryFromObOrFvg(
    input.ctx.ob ?? null,
    input.ctx.fvg ?? null,
    input.ctx.qml ?? null,
  )
  const stopReference = buildStop(input.direction, entryZone, input.brokenSwingPrice)
  const targetCandidates = buildTargets(
    input.ctx.detection,
    input.direction,
    input.ctx.visibleIndex,
    entryZone,
  )
  const strength = scoreSetup({
    setupType: input.setupType,
    requiredChecks: input.requiredChecks,
    optionalChecks: input.optionalChecks,
    warnings: input.warnings,
    qmlStrength: input.qmlStrength,
  })

  const eventChain: SetupEventRef[] = []
  const push = (id: string | null | undefined, kind: string, role: string) => {
    if (!id) return
    eventChain.push({ id, kind, role })
  }
  push(input.ctx.bos?.id, input.ctx.bos?.kind ?? 'BOS', 'bos')
  push(input.ctx.choch?.id, input.ctx.choch?.kind ?? 'CHOCH', 'choch')
  push(input.ctx.sweep?.id, input.ctx.sweep?.kind ?? 'SWEEP', 'sweep')
  push(input.ctx.displacement?.id, input.ctx.displacement?.kind ?? 'DISPLACEMENT', 'displacement')
  push(input.ctx.fvg?.id, input.ctx.fvg?.kind ?? 'FVG', 'fvg')
  push(input.ctx.ob?.id, input.ctx.ob?.kind ?? 'OB', 'order-block')
  push(input.ctx.qml?.id, 'QML', 'qml')
  push(input.ctx.zone?.zoneId, input.ctx.zone?.zoneKind ?? 'ZONE', 'entry-zone')

  const riskNotes: string[] = []
  if (!entryZone) riskNotes.push('No entry zone — do not execute')
  if (!stopReference) riskNotes.push('No stop reference')
  if (missingChecks.length) riskNotes.push(`Missing: ${missingChecks.join(', ')}`)
  if (input.status !== 'READY') riskNotes.push(`Status ${input.status} — not an execution signal`)
  riskNotes.push('Setup Engine never places orders')

  return {
    id: input.id,
    setupType: input.setupType,
    direction: input.direction,
    status: input.status,
    strength,
    trendContext: input.trendContext,
    entryZone,
    stopReference,
    targetCandidates,
    requiredChecks: input.requiredChecks,
    optionalChecks: input.optionalChecks,
    missingChecks,
    eventChain,
    warnings: input.warnings,
    reason: input.reason,
    createdIndex: input.createdIndex,
    updatedIndex: input.updatedIndex,
    riskNotes,
    suggestedTarget: targetCandidates[0]?.level ?? null,
    conflictIds: [],
  }
}

function buildContinuationSetup(
  direction: SetupDirection,
  bos: SmcBosEvent,
  detection: SmcDetectionResult,
  dowTheory: SmcDowTheoryLayer,
  visibleIndex: number,
  config: SetupEngineConfig,
  zones: readonly SmcZoneProjection[],
): TradingSetup | null {
  const age = visibleIndex - bos.candleIndex
  if (age > config.setupMaxAgeCandles) return null

  const ob = latestCreatedOb(detection.orderBlockEvents, direction, bos.candleIndex, visibleIndex)
  const fvg = latestCreatedFvg(detection.fvgEvents, direction, bos.candleIndex, visibleIndex)
  const displacement = latestDisplacement(
    detection.displacementEvents,
    direction,
    bos.candleIndex,
    visibleIndex,
  )
  const sweep = latestOpposingSweep(
    detection.liquiditySweepEvents,
    direction,
    bos.candleIndex,
    visibleIndex,
  )
  const zone = findZoneForSource(zones, [
    ob?.orderBlockId ?? '',
    fvg?.fvgId ?? '',
    ob?.id ?? '',
    fvg?.id ?? '',
  ].filter(Boolean))

  const ctx: SetupCheckContext = {
    detection,
    dowTheory,
    visibleIndex,
    direction,
    config,
    lifecycleZones: zones,
    anchorIndex: bos.candleIndex,
    bos,
    choch: null,
    sweep,
    displacement,
    fvg,
    ob,
    qml: null,
    zone,
  }

  const opposingChoch = detection.chochEvents.some(
    (c) =>
      c.candleIndex > bos.candleIndex &&
      c.candleIndex <= visibleIndex &&
      ((direction === 'BULLISH' && c.kind === 'BEARISH_CHOCH') ||
        (direction === 'BEARISH' && c.kind === 'BULLISH_CHOCH')),
  )
  const zoneInvalid =
    (ob?.invalidationStatus ?? false) ||
    ob?.mitigationStatus === 'INVALIDATED' ||
    ob?.mitigationStatus === 'MITIGATED' ||
    fvg?.state === 'INVALIDATED' ||
    fvg?.state === 'FULLY_FILLED' ||
    zone?.state === 'INVALIDATED' ||
    zone?.state === 'MITIGATED' ||
    zone?.state === 'FILLED' ||
    zone?.state === 'EXPIRED'

  const required = [
    checkTrend(ctx, true),
    checkDowTheory(ctx, true),
    checkStructure(ctx, true),
    checkBos(ctx, true),
    checkOb(ctx, false), // at least one of OB/FVG required via composite below
    checkFvg(ctx, false),
    checkZoneLifecycle(ctx, Boolean(zone)),
    checkFreshness(ctx, true),
    checkConflictFlag(false, '', true),
  ]

  // Require OB or FVG
  const hasEntry = checkOb(ctx, true).passed || checkFvg(ctx, true).passed
  if (!hasEntry && !zoneInvalid) {
    required.push({
      name: 'OB',
      passed: false,
      required: true,
      reason: 'Continuation requires OB or FVG entry zone',
      sourceIds: [],
    })
  } else if (hasEntry) {
    // Mark the passed one as required-passed for missingChecks clarity
    const entryCheck = checkOb(ctx, true).passed ? checkOb(ctx, true) : checkFvg(ctx, true)
    const idx = required.findIndex((c) => c.name === entryCheck.name)
    if (idx >= 0) required[idx] = { ...entryCheck, required: true }
  }

  if (config.requireRetestForReady) {
    // Retest is required for READY but not for emitting the setup
  }

  const optional = [
    checkSweep(ctx, false),
    checkDisplacement(ctx, false),
    checkLiquidity(ctx, false),
    checkRetest(ctx, false),
    checkChoch(ctx, false),
  ]

  const warnings: string[] = []
  if (opposingChoch) warnings.push('Opposing CHoCH after continuation BOS')
  if (zoneInvalid) warnings.push('Entry zone invalidated or mitigated')
  if (dowTheory.trend === 'Range') warnings.push('Dow trend is Range')

  const status = deriveContinuationStatus(ctx, config, Boolean(zoneInvalid), opposingChoch)
  const setupType: SetupType =
    direction === 'BULLISH' ? 'BULLISH_CONTINUATION' : 'BEARISH_CONTINUATION'

  // Drop weak watching setups with no entry at all
  if (!hasEntry && status === 'WATCHING') return null

  return assembleSetup({
    id: `setup-cont-${direction === 'BULLISH' ? 'bull' : 'bear'}-${bos.id}`,
    setupType,
    direction,
    status,
    trendContext: `${dowTheory.trend} / ${dowTheory.structurePhase}`,
    ctx,
    requiredChecks: required,
    optionalChecks: optional,
    warnings,
    reason: `${setupType}: ${bos.kind} with ${hasEntry ? 'entry zone' : 'no entry yet'}; status ${status}`,
    createdIndex: bos.candleIndex,
    updatedIndex: Math.max(
      bos.candleIndex,
      zone?.firstTouchIndex ?? bos.candleIndex,
      ob?.candleIndex ?? bos.candleIndex,
      fvg?.candleIndex ?? bos.candleIndex,
    ),
    brokenSwingPrice: bos.brokenSwingPrice,
  })
}

function buildReversalSetup(
  direction: SetupDirection,
  choch: SmcChochEvent,
  detection: SmcDetectionResult,
  dowTheory: SmcDowTheoryLayer,
  visibleIndex: number,
  config: SetupEngineConfig,
  zones: readonly SmcZoneProjection[],
): TradingSetup | null {
  const age = visibleIndex - choch.candleIndex
  if (age > config.setupMaxAgeCandles) return null

  const ob = latestCreatedOb(
    detection.orderBlockEvents,
    direction,
    choch.candleIndex,
    visibleIndex,
  )
  const fvg = latestCreatedFvg(
    detection.fvgEvents,
    direction,
    choch.candleIndex,
    visibleIndex,
  )
  const displacement = latestDisplacement(
    detection.displacementEvents,
    direction,
    choch.candleIndex,
    visibleIndex,
  )
  const sweep = latestOpposingSweep(
    detection.liquiditySweepEvents,
    direction,
    choch.candleIndex,
    visibleIndex,
  )
  const zone = findZoneForSource(zones, [
    ob?.orderBlockId ?? '',
    fvg?.fvgId ?? '',
    ob?.id ?? '',
    fvg?.id ?? '',
  ].filter(Boolean))

  const ctx: SetupCheckContext = {
    detection,
    dowTheory,
    visibleIndex,
    direction,
    config,
    lifecycleZones: zones,
    anchorIndex: choch.candleIndex,
    bos: null,
    choch,
    sweep,
    displacement,
    fvg,
    ob,
    qml: null,
    zone,
  }

  const zoneInvalid =
    (ob?.invalidationStatus ?? false) ||
    ob?.mitigationStatus === 'INVALIDATED' ||
    ob?.mitigationStatus === 'MITIGATED' ||
    fvg?.state === 'INVALIDATED' ||
    fvg?.state === 'FULLY_FILLED' ||
    zone?.state === 'INVALIDATED' ||
    zone?.state === 'MITIGATED' ||
    zone?.state === 'FILLED'

  const required = [
    checkChoch(ctx, true),
    checkStructure(ctx, true),
    checkDowTheory(ctx, false),
    checkFreshness(ctx, true),
    checkConflictFlag(false, '', true),
  ]

  const hasEntry = checkOb(ctx, true).passed || checkFvg(ctx, true).passed
  if (hasEntry) {
    required.push(checkOb(ctx, true).passed ? checkOb(ctx, true) : checkFvg(ctx, true))
    if (zone) required.push(checkZoneLifecycle(ctx, true))
  } else {
    required.push({
      name: 'OB',
      passed: false,
      required: true,
      reason: 'Reversal prefers OB or FVG after CHoCH',
      sourceIds: [],
    })
  }

  // Trend check: reversal often against prior trend — optional / soft
  const optional = [
    checkTrend(ctx, false),
    checkSweep(ctx, false),
    checkDisplacement(ctx, false),
    checkLiquidity(ctx, false),
    checkRetest(ctx, false),
    checkBos(ctx, false),
  ]

  const warnings: string[] = []
  if (zoneInvalid) warnings.push('Entry zone invalidated or mitigated')
  if (!sweep) warnings.push('No opposing liquidity sweep before CHoCH')

  const status = deriveReversalStatus(ctx, config, Boolean(zoneInvalid))
  const setupType: SetupType =
    direction === 'BULLISH' ? 'BULLISH_REVERSAL' : 'BEARISH_REVERSAL'

  if (!hasEntry && status === 'WATCHING') {
    // Still emit watching reversal so UI can show missing conditions
  }

  return assembleSetup({
    id: `setup-rev-${direction === 'BULLISH' ? 'bull' : 'bear'}-${choch.id}`,
    setupType,
    direction,
    status,
    trendContext: `${dowTheory.trend} / prior ${choch.previousStructureState}`,
    ctx,
    requiredChecks: required,
    optionalChecks: optional,
    warnings,
    reason: `${setupType}: ${choch.kind} shift; status ${status}`,
    createdIndex: choch.candleIndex,
    updatedIndex: Math.max(
      choch.candleIndex,
      zone?.firstTouchIndex ?? choch.candleIndex,
      ob?.candleIndex ?? choch.candleIndex,
      fvg?.candleIndex ?? choch.candleIndex,
    ),
    brokenSwingPrice: choch.brokenSwingPrice,
  })
}

function buildQmlSetup(
  pattern: QmlPattern,
  detection: SmcDetectionResult,
  dowTheory: SmcDowTheoryLayer,
  visibleIndex: number,
  config: SetupEngineConfig,
  zones: readonly SmcZoneProjection[],
): TradingSetup {
  const direction = pattern.direction
  const zone =
    findZoneForSource(zones, [pattern.zoneId, pattern.id]) ??
    ({
      zoneId: pattern.zoneId,
      zoneKind: 'QML',
      direction,
      sourceEventId: pattern.id,
      startIndex: pattern.createdIndex,
      endIndex: pattern.zoneEndIndex,
      low: pattern.zoneLow,
      high: pattern.zoneHigh,
      state:
        pattern.status === 'RETESTED' || pattern.status === 'ENTRY_READY'
          ? 'TOUCHED'
          : pattern.status === 'INVALIDATED'
            ? 'INVALIDATED'
            : pattern.status === 'EXPIRED'
              ? 'EXPIRED'
              : 'ACTIVE',
      activeAtVisibleIndex:
        pattern.status !== 'INVALIDATED' && pattern.status !== 'EXPIRED',
      setupRefs: [pattern.id],
      lifecycleReason: `QML ${pattern.status}`,
      shortLabel: 'QML',
      fullLabel: `${direction} QML`,
      visibilityReason: 'setup',
      extendsToVisibleEdge: true,
      firstTouchIndex: pattern.retestIndex,
    } satisfies SmcZoneProjection)

  // Link OB/FVG from confirmation refs when present
  const ob =
    detection.orderBlockEvents.find(
      (e) =>
        e.orderBlockId === pattern.confirmationRefs.orderBlockId ||
        e.id === pattern.confirmationRefs.orderBlockId,
    ) ?? null
  const fvg =
    detection.fvgEvents.find(
      (e) =>
        e.fvgId === pattern.confirmationRefs.fvgEventId ||
        e.id === pattern.confirmationRefs.fvgEventId,
    ) ?? null
  const displacement =
    detection.displacementEvents.find(
      (e) => e.id === pattern.confirmationRefs.displacementEventId,
    ) ?? null
  const sweep =
    detection.liquiditySweepEvents.find(
      (e) => e.id === pattern.confirmationRefs.sweepEventId,
    ) ?? null
  const choch =
    detection.chochEvents.find((e) => e.id === pattern.structureShiftEventId) ?? null

  const ctx: SetupCheckContext = {
    detection,
    dowTheory,
    visibleIndex,
    direction,
    config,
    lifecycleZones: zones,
    anchorIndex: pattern.createdIndex,
    bos: null,
    choch,
    sweep,
    displacement,
    fvg,
    ob,
    qml: pattern,
    zone,
  }

  const required = [
    checkQml(ctx, true),
    checkChoch(ctx, pattern.status !== 'CANDIDATE'),
    checkZoneLifecycle(ctx, pattern.status !== 'CANDIDATE'),
    checkFreshness(ctx, true),
    checkConflictFlag(false, '', true),
  ]
  const optional = [
    checkTrend(ctx, false),
    checkDowTheory(ctx, false),
    checkSweep(ctx, false),
    checkDisplacement(ctx, false),
    checkOb(ctx, false),
    checkFvg(ctx, false),
    checkRetest(ctx, false),
    checkLiquidity(ctx, false),
    checkStructure(ctx, false),
  ]

  const warnings = [...pattern.missingChecks.map((m) => `QML missing: ${m}`)]
  if (pattern.experimental) warnings.push('QML module is experimental')

  const status = mapQmlStatus(pattern.status)
  const setupType: SetupType = direction === 'BULLISH' ? 'BULLISH_QML' : 'BEARISH_QML'

  return assembleSetup({
    id: `setup-qml-${direction === 'BULLISH' ? 'bull' : 'bear'}-${pattern.id}`,
    setupType,
    direction,
    status,
    trendContext: `${pattern.priorTrend} (QML strength ${pattern.setupStrength})`,
    ctx,
    requiredChecks: required,
    optionalChecks: optional,
    warnings,
    reason:
      pattern.explanation[0] ??
      `${setupType}: QML ${pattern.status} → setup ${status}`,
    createdIndex: pattern.createdIndex,
    updatedIndex: Math.max(
      pattern.createdIndex,
      pattern.entryReadyIndex ?? 0,
      pattern.retestIndex ?? 0,
      pattern.invalidatedIndex ?? 0,
      pattern.expiredIndex ?? 0,
    ),
    qmlStrength: pattern.setupStrength,
    brokenSwingPrice: direction === 'BULLISH' ? pattern.zoneLow : pattern.zoneHigh,
  })
}

function detectConflicts(
  setups: TradingSetup[],
  dowTheory: SmcDowTheoryLayer,
): SetupConflict[] {
  const conflicts: SetupConflict[] = []
  const readyBull = setups.filter((s) => s.direction === 'BULLISH' && s.status === 'READY')
  const readyBear = setups.filter((s) => s.direction === 'BEARISH' && s.status === 'READY')

  if (readyBull.length > 0 && readyBear.length > 0) {
    const ids = [...readyBull, ...readyBear].map((s) => s.id)
    conflicts.push({
      id: 'conflict-bull-bear-ready',
      kind: 'BULL_AND_BEAR',
      reason: 'Bullish and bearish READY setups simultaneously',
      setupIds: ids,
      sourceIds: [],
    })
  }

  for (const s of setups) {
    if (s.status !== 'READY' && s.status !== 'WAITING_RETEST') continue
    const trendConflict =
      (s.direction === 'BULLISH' && dowTheory.trend === 'Bearish') ||
      (s.direction === 'BEARISH' && dowTheory.trend === 'Bullish')
    if (trendConflict && !s.setupType.includes('REVERSAL') && !s.setupType.includes('QML')) {
      conflicts.push({
        id: `conflict-trend-${s.id}`,
        kind: 'TREND_MISMATCH',
        reason: `${s.setupType} ${s.direction} vs Dow ${dowTheory.trend}`,
        setupIds: [s.id],
        sourceIds: [],
      })
    }

    if (s.entryZone?.sourceKind === 'ORDER_BLOCK') {
      const invalidOb = s.warnings.some((w) => w.toLowerCase().includes('invalid'))
      if (invalidOb) {
        conflicts.push({
          id: `conflict-ob-${s.id}`,
          kind: 'INVALID_OB',
          reason: 'Setup references an invalid Order Block',
          setupIds: [s.id],
          sourceIds: [s.entryZone.sourceId],
        })
      }
    }
    if (s.entryZone?.sourceKind === 'FVG') {
      const mitigated = s.warnings.some((w) => w.toLowerCase().includes('mitigat'))
      if (mitigated) {
        conflicts.push({
          id: `conflict-fvg-${s.id}`,
          kind: 'MITIGATED_FVG',
          reason: 'Setup references a mitigated / filled FVG',
          setupIds: [s.id],
          sourceIds: [s.entryZone.sourceId],
        })
      }
    }
  }

  for (const s of setups) {
    if (s.status !== 'EXPIRED') continue
    conflicts.push({
      id: `conflict-expired-${s.id}`,
      kind: 'EXPIRED_ZONE',
      reason: 'Setup expired / zone too old',
      setupIds: [s.id],
      sourceIds: s.entryZone ? [s.entryZone.sourceId] : [],
    })
  }

  // Annotate setups with conflict ids
  for (const c of conflicts) {
    for (const sid of c.setupIds) {
      const setup = setups.find((s) => s.id === sid)
      if (setup && !setup.conflictIds.includes(c.id)) {
        setup.conflictIds.push(c.id)
        setup.warnings.push(c.reason)
        // Refresh conflict check
        const conflictCheck = setup.requiredChecks.find((x) => x.name === 'Conflict')
        if (conflictCheck) {
          conflictCheck.passed = false
          conflictCheck.reason = c.reason
        }
      }
    }
  }

  return conflicts
}

/**
 * Evaluate whether valid trading setups currently exist.
 * Pure / deterministic. No look-ahead beyond visibleIndex.
 */
export function evaluateSetups(input: EvaluateSetupsInput): SetupEngineResult {
  const started = performance.now()
  const config = resolveConfig(input.config)
  const visibleIndex = Math.max(
    -1,
    Math.min(input.visibleIndex, input.candles.length - 1),
  )

  if (visibleIndex < 0 || input.candles.length === 0) {
    const diagnostics = buildSetupDiagnostics([], [], performance.now() - started)
    return {
      version: SETUP_ENGINE_VERSION,
      visibleIndex,
      setups: [],
      rankedSetupIds: [],
      summary: buildSetupSummary([], []),
      diagnostics,
      conflicts: [],
      qmlPatterns: [],
      durationMs: diagnostics.durationMs,
    }
  }

  const detection = filterDetection(input.detection, visibleIndex)
  const dowTheory = resolveDow(detection, visibleIndex, input.dowTheory)
  const zones = (input.lifecycleZones ?? []).filter((z) => z.startIndex <= visibleIndex)
  const qmlPatterns = progressiveQmlPatterns(detection, visibleIndex, input.qml)

  const setups: TradingSetup[] = []

  if (config.enableContinuation) {
    const bullBos = detection.bosEvents.filter((e) => e.kind === 'BULLISH_BOS')
    const bearBos = detection.bosEvents.filter((e) => e.kind === 'BEARISH_BOS')
    // Prefer latest few structure breaks
    for (const bos of bullBos.slice(-3)) {
      const s = buildContinuationSetup(
        'BULLISH',
        bos,
        detection,
        dowTheory,
        visibleIndex,
        config,
        zones,
      )
      if (s) setups.push(s)
    }
    for (const bos of bearBos.slice(-3)) {
      const s = buildContinuationSetup(
        'BEARISH',
        bos,
        detection,
        dowTheory,
        visibleIndex,
        config,
        zones,
      )
      if (s) setups.push(s)
    }
  }

  if (config.enableReversal) {
    const bullChoch = detection.chochEvents.filter((e) => e.kind === 'BULLISH_CHOCH')
    const bearChoch = detection.chochEvents.filter((e) => e.kind === 'BEARISH_CHOCH')
    for (const c of bullChoch.slice(-3)) {
      const s = buildReversalSetup(
        'BULLISH',
        c,
        detection,
        dowTheory,
        visibleIndex,
        config,
        zones,
      )
      if (s) setups.push(s)
    }
    for (const c of bearChoch.slice(-3)) {
      const s = buildReversalSetup(
        'BEARISH',
        c,
        detection,
        dowTheory,
        visibleIndex,
        config,
        zones,
      )
      if (s) setups.push(s)
    }
  }

  if (config.enableQmlSetups) {
    for (const p of qmlPatterns) {
      if (p.status === 'CANDIDATE' && p.structureShiftEventId === '') {
        // Still emit watching QML candidates
      }
      setups.push(
        buildQmlSetup(p, detection, dowTheory, visibleIndex, config, zones),
      )
    }
  }

  const conflicts = detectConflicts(setups, dowTheory)
  const rankedIds = rankedSetupIds(setups)
  const summary = buildSetupSummary(setups, conflicts)
  const durationMs = performance.now() - started
  const diagnostics = buildSetupDiagnostics(setups, conflicts, durationMs)

  return {
    version: SETUP_ENGINE_VERSION,
    visibleIndex,
    setups,
    rankedSetupIds: rankedIds,
    summary,
    diagnostics,
    conflicts,
    qmlPatterns,
    durationMs,
  }
}

export function emptySetupEngineResult(
  visibleIndex = -1,
): SetupEngineResult {
  return {
    version: SETUP_ENGINE_VERSION,
    visibleIndex,
    setups: [],
    rankedSetupIds: [],
    summary: buildSetupSummary([], []),
    diagnostics: emptySetupDiagnosticsPlaceholder(),
    conflicts: [],
    qmlPatterns: [],
    durationMs: 0,
  }
}

function emptySetupDiagnosticsPlaceholder() {
  return buildSetupDiagnostics([], [], 0)
}

/** Map a TradingSetup to chart focus context. */
export function toSetupVisualContext(setup: TradingSetup): {
  setupId: string
  direction: 'BULLISH' | 'BEARISH'
  status: 'WATCHING' | 'WAITING_RETEST' | 'RETESTED' | 'READY' | 'INVALIDATED' | 'COMPLETED' | 'EXPIRED'
  eventIds: string[]
  zoneIds: string[]
  entryZone?: { low: number; high: number }
  stopLevel?: number
  targetLevels?: number[]
} {
  const status =
    setup.status === 'WAITING_RETEST'
      ? 'WAITING_RETEST'
      : setup.status === 'READY'
        ? 'READY'
        : setup.status === 'INVALIDATED'
          ? 'INVALIDATED'
          : setup.status === 'EXPIRED'
            ? 'EXPIRED'
            : setup.status === 'COMPLETED'
              ? 'COMPLETED'
              : 'WATCHING'

  return {
    setupId: setup.id,
    direction: setup.direction,
    status,
    eventIds: setup.eventChain.map((e) => e.id),
    zoneIds: [
      setup.entryZone?.sourceId,
      ...setup.eventChain.filter((e) => e.role === 'entry-zone').map((e) => e.id),
    ].filter((id): id is string => Boolean(id)),
    entryZone: setup.entryZone
      ? { low: setup.entryZone.low, high: setup.entryZone.high }
      : undefined,
    stopLevel: setup.stopReference?.level,
    targetLevels: setup.targetCandidates.map((t) => t.level).slice(0, 3),
  }
}

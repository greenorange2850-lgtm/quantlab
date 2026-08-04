import type { Candle } from '@/data/candles'
import type { SmcDowTheoryLayer } from '../dow-theory/types'
import type {
  SmcBosEvent,
  SmcChochEvent,
  SmcClassifiedSwingEvent,
  SmcDisplacementEvent,
  SmcFvgEvent,
  SmcLiquiditySweepEvent,
  SmcOrderBlockEvent,
  SmcSwingEvent,
} from '../types'
import type { QmlConfig } from './qml-config'
import { DEFAULT_QML_CONFIG, resolveQmlConfig } from './qml-config'
import { buildQmlDiagnostics } from './qml-diagnostics'
import { auditQmlInvariants, emptyQmlInvariantCounts } from './qml-invariants'
import { advanceQmlLifecycle } from './qml-lifecycle'
import { scoreQmlPattern } from './qml-scoring'
import { selectQmlSource } from './qml-source-selector'
import {
  SMC_QML_VERSION,
  type QmlDirection,
  type QmlPattern,
  type SmcQmlLayer,
} from './qml-types'

export interface DetectQmlInput {
  candles: readonly Candle[]
  visibleIndex: number
  config?: Partial<QmlConfig> | QmlConfig | null
  dowTheory: SmcDowTheoryLayer
  swings: readonly SmcSwingEvent[]
  classifiedSwings: readonly SmcClassifiedSwingEvent[]
  chochEvents: readonly SmcChochEvent[]
  bosEvents: readonly SmcBosEvent[]
  displacementEvents: readonly SmcDisplacementEvent[]
  fvgEvents: readonly SmcFvgEvent[]
  liquiditySweepEvents: readonly SmcLiquiditySweepEvent[]
  orderBlockEvents: readonly SmcOrderBlockEvent[]
}

export function emptyQmlLayer(
  visibleThroughIndex = -1,
  status: SmcQmlLayer['status'] = 'DISABLED',
): SmcQmlLayer {
  return {
    version: SMC_QML_VERSION,
    experimental: true,
    enabled: false,
    visibleThroughIndex,
    patterns: [],
    diagnostics: buildQmlDiagnostics([], [], 0),
    invariants: emptyQmlInvariantCounts(),
    invariantDetails: [],
    status,
    duplicateSuppression: [],
  }
}

/**
 * Detect QuantLab Quasimodo Level patterns.
 * Pure / deterministic. Does not mutate detector arrays.
 * Only uses events knowable by visibleIndex (no look-ahead).
 */
export function detectQmlPatterns(input: DetectQmlInput): SmcQmlLayer {
  const started = performance.now()
  const config = resolveQmlConfig(input.config ?? DEFAULT_QML_CONFIG)
  const visibleIndex = Math.max(-1, Math.min(input.visibleIndex, input.candles.length - 1))

  if (!config.enabled) {
    return emptyQmlLayer(visibleIndex, 'DISABLED')
  }
  if (visibleIndex < 0 || input.candles.length === 0) {
    return emptyQmlLayer(visibleIndex, 'SKIPPED')
  }

  const rejectionCounts = new Map<string, number>()
  const reject = (reason: string) => {
    rejectionCounts.set(reason, (rejectionCounts.get(reason) ?? 0) + 1)
  }

  const knowableChoch = input.chochEvents.filter((c) => c.candleIndex <= visibleIndex)
  const swingsById = indexSwings(input.swings, input.classifiedSwings)
  const patterns: QmlPattern[] = []
  const duplicateSuppression: SmcQmlLayer['duplicateSuppression'] = []
  const seenCanonical = new Map<string, string>()

  // Candidates from prior trend + extreme without CHoCH yet
  for (const candidate of buildTrendCandidates(
    input.dowTheory,
    input.classifiedSwings,
    swingsById,
    visibleIndex,
    config,
    reject,
  )) {
    const hasChoch = knowableChoch.some(
      (c) =>
        c.candleIndex > candidate.extreme.candleIndex &&
        ((candidate.direction === 'BULLISH' && c.kind === 'BULLISH_CHOCH') ||
          (candidate.direction === 'BEARISH' && c.kind === 'BEARISH_CHOCH')),
    )
    if (!hasChoch) {
      const id = `qml-cand-${candidate.direction === 'BULLISH' ? 'bull' : 'bear'}-${candidate.extreme.id}`
      const canonicalKey = [
        candidate.direction,
        candidate.source.id,
        candidate.extreme.id,
        'pending',
      ].join('|')
      if (seenCanonical.has(canonicalKey)) {
        duplicateSuppression.push({
          canonicalKey,
          keptId: seenCanonical.get(canonicalKey)!,
          suppressedId: id,
          reason: 'Duplicate candidate for same source/extreme without CHoCH',
        })
        continue
      }
      seenCanonical.set(canonicalKey, id)
      patterns.push({
        id,
        direction: candidate.direction,
        status: 'CANDIDATE',
        priorTrend: candidate.priorTrend,
        trendStrength: candidate.trendStrength,
        sourceSwingId: candidate.source.id,
        extremeSwingId: candidate.extreme.id,
        structureShiftEventId: '',
        zoneId: `qml-zone-${id}`,
        zoneLow: candidate.source.price,
        zoneHigh: candidate.source.price,
        zoneMode: config.zoneMode,
        createdIndex: candidate.extreme.confirmedAtIndex,
        confirmationRefs: {},
        requiredChecks: [],
        optionalChecks: [],
        missingChecks: ['Opposing CHoCH / structure shift'],
        eventChain: [
          `priorTrend:${candidate.priorTrend}`,
          `extreme:${candidate.extreme.id}`,
        ],
        explanation: [
          `${candidate.direction} QML CANDIDATE: prior ${candidate.priorTrend} trend (strength ${candidate.trendStrength}) with extreme ${candidate.extreme.id}.`,
          'Awaiting opposing CHoCH / structure shift.',
        ],
        canonicalKey,
        sourceSelection: {
          method: 'STRUCTURE_LEVEL_FALLBACK',
          sourceSwingId: candidate.source.id,
          sourceCandleIndex: candidate.source.candleIndex,
          sourceCandleTime: candidate.source.timestamp,
          linkedOrderBlockId: null,
          explanation: ['Candidate — source not finalized until CHoCH.'],
        },
        setupStrength: Math.max(0, Math.min(100, Math.round(candidate.trendStrength * 0.4))),
        scoreBreakdown: { total: 0, factors: [] },
        structureScope: candidate.structureScope,
        experimental: config.experimental,
        confirmationMode: config.confirmationMode,
        invalidationMode: config.invalidationMode,
        zoneEndIndex: candidate.extreme.confirmedAtIndex,
      })
    }
  }

  // Confirmed patterns from CHoCH
  for (const choch of knowableChoch) {
    const direction: QmlDirection =
      choch.kind === 'BULLISH_CHOCH' ? 'BULLISH' : 'BEARISH'

    if (!scopeAllows(choch.brokenSwingClassification, config.structureScope)) {
      reject('structure-scope-mismatch')
      continue
    }

    const broken = resolveSwing(swingsById, choch.brokenSwingId, choch)
    if (!broken) {
      reject('missing-broken-swing')
      continue
    }

    const extreme = findExtremeSwing(
      direction,
      input.classifiedSwings,
      swingsById,
      broken,
      choch,
      visibleIndex,
      config,
    )
    if (!extreme) {
      reject('no-structural-extreme')
      continue
    }

    const prior = inferPriorTrend(
      direction,
      input.dowTheory,
      broken,
      extreme,
      visibleIndex,
      config,
    )
    if (!prior.ok) {
      reject(prior.reason)
      continue
    }

    // Source must be before extreme and before CHoCH
    if (broken.candleIndex >= extreme.candleIndex) {
      reject('source-after-extreme')
      continue
    }
    if (extreme.candleIndex >= choch.candleIndex) {
      reject('extreme-after-choch')
      continue
    }
    if (broken.candleIndex >= choch.candleIndex) {
      reject('source-candle-after-break')
      continue
    }

    const canonicalKey = [direction, broken.id, extreme.id, choch.id].join('|')
    if (seenCanonical.has(canonicalKey)) {
      const suppressedId = `qml-${direction === 'BULLISH' ? 'bull' : 'bear'}-${choch.candleIndex}-${broken.id}`
      duplicateSuppression.push({
        canonicalKey,
        keptId: seenCanonical.get(canonicalKey)!,
        suppressedId,
        reason: 'Duplicate canonical QML (direction+source+extreme+CHoCH)',
      })
      reject('duplicate-canonical')
      continue
    }

    const dowMeta = input.dowTheory.bySwingId[broken.id] ?? null
    const geometry = selectQmlSource({
      direction,
      sourceSwing: broken,
      extremeSwing: extreme,
      choch,
      candles: input.candles,
      visibleIndex,
      dowMeta,
      orderBlocks: input.orderBlockEvents,
      config,
    })

    if (
      geometry.sourceCandleIndex != null &&
      geometry.sourceCandleIndex >= choch.candleIndex
    ) {
      reject('source-candle-after-break')
      continue
    }

    const id = `qml-${direction === 'BULLISH' ? 'bull' : 'bear'}-${choch.candleIndex}-${broken.id}`
    seenCanonical.set(canonicalKey, id)

    // Remove matching CANDIDATE for same source/extreme
    const candKeyPrefix = `${direction}|${broken.id}|${extreme.id}|`
    for (let i = patterns.length - 1; i >= 0; i -= 1) {
      const p = patterns[i]!
      if (p.status === 'CANDIDATE' && p.canonicalKey.startsWith(candKeyPrefix)) {
        patterns.splice(i, 1)
      }
    }

    let pattern: QmlPattern = {
      id,
      direction,
      status: 'CONFIRMED',
      priorTrend: prior.priorTrend,
      trendStrength: prior.trendStrength,
      sourceSwingId: broken.id,
      extremeSwingId: extreme.id,
      structureShiftEventId: choch.id,
      sourceCandleIndex: geometry.sourceCandleIndex ?? undefined,
      sourceCandleTime: geometry.sourceCandleTime ?? undefined,
      zoneId: `qml-zone-${id}`,
      zoneLow: geometry.zoneLow,
      zoneHigh: geometry.zoneHigh,
      zoneMode: geometry.zoneMode,
      createdIndex: choch.candleIndex,
      confirmedIndex: choch.candleIndex,
      confirmationRefs: {},
      requiredChecks: [],
      optionalChecks: [],
      missingChecks: [],
      eventChain: [
        `priorTrend:${prior.priorTrend}`,
        `source:${broken.id}`,
        `extreme:${extreme.id}`,
        `choch:${choch.id}`,
        `status:CONFIRMED@${choch.candleIndex}`,
      ],
      explanation: [
        `${direction} QML CONFIRMED at CHoCH ${choch.id} (candle ${choch.candleIndex}).`,
        `Prior Dow context: ${prior.priorTrend} (strength ${prior.trendStrength}).`,
        `Source swing ${broken.id} → extreme ${extreme.id} → CHoCH break.`,
        ...geometry.selection.explanation,
      ],
      canonicalKey,
      sourceSelection: {
        ...geometry.selection,
        sourceSwingId: broken.id,
      },
      setupStrength: 0,
      scoreBreakdown: { total: 0, factors: [] },
      structureScope:
        choch.brokenSwingClassification === 'EXTERNAL' ? 'EXTERNAL' : 'INTERNAL',
      experimental: config.experimental,
      confirmationMode: config.confirmationMode,
      invalidationMode: config.invalidationMode,
      zoneEndIndex: choch.candleIndex,
    }

    pattern = advanceQmlLifecycle(pattern, {
      candles: input.candles,
      visibleIndex,
      config,
      bosEvents: input.bosEvents,
      displacementEvents: input.displacementEvents,
      fvgEvents: input.fvgEvents,
      liquiditySweepEvents: input.liquiditySweepEvents,
      orderBlockEvents: input.orderBlockEvents,
    })

    const hasDisplacement = input.displacementEvents.some(
      (d) =>
        d.candleIndex >= pattern.createdIndex - 2 &&
        d.candleIndex <= visibleIndex &&
        ((direction === 'BULLISH' && d.kind === 'BULLISH_DISPLACEMENT') ||
          (direction === 'BEARISH' && d.kind === 'BEARISH_DISPLACEMENT')),
    )
    const hasSweep = Boolean(pattern.confirmationRefs.sweepEventId) ||
      input.liquiditySweepEvents.some(
        (s) =>
          s.candleIndex <= pattern.createdIndex &&
          ((direction === 'BULLISH' && s.kind === 'SELL_SIDE_LIQUIDITY_SWEEP') ||
            (direction === 'BEARISH' && s.kind === 'BUY_SIDE_LIQUIDITY_SWEEP')),
      )
    const hasFvg = Boolean(pattern.confirmationRefs.fvgEventId)
    const hasOb = Boolean(pattern.confirmationRefs.orderBlockId)
    const conflicting = input.bosEvents.some(
      (b) =>
        b.candleIndex > pattern.createdIndex &&
        b.candleIndex <= visibleIndex &&
        b.brokenSwingClassification === 'EXTERNAL' &&
        ((direction === 'BULLISH' && b.kind === 'BEARISH_BOS') ||
          (direction === 'BEARISH' && b.kind === 'BULLISH_BOS')),
    )

    const score = scoreQmlPattern(pattern, {
      hasStrongDisplacement: hasDisplacement,
      hasLiquiditySweep: hasSweep,
      hasFvgOverlap: hasFvg,
      hasObOverlap: hasOb,
      conflictingExternalStructure: conflicting,
      visibleIndex,
      config,
    })
    pattern = {
      ...pattern,
      setupStrength: score.total,
      scoreBreakdown: score,
    }

    patterns.push(pattern)
  }

  // Sort: strongest first, then by created index
  patterns.sort(
    (a, b) =>
      b.setupStrength - a.setupStrength ||
      a.createdIndex - b.createdIndex ||
      a.id.localeCompare(b.id),
  )

  const durationMs = performance.now() - started
  const diagnostics = buildQmlDiagnostics(
    patterns,
    [...rejectionCounts.entries()].map(([reason, count]) => ({ reason, count })),
    durationMs,
    duplicateSuppression.length,
  )
  const { counts, details } = auditQmlInvariants(patterns, visibleIndex, input)

  return {
    version: SMC_QML_VERSION,
    experimental: config.experimental,
    enabled: true,
    visibleThroughIndex: visibleIndex,
    patterns,
    diagnostics,
    invariants: counts,
    invariantDetails: details,
    status: counts.ok ? 'COMPLETE' : 'FAILED',
    duplicateSuppression,
  }
}

function indexSwings(
  swings: readonly SmcSwingEvent[],
  classified: readonly SmcClassifiedSwingEvent[],
): Map<string, SmcSwingEvent | SmcClassifiedSwingEvent> {
  const map = new Map<string, SmcSwingEvent | SmcClassifiedSwingEvent>()
  for (const s of swings) map.set(s.id, s)
  for (const s of classified) {
    map.set(s.id, s)
    map.set(s.originalSwingId, s)
  }
  return map
}

function resolveSwing(
  map: Map<string, SmcSwingEvent | SmcClassifiedSwingEvent>,
  id: string,
  choch: SmcChochEvent,
): { id: string; candleIndex: number; price: number; timestamp: number; confirmedAtIndex: number } | null {
  const hit = map.get(id)
  if (hit) {
    return {
      id: hit.id,
      candleIndex: hit.candleIndex,
      price: hit.price,
      timestamp: hit.timestamp,
      confirmedAtIndex: hit.confirmedAtIndex,
    }
  }
  // Synthesize from CHoCH broken swing fields when swing array lacks the id
  if (choch.brokenSwingId === id) {
    return {
      id,
      candleIndex: choch.brokenSwingCandleIndex,
      price: choch.brokenSwingPrice,
      timestamp: choch.brokenSwingTimestamp,
      confirmedAtIndex: choch.brokenSwingConfirmedAtIndex,
    }
  }
  return null
}

function scopeAllows(
  classification: string,
  scope: QmlConfig['structureScope'],
): boolean {
  if (scope === 'BOTH') return true
  if (scope === 'EXTERNAL') return classification === 'EXTERNAL' || classification === 'UNCLASSIFIED'
  if (scope === 'INTERNAL') return classification === 'INTERNAL' || classification === 'UNCLASSIFIED'
  return true
}

function findExtremeSwing(
  direction: QmlDirection,
  classified: readonly SmcClassifiedSwingEvent[],
  swingsById: Map<string, SmcSwingEvent | SmcClassifiedSwingEvent>,
  source: { id: string; candleIndex: number; price: number; confirmedAtIndex: number },
  choch: SmcChochEvent,
  visibleIndex: number,
  config: QmlConfig,
): { id: string; candleIndex: number; price: number; timestamp: number; confirmedAtIndex: number } | null {
  const wantLow = direction === 'BULLISH'
  const candidates = classified
    .filter((s) => {
      if (s.confirmedAtIndex > visibleIndex) return false
      if (s.candleIndex <= source.candleIndex) return false
      if (s.candleIndex >= choch.candleIndex) return false
      if (!scopeAllows(s.classification, config.structureScope)) return false
      const isLow = s.kind.includes('LOW')
      return wantLow ? isLow : !isLow
    })
    .sort((a, b) => b.candleIndex - a.candleIndex || a.id.localeCompare(b.id))

  // Prefer Dow-labeled LL / HH
  const dowLabel = wantLow ? 'LL' : 'HH'
  for (const s of candidates) {
    // Label check deferred to caller via Dow — pick latest extreme before choch
    void dowLabel
    return {
      id: s.id,
      candleIndex: s.candleIndex,
      price: s.price,
      timestamp: s.timestamp,
      confirmedAtIndex: s.confirmedAtIndex,
    }
  }

  // Fallback: base swings
  const base = [...swingsById.values()]
    .filter((s) => {
      if (s.confirmedAtIndex > visibleIndex) return false
      if (s.candleIndex <= source.candleIndex) return false
      if (s.candleIndex >= choch.candleIndex) return false
      const isLow = s.kind.includes('LOW')
      return wantLow ? isLow : !isLow
    })
    .sort((a, b) => b.candleIndex - a.candleIndex || a.id.localeCompare(b.id))

  const hit = base[0]
  if (!hit) return null
  return {
    id: hit.id,
    candleIndex: hit.candleIndex,
    price: hit.price,
    timestamp: hit.timestamp,
    confirmedAtIndex: hit.confirmedAtIndex,
  }
}

function inferPriorTrend(
  direction: QmlDirection,
  dow: SmcDowTheoryLayer,
  source: { id: string },
  extreme: { id: string },
  _visibleIndex: number,
  config: QmlConfig,
): { ok: true; priorTrend: string; trendStrength: number } | { ok: false; reason: string } {
  const expected =
    direction === 'BULLISH'
      ? (['Bearish', 'Pullback', 'Reversal'] as const)
      : (['Bullish', 'Pullback', 'Reversal'] as const)

  const sourceMeta = dow.bySwingId[source.id]
  const extremeMeta = dow.bySwingId[extreme.id]

  if (direction === 'BULLISH') {
    // Need LH then LL (or bearish context)
    const hasLh = sourceMeta?.label === 'LH' || sourceMeta?.label == null
    const hasLl = extremeMeta?.label === 'LL' || extremeMeta?.label == null
    if (!hasLh && sourceMeta?.label != null) {
      return { ok: false, reason: 'wrong-broken-swing-label' }
    }
    if (!hasLl && extremeMeta?.label != null) {
      return { ok: false, reason: 'no-structural-extreme' }
    }
  } else {
    const hasHl = sourceMeta?.label === 'HL' || sourceMeta?.label == null
    const hasHh = extremeMeta?.label === 'HH' || extremeMeta?.label == null
    if (!hasHl && sourceMeta?.label != null) {
      return { ok: false, reason: 'wrong-broken-swing-label' }
    }
    if (!hasHh && extremeMeta?.label != null) {
      return { ok: false, reason: 'no-structural-extreme' }
    }
  }

  const trend = dow.trend
  const strength = dow.strength
  const priorOk =
    expected.includes(trend as (typeof expected)[number]) ||
    trend === 'Unknown' ||
    trend === 'Range' ||
    // Allow when Dow labels show the progression even if current trend already shifted
    (direction === 'BULLISH' &&
      (sourceMeta?.label === 'LH' || extremeMeta?.label === 'LL')) ||
    (direction === 'BEARISH' &&
      (sourceMeta?.label === 'HL' || extremeMeta?.label === 'HH'))

  if (!priorOk) {
    return { ok: false, reason: 'no-prior-trend' }
  }

  const priorTrend =
    direction === 'BULLISH'
      ? sourceMeta?.label === 'LH' || extremeMeta?.label === 'LL'
        ? 'Bearish'
        : trend
      : sourceMeta?.label === 'HL' || extremeMeta?.label === 'HH'
        ? 'Bullish'
        : trend

  const trendStrength =
    priorTrend === 'Bearish' || priorTrend === 'Bullish'
      ? Math.max(strength, config.minimumPriorTrendStrength)
      : strength

  if (trendStrength < config.minimumPriorTrendStrength && trend !== 'Unknown') {
    return { ok: false, reason: 'weak-prior-trend' }
  }

  return { ok: true, priorTrend: String(priorTrend), trendStrength }
}

function buildTrendCandidates(
  dow: SmcDowTheoryLayer,
  classified: readonly SmcClassifiedSwingEvent[],
  swingsById: Map<string, SmcSwingEvent | SmcClassifiedSwingEvent>,
  visibleIndex: number,
  config: QmlConfig,
  reject: (reason: string) => void,
): Array<{
  direction: QmlDirection
  priorTrend: string
  trendStrength: number
  source: { id: string; candleIndex: number; price: number; timestamp: number; confirmedAtIndex: number }
  extreme: { id: string; candleIndex: number; price: number; timestamp: number; confirmedAtIndex: number }
  structureScope: 'INTERNAL' | 'EXTERNAL'
}> {
  const out: ReturnType<typeof buildTrendCandidates> = []
  const metas = dow.swings.filter((m) => m.confirmedAtIndex <= visibleIndex)

  // Bullish candidate: LH then later LL
  for (let i = 0; i < metas.length; i += 1) {
    const src = metas[i]!
    if (src.label !== 'LH') continue
    if (!scopeAllows(src.classification, config.structureScope)) continue
    for (let j = i + 1; j < metas.length; j += 1) {
      const ext = metas[j]!
      if (ext.label !== 'LL') continue
      if (ext.kind !== 'LOW') continue
      if (ext.candleIndex <= src.candleIndex) continue
      if (!scopeAllows(ext.classification, config.structureScope)) continue
      const sourceSwing = resolveFromMeta(src, swingsById)
      const extremeSwing = resolveFromMeta(ext, swingsById)
      if (!sourceSwing || !extremeSwing) {
        reject('missing-event-reference')
        continue
      }
      out.push({
        direction: 'BULLISH',
        priorTrend: 'Bearish',
        trendStrength: Math.max(dow.strength, config.minimumPriorTrendStrength),
        source: sourceSwing,
        extreme: extremeSwing,
        structureScope: ext.classification === 'EXTERNAL' ? 'EXTERNAL' : 'INTERNAL',
      })
      break
    }
  }

  // Bearish candidate: HL then later HH
  for (let i = 0; i < metas.length; i += 1) {
    const src = metas[i]!
    if (src.label !== 'HL') continue
    if (!scopeAllows(src.classification, config.structureScope)) continue
    for (let j = i + 1; j < metas.length; j += 1) {
      const ext = metas[j]!
      if (ext.label !== 'HH') continue
      if (ext.kind !== 'HIGH') continue
      if (ext.candleIndex <= src.candleIndex) continue
      if (!scopeAllows(ext.classification, config.structureScope)) continue
      const sourceSwing = resolveFromMeta(src, swingsById)
      const extremeSwing = resolveFromMeta(ext, swingsById)
      if (!sourceSwing || !extremeSwing) {
        reject('missing-event-reference')
        continue
      }
      out.push({
        direction: 'BEARISH',
        priorTrend: 'Bullish',
        trendStrength: Math.max(dow.strength, config.minimumPriorTrendStrength),
        source: sourceSwing,
        extreme: extremeSwing,
        structureScope: ext.classification === 'EXTERNAL' ? 'EXTERNAL' : 'INTERNAL',
      })
      break
    }
  }

  void classified
  return out
}

function resolveFromMeta(
  meta: { swingId: string; candleIndex: number; price: number; confirmedAtIndex: number },
  swingsById: Map<string, SmcSwingEvent | SmcClassifiedSwingEvent>,
): { id: string; candleIndex: number; price: number; timestamp: number; confirmedAtIndex: number } | null {
  const hit = swingsById.get(meta.swingId)
  if (hit) {
    return {
      id: hit.id,
      candleIndex: hit.candleIndex,
      price: hit.price,
      timestamp: hit.timestamp,
      confirmedAtIndex: hit.confirmedAtIndex,
    }
  }
  return {
    id: meta.swingId,
    candleIndex: meta.candleIndex,
    price: meta.price,
    timestamp: 0,
    confirmedAtIndex: meta.confirmedAtIndex,
  }
}

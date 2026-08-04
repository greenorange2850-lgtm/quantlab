import type { Candle } from '@/data/candles'
import type {
  SmcBosEvent,
  SmcDisplacementEvent,
  SmcFvgEvent,
  SmcLiquiditySweepEvent,
  SmcOrderBlockEvent,
} from '../types'
import type { SmcChartZoneState, SmcZoneProjection } from '../lifecycle/types'
import type { QmlConfig } from './qml-config'
import type {
  QmlCheck,
  QmlConfirmationRefs,
  QmlPattern,
  QmlRetestDetails,
  QmlStatus,
} from './qml-types'

export interface QmlLifecycleContext {
  candles: readonly Candle[]
  visibleIndex: number
  config: QmlConfig
  bosEvents: readonly SmcBosEvent[]
  displacementEvents: readonly SmcDisplacementEvent[]
  fvgEvents: readonly SmcFvgEvent[]
  liquiditySweepEvents: readonly SmcLiquiditySweepEvent[]
  orderBlockEvents: readonly SmcOrderBlockEvent[]
}

/**
 * Advance a confirmed QML pattern through zone / retest / entry / invalidation / expiry.
 * Does not skip lifecycle states silently.
 */
export function advanceQmlLifecycle(
  pattern: QmlPattern,
  ctx: QmlLifecycleContext,
): QmlPattern {
  if (
    pattern.status === 'INVALIDATED' ||
    pattern.status === 'EXPIRED' ||
    pattern.status === 'CANDIDATE'
  ) {
    return pattern
  }

  let next: QmlPattern = { ...pattern }
  const created = next.createdIndex

  // ZONE_ACTIVE once zone exists after confirmation
  if (next.status === 'CONFIRMED' && next.zoneHigh > next.zoneLow) {
    next = {
      ...next,
      status: 'ZONE_ACTIVE',
      zoneActiveIndex: next.confirmedIndex ?? created,
      zoneEndIndex: ctx.visibleIndex,
      explanation: [
        ...next.explanation,
        `ZONE_ACTIVE at index ${next.confirmedIndex ?? created}: QML zone [${next.zoneLow}, ${next.zoneHigh}] (${next.zoneMode}).`,
      ],
      eventChain: [...next.eventChain, `status:ZONE_ACTIVE@${next.confirmedIndex ?? created}`],
    }
  }

  // Invalidation / expiry checked continuously after zone is active
  if (
    next.status === 'ZONE_ACTIVE' ||
    next.status === 'RETESTED' ||
    next.status === 'ENTRY_READY'
  ) {
    const invalidAt = findInvalidationIndex(next, ctx)
    if (invalidAt != null) {
      return {
        ...next,
        status: 'INVALIDATED',
        invalidatedIndex: invalidAt,
        zoneEndIndex: invalidAt,
        explanation: [
          ...next.explanation,
          `INVALIDATED at index ${invalidAt} via ${next.invalidationMode}.`,
        ],
        eventChain: [...next.eventChain, `status:INVALIDATED@${invalidAt}`],
      }
    }

    if (ctx.config.expirationCandles > 0 && next.status === 'ZONE_ACTIVE') {
      const expireAt = created + ctx.config.expirationCandles
      if (ctx.visibleIndex >= expireAt && next.retestIndex == null) {
        return {
          ...next,
          status: 'EXPIRED',
          expiredIndex: expireAt,
          zoneEndIndex: expireAt,
          explanation: [
            ...next.explanation,
            `EXPIRED at index ${expireAt}: no retest within ${ctx.config.expirationCandles} candles.`,
          ],
          eventChain: [...next.eventChain, `status:EXPIRED@${expireAt}`],
        }
      }
    }
  }

  // Retest strictly after zone creation (candle must be closed = <= visibleIndex)
  if (next.status === 'ZONE_ACTIVE') {
    const retest = findRetest(next, ctx)
    if (retest) {
      next = {
        ...next,
        status: 'RETESTED',
        retestIndex: retest.firstRetestIndex,
        retestDetails: retest,
        zoneEndIndex: ctx.visibleIndex,
        explanation: [
          ...next.explanation,
          `RETESTED at index ${retest.firstRetestIndex}: penetration ${retest.penetrationPercent.toFixed(2)}%, touches=${retest.touchCount}.`,
        ],
        eventChain: [...next.eventChain, `status:RETESTED@${retest.firstRetestIndex}`],
      }
    } else {
      next = { ...next, zoneEndIndex: ctx.visibleIndex }
      return next
    }
  }

  // ENTRY_READY after retest close + configured confirmations
  if (next.status === 'RETESTED' || next.status === 'ENTRY_READY') {
    const { refs, required, optional, missing } = evaluateConfirmations(next, ctx)
    const allRequiredPass = required.every((c) => c.passed)
    next = {
      ...next,
      confirmationRefs: refs,
      requiredChecks: required,
      optionalChecks: optional,
      missingChecks: missing,
      zoneEndIndex: ctx.visibleIndex,
    }

    if (allRequiredPass && next.status === 'RETESTED') {
      const readyIndex = next.retestIndex!
      next = {
        ...next,
        status: 'ENTRY_READY',
        entryReadyIndex: readyIndex,
        explanation: [
          ...next.explanation,
          `ENTRY_READY at index ${readyIndex}: confirmation mode ${next.confirmationMode} satisfied.`,
          ...(next.confirmationMode === 'EARLY'
            ? ['EARLY mode is experimental and must not claim high quality.']
            : []),
        ],
        eventChain: [...next.eventChain, `status:ENTRY_READY@${readyIndex}`],
      }
    } else if (!allRequiredPass && next.status === 'ENTRY_READY') {
      // Confirmations can only upgrade; once ready stays ready unless invalidated.
      // Keep as ENTRY_READY.
    } else if (!allRequiredPass) {
      next = {
        ...next,
        explanation: [
          ...next.explanation.filter((e) => !e.startsWith('Missing confirmations:')),
          `Missing confirmations: ${missing.join(', ') || 'none listed'}.`,
        ],
      }
    }
  }

  return next
}

function findInvalidationIndex(
  pattern: QmlPattern,
  ctx: QmlLifecycleContext,
): number | null {
  const start = pattern.createdIndex + 1
  for (let i = start; i <= ctx.visibleIndex; i += 1) {
    const c = ctx.candles[i]
    if (!c) continue

    if (pattern.invalidationMode === 'CLOSE_BEYOND_ZONE') {
      if (pattern.direction === 'BULLISH' && c.close < pattern.zoneLow) return i
      if (pattern.direction === 'BEARISH' && c.close > pattern.zoneHigh) return i
    }

    if (pattern.invalidationMode === 'WICK_BEYOND_EXTREME') {
      // Use extreme swing price stored via zone / explanation — extreme beyond wick.
      // Bullish: wick below extreme low (zoneLow of structure when extreme is LL).
      // We store extreme via pattern — use zoneLow for bullish structural extreme proxy
      // only when STRUCTURE_LEVEL; otherwise compare to extreme via event chain.
      // Spec: wick below structural extreme (bullish) / above (bearish).
      // extremeSwingId price is not on pattern — use zoneLow/High for OPEN_TO_EXTREME
      // and a dedicated field isn't present; use zone extreme + direction.
      if (pattern.direction === 'BULLISH' && c.low < pattern.zoneLow) return i
      if (pattern.direction === 'BEARISH' && c.high > pattern.zoneHigh) return i
    }

    if (pattern.invalidationMode === 'OPPOSING_EXTERNAL_BOS') {
      const opposing = ctx.bosEvents.find(
        (b) =>
          b.candleIndex === i &&
          b.brokenSwingClassification === 'EXTERNAL' &&
          ((pattern.direction === 'BULLISH' && b.kind === 'BEARISH_BOS') ||
            (pattern.direction === 'BEARISH' && b.kind === 'BULLISH_BOS')),
      )
      if (opposing) return i
    }
  }
  return null
}

function findRetest(
  pattern: QmlPattern,
  ctx: QmlLifecycleContext,
): QmlRetestDetails | null {
  const mode = ctx.config.retestMode
  const mid = (pattern.zoneHigh + pattern.zoneLow) / 2
  const height = pattern.zoneHigh - pattern.zoneLow
  let first: QmlRetestDetails | null = null
  let touchCount = 0

  for (let i = pattern.createdIndex + 1; i <= ctx.visibleIndex; i += 1) {
    const c = ctx.candles[i]
    if (!c) continue

    const touched =
      pattern.direction === 'BULLISH'
        ? c.low <= pattern.zoneHigh && c.high >= pattern.zoneLow
        : c.high >= pattern.zoneLow && c.low <= pattern.zoneHigh

    if (!touched) continue

    let qualifies = false
    let penetration = 0

    if (mode === 'TOUCH') {
      qualifies = true
      if (pattern.direction === 'BULLISH') {
        penetration =
          height > 0
            ? Math.max(0, Math.min(1, (pattern.zoneHigh - c.low) / height)) * 100
            : 0
      } else {
        penetration =
          height > 0
            ? Math.max(0, Math.min(1, (c.high - pattern.zoneLow) / height)) * 100
            : 0
      }
    } else if (mode === 'MIDPOINT') {
      if (pattern.direction === 'BULLISH' && c.low <= mid) {
        qualifies = true
        penetration =
          height > 0
            ? Math.max(0, Math.min(1, (pattern.zoneHigh - c.low) / height)) * 100
            : 50
      }
      if (pattern.direction === 'BEARISH' && c.high >= mid) {
        qualifies = true
        penetration =
          height > 0
            ? Math.max(0, Math.min(1, (c.high - pattern.zoneLow) / height)) * 100
            : 50
      }
    } else if (mode === 'DEEP_RETRACE') {
      const deep = ctx.config.deepRetraceFraction
      if (pattern.direction === 'BULLISH') {
        const threshold = pattern.zoneHigh - height * deep
        if (c.low <= threshold) {
          qualifies = true
          penetration =
            height > 0
              ? Math.max(0, Math.min(1, (pattern.zoneHigh - c.low) / height)) * 100
              : deep * 100
        }
      } else {
        const threshold = pattern.zoneLow + height * deep
        if (c.high >= threshold) {
          qualifies = true
          penetration =
            height > 0
              ? Math.max(0, Math.min(1, (c.high - pattern.zoneLow) / height)) * 100
              : deep * 100
        }
      }
    }

    if (!qualifies) continue
    touchCount += 1

    const closeLocation = closeLocationOf(c.close, pattern.zoneLow, pattern.zoneHigh)
    const rejectionOccurred =
      pattern.direction === 'BULLISH'
        ? c.close > c.open && c.close >= mid
        : c.close < c.open && c.close <= mid

    if (!first) {
      first = {
        firstRetestIndex: i,
        firstRetestTimestamp: c.time,
        penetrationPercent: penetration,
        closeLocation,
        rejectionOccurred,
        touchCount: 1,
        retestMode: mode,
      }
    }
  }

  if (!first) return null
  return { ...first, touchCount }
}

function closeLocationOf(
  close: number,
  low: number,
  high: number,
): QmlRetestDetails['closeLocation'] {
  if (close < low) return 'BELOW_ZONE'
  if (close > high) return 'ABOVE_ZONE'
  if (close === low || close === high) return 'AT_BOUNDARY'
  return 'INSIDE_ZONE'
}

function evaluateConfirmations(
  pattern: QmlPattern,
  ctx: QmlLifecycleContext,
): {
  refs: QmlConfirmationRefs
  required: QmlCheck[]
  optional: QmlCheck[]
  missing: string[]
} {
  const retestIndex = pattern.retestIndex
  const refs: QmlConfirmationRefs = { ...pattern.confirmationRefs }
  const windowStart = pattern.createdIndex
  const windowEnd = ctx.visibleIndex

  const rejection = findRejection(pattern, ctx, retestIndex)
  if (rejection) refs.rejectionEventId = rejection

  const displacement = ctx.displacementEvents.find(
    (d) =>
      d.candleIndex >= windowStart &&
      d.candleIndex <= windowEnd &&
      ((pattern.direction === 'BULLISH' && d.kind === 'BULLISH_DISPLACEMENT') ||
        (pattern.direction === 'BEARISH' && d.kind === 'BEARISH_DISPLACEMENT')),
  )
  if (displacement) refs.displacementEventId = displacement.id

  const fvg = ctx.fvgEvents.find(
    (f) =>
      (f.kind === 'BULLISH_FVG_CREATED' || f.kind === 'BEARISH_FVG_CREATED') &&
      f.direction === pattern.direction &&
      f.candleIndex >= windowStart &&
      f.candleIndex <= windowEnd &&
      rangesOverlap(f.lowerBoundary, f.upperBoundary, pattern.zoneLow, pattern.zoneHigh),
  )
  if (fvg) refs.fvgEventId = fvg.id

  const sweep = ctx.liquiditySweepEvents.find(
    (s) =>
      s.candleIndex <= pattern.createdIndex &&
      ((pattern.direction === 'BULLISH' && s.kind === 'SELL_SIDE_LIQUIDITY_SWEEP') ||
        (pattern.direction === 'BEARISH' && s.kind === 'BUY_SIDE_LIQUIDITY_SWEEP')),
  )
  if (sweep) refs.sweepEventId = sweep.id

  const ob = ctx.orderBlockEvents.find(
    (o) =>
      (o.kind === 'BULLISH_ORDER_BLOCK_CREATED' ||
        o.kind === 'BEARISH_ORDER_BLOCK_CREATED') &&
      o.direction === pattern.direction &&
      o.candleIndex <= windowEnd &&
      rangesOverlap(o.zoneLow, o.zoneHigh, pattern.zoneLow, pattern.zoneHigh),
  )
  if (ob) refs.orderBlockId = ob.orderBlockId

  const retestPassed = retestIndex != null && retestIndex <= ctx.visibleIndex
  const hasRejection = Boolean(refs.rejectionEventId || pattern.retestDetails?.rejectionOccurred)
  const hasDisplacement = Boolean(refs.displacementEventId)
  const hasFvg = Boolean(refs.fvgEventId)
  const hasSweep = Boolean(refs.sweepEventId)
  const hasOb = Boolean(refs.orderBlockId)
  const mode = pattern.confirmationMode

  const required: QmlCheck[] = []
  const optional: QmlCheck[] = []

  const push = (
    list: QmlCheck[],
    id: string,
    label: string,
    passed: boolean,
    requiredFlag: boolean,
    reason: string,
    sourceEventIds: string[],
  ) => {
    list.push({ id, label, passed, required: requiredFlag, reason, sourceEventIds })
  }

  push(
    required,
    'retest',
    'Retest completed',
    retestPassed,
    true,
    retestPassed
      ? `Retest closed at index ${retestIndex}`
      : 'Retest has not completed after zone creation',
    retestIndex != null ? [`retest@${retestIndex}`] : [],
  )

  if (mode === 'EARLY') {
    // Retest only — experimental
    push(
      optional,
      'early-experimental',
      'EARLY confirmation (experimental)',
      true,
      false,
      'EARLY mode requires retest only and must not claim high quality',
      [],
    )
  } else if (mode === 'STRICT') {
    push(
      required,
      'rejection',
      'Directional rejection',
      hasRejection,
      true,
      hasRejection ? 'Directional rejection present' : 'Missing directional rejection candle',
      refs.rejectionEventId ? [refs.rejectionEventId] : [],
    )
    push(
      required,
      'displacement',
      'Directional displacement',
      hasDisplacement,
      true,
      hasDisplacement ? 'Directional displacement present' : 'Missing directional displacement',
      refs.displacementEventId ? [refs.displacementEventId] : [],
    )
    push(
      required,
      'fvg-or-ob',
      'FVG or OB overlap',
      hasFvg || hasOb,
      true,
      hasFvg || hasOb
        ? 'FVG or Order Block overlap present'
        : 'Need at least one of FVG or OB overlap',
      [refs.fvgEventId, refs.orderBlockId].filter(Boolean) as string[],
    )
  } else {
    // BALANCED
    push(
      required,
      'rejection-or-displacement',
      'Rejection OR displacement',
      hasRejection || hasDisplacement,
      true,
      hasRejection || hasDisplacement
        ? 'Directional rejection or displacement present'
        : 'Need directional rejection OR displacement',
      [refs.rejectionEventId, refs.displacementEventId].filter(Boolean) as string[],
    )
    push(
      required,
      'context',
      'Context confirmation (sweep / FVG / OB)',
      hasSweep || hasFvg || hasOb,
      true,
      hasSweep || hasFvg || hasOb
        ? 'Context confirmation present'
        : 'Need at least one of sweep / FVG / OB',
      [refs.sweepEventId, refs.fvgEventId, refs.orderBlockId].filter(Boolean) as string[],
    )
  }

  // Optional diagnostics
  push(
    optional,
    'rejection',
    'Directional rejection',
    hasRejection,
    false,
    hasRejection ? 'Present' : 'Absent',
    refs.rejectionEventId ? [refs.rejectionEventId] : [],
  )
  push(
    optional,
    'displacement',
    'Directional displacement',
    hasDisplacement,
    false,
    hasDisplacement ? 'Present' : 'Absent',
    refs.displacementEventId ? [refs.displacementEventId] : [],
  )
  push(
    optional,
    'fvg',
    'FVG overlap',
    hasFvg,
    false,
    hasFvg ? 'Present' : 'Absent',
    refs.fvgEventId ? [refs.fvgEventId] : [],
  )
  push(
    optional,
    'sweep',
    'Liquidity sweep',
    hasSweep,
    false,
    hasSweep ? 'Present' : 'Absent',
    refs.sweepEventId ? [refs.sweepEventId] : [],
  )
  push(
    optional,
    'order-block',
    'Order Block overlap',
    hasOb,
    false,
    hasOb ? 'Present' : 'Absent',
    refs.orderBlockId ? [refs.orderBlockId] : [],
  )

  const missing = required.filter((c) => !c.passed).map((c) => c.label)
  return { refs, required, optional, missing }
}

function findRejection(
  pattern: QmlPattern,
  ctx: QmlLifecycleContext,
  retestIndex: number | undefined,
): string | undefined {
  if (retestIndex == null) return undefined
  const c = ctx.candles[retestIndex]
  if (!c) return undefined
  const mid = (pattern.zoneHigh + pattern.zoneLow) / 2
  if (pattern.direction === 'BULLISH' && c.close > c.open && c.close >= mid) {
    return `qml-rejection-bull-${retestIndex}`
  }
  if (pattern.direction === 'BEARISH' && c.close < c.open && c.close <= mid) {
    return `qml-rejection-bear-${retestIndex}`
  }
  return undefined
}

function rangesOverlap(aLow: number, aHigh: number, bLow: number, bHigh: number): boolean {
  return aLow <= bHigh && aHigh >= bLow
}

/** Project QML patterns into chart zone projections. */
export function projectQmlZones(
  patterns: readonly QmlPattern[],
  visibleIndex: number,
  options?: { extendActiveRight?: boolean },
): SmcZoneProjection[] {
  const extendActive = options?.extendActiveRight !== false
  const projections: SmcZoneProjection[] = []

  for (const p of patterns) {
    if (p.status === 'CANDIDATE') continue
    if (p.createdIndex > visibleIndex) continue

    const state = chartStateFor(p.status)
    const terminal =
      p.status === 'INVALIDATED' || p.status === 'EXPIRED'
        ? (p.invalidatedIndex ?? p.expiredIndex ?? p.zoneEndIndex)
        : undefined

    const stillActive =
      p.status === 'CONFIRMED' ||
      p.status === 'ZONE_ACTIVE' ||
      p.status === 'RETESTED' ||
      p.status === 'ENTRY_READY'

    let endIndex: number
    let extendsToVisibleEdge = false
    if (stillActive && extendActive) {
      endIndex = visibleIndex
      extendsToVisibleEdge = true
    } else {
      endIndex = terminal ?? Math.min(p.zoneEndIndex, visibleIndex)
      extendsToVisibleEdge = false
    }

    projections.push({
      zoneId: p.zoneId,
      zoneKind: 'QML',
      direction: p.direction,
      sourceEventId: p.id,
      startIndex: p.createdIndex,
      endIndex,
      low: p.zoneLow,
      high: p.zoneHigh,
      midpoint: (p.zoneLow + p.zoneHigh) / 2,
      state,
      firstTouchIndex: p.retestIndex,
      invalidationIndex: p.invalidatedIndex,
      expirationIndex: p.expiredIndex,
      activeAtVisibleIndex: stillActive,
      setupRefs: [p.id],
      lifecycleReason:
        p.status === 'INVALIDATED'
          ? 'QML invalidated — zone stops extending.'
          : p.status === 'EXPIRED'
            ? 'QML expired — zone stops extending.'
            : `QML ${p.status} extends while valid.`,
      shortLabel: p.status === 'ENTRY_READY' ? 'ENTRY READY' : `QML ${p.direction[0]}`,
      fullLabel: `${p.direction} QML · ${p.status} · strength ${p.setupStrength}`,
      visibilityReason: 'QML pattern zone',
      extendsToVisibleEdge,
    })
  }

  return projections
}

function chartStateFor(status: QmlStatus): SmcChartZoneState {
  switch (status) {
    case 'ZONE_ACTIVE':
    case 'CONFIRMED':
      return 'ACTIVE'
    case 'RETESTED':
    case 'ENTRY_READY':
      return 'TOUCHED'
    case 'INVALIDATED':
      return 'INVALIDATED'
    case 'EXPIRED':
      return 'EXPIRED'
    default:
      return 'ACTIVE'
  }
}

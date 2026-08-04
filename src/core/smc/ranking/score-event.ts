import type {
  SmcBosEvent,
  SmcChochEvent,
  SmcClassifiedSwingEvent,
  SmcDetectionResult,
  SmcDisplacementEvent,
  SmcEqualLevelEvent,
  SmcEvent,
  SmcFvgEvent,
  SmcLiquiditySweepEvent,
  SmcOrderBlockEvent,
  SmcSwingEvent,
} from '../types'
import type { SmcImportanceReason } from './types'

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

function push(reasons: SmcImportanceReason[], delta: number, label: string): void {
  if (delta === 0) return
  const sign = delta > 0 ? '+' : ''
  reasons.push({ delta, label: `${sign}${delta} ${label}` })
}

function isLifecycleKind(kind: string): boolean {
  return (
    kind === 'FVG_TOUCHED' ||
    kind === 'FVG_HALF_FILLED' ||
    kind === 'FVG_FULLY_FILLED' ||
    kind === 'FVG_INVALIDATED' ||
    kind === 'ORDER_BLOCK_TOUCHED' ||
    kind === 'ORDER_BLOCK_MITIGATED' ||
    kind === 'ORDER_BLOCK_INVALIDATED'
  )
}

function baseForKind(event: SmcEvent): { base: number; label: string } {
  const kind = event.kind
  if (kind.startsWith('EXTERNAL_SWING')) return { base: 55, label: 'Base external swing' }
  if (kind.startsWith('INTERNAL_SWING')) return { base: 25, label: 'Base internal swing' }
  if (kind === 'SWING_HIGH' || kind === 'SWING_LOW') return { base: 30, label: 'Base swing' }
  if (kind === 'BULLISH_BOS' || kind === 'BEARISH_BOS') {
    const bos = event as SmcBosEvent
    if (bos.brokenSwingClassification === 'EXTERNAL') {
      return { base: 68, label: 'Base external BOS' }
    }
    if (bos.brokenSwingClassification === 'INTERNAL') {
      // Must clear Balanced general floor (45) even after mild duplicate soft-penalty.
      return { base: 55, label: 'Base internal BOS' }
    }
    return { base: 55, label: 'Base BOS' }
  }
  if (kind === 'BULLISH_CHOCH' || kind === 'BEARISH_CHOCH') {
    const choch = event as SmcChochEvent
    if (choch.brokenSwingClassification === 'EXTERNAL') {
      return { base: 72, label: 'Base external CHoCH' }
    }
    if (choch.brokenSwingClassification === 'INTERNAL') {
      return { base: 58, label: 'Base internal CHoCH' }
    }
    return { base: 58, label: 'Base CHoCH' }
  }
  if (kind.includes('DISPLACEMENT')) return { base: 52, label: 'Base displacement' }
  if (kind === 'BULLISH_FVG_CREATED' || kind === 'BEARISH_FVG_CREATED') {
    return { base: 40, label: 'Base FVG created' }
  }
  if (kind === 'EQUAL_HIGHS' || kind === 'EQUAL_LOWS') {
    return { base: 22, label: 'Base equal level' }
  }
  if (kind.includes('LIQUIDITY_SWEEP')) return { base: 50, label: 'Base liquidity sweep' }
  if (kind === 'BULLISH_ORDER_BLOCK_CREATED' || kind === 'BEARISH_ORDER_BLOCK_CREATED') {
    return { base: 54, label: 'Base order block' }
  }
  if (isLifecycleKind(kind)) return { base: 12, label: 'Base lifecycle update' }
  return { base: 20, label: 'Base event' }
}

function structureBullish(state: SmcDetectionResult['structureState']): boolean | null {
  if (state === 'BULLISH_STRUCTURE') return true
  if (state === 'BEARISH_STRUCTURE') return false
  return null
}

/**
 * Score a single event for relevance (not confidence).
 * Pure function — does not mutate the detector event.
 */
export function scoreSmcEvent(
  event: SmcEvent,
  result: SmcDetectionResult,
  context: {
    candleCount: number
    /** Same-kind neighbors within ±2 candles (excluding self). */
    nearbySameFamilyIds: string[]
    /** Prior same-direction BOS ids before this event (continuation). */
    priorContinuationBos: boolean
    /** True when a structure break / displacement follows this sweep within a short window. */
    sweepBeforeReversal: boolean
  },
): { importanceScore: number; importanceReasons: SmcImportanceReason[] } {
  const reasons: SmcImportanceReason[] = []
  const { base, label } = baseForKind(event)
  push(reasons, base, label)
  let score = base

  // External structure boost
  if (
    event.kind.startsWith('EXTERNAL_SWING') ||
    ('classification' in event &&
      (event as SmcClassifiedSwingEvent).classification === 'EXTERNAL') ||
    ('brokenSwingClassification' in event &&
      (event as SmcBosEvent | SmcChochEvent).brokenSwingClassification === 'EXTERNAL')
  ) {
    push(reasons, 20, 'External Structure')
    score += 20
  }

  // Major BOS / CHoCH (external + meaningful break)
  if (event.kind.includes('BOS') && !event.kind.includes('ORDER')) {
    const bos = event as SmcBosEvent
    if (
      bos.brokenSwingClassification === 'EXTERNAL' &&
      Math.abs(bos.breakPercent) >= 0.15
    ) {
      push(reasons, 12, 'Major BOS')
      score += 12
    }
    if (context.priorContinuationBos && bos.brokenSwingClassification !== 'EXTERNAL') {
      push(reasons, -12, 'Repeated BOS continuation')
      score -= 12
    }
  }
  if (event.kind.includes('CHOCH')) {
    const choch = event as SmcChochEvent
    if (
      choch.brokenSwingClassification === 'EXTERNAL' &&
      Math.abs(choch.breakPercent) >= 0.1
    ) {
      push(reasons, 15, 'Major CHoCH')
      score += 15
    }
  }

  // Displacement strength
  if (event.kind.includes('DISPLACEMENT')) {
    const d = event as SmcDisplacementEvent
    if (d.bodyAtrMultiple >= 1.5) {
      push(reasons, 15, 'Strong Displacement')
      score += 15
    } else if (d.bodyAtrMultiple < 1.0) {
      push(reasons, -10, 'Weak displacement')
      score -= 10
    }
    if (d.structureBreakId) {
      push(reasons, 10, 'Displacement confirmed')
      score += 10
    }
  }

  // Order Block after displacement / freshness / mitigated
  if (event.kind.includes('ORDER_BLOCK')) {
    const ob = event as SmcOrderBlockEvent
    if (
      (ob.kind === 'BULLISH_ORDER_BLOCK_CREATED' ||
        ob.kind === 'BEARISH_ORDER_BLOCK_CREATED') &&
      ob.sourceDisplacementId
    ) {
      push(reasons, 10, 'OB after displacement')
      score += 10
    }
    if (ob.mitigationStatus === 'ACTIVE' || ob.mitigationStatus === 'TOUCHED') {
      const age = context.candleCount - 1 - ob.candleIndex
      if (age >= 0 && age <= Math.max(24, Math.floor(context.candleCount * 0.08))) {
        push(reasons, 10, 'Fresh Order Block')
        score += 10
      } else if (age > Math.floor(context.candleCount * 0.45)) {
        push(reasons, -10, 'Old zone')
        score -= 10
      }
    }
    if (
      ob.mitigationStatus === 'MITIGATED' ||
      ob.mitigationStatus === 'INVALIDATED' ||
      ob.mitigationStatus === 'FULLY_FILLED' ||
      ob.invalidationStatus ||
      isLifecycleKind(ob.kind)
    ) {
      push(reasons, -15, 'Mitigated zone')
      score -= 15
    }
  }

  // FVG alignment / size / mitigated
  if (event.kind.includes('FVG')) {
    const fvg = event as SmcFvgEvent
    const bullishStruct = structureBullish(result.structureState)
    if (
      (fvg.kind === 'BULLISH_FVG_CREATED' || fvg.kind === 'BEARISH_FVG_CREATED') &&
      bullishStruct != null
    ) {
      const aligned =
        (bullishStruct && fvg.direction === 'BULLISH') ||
        (!bullishStruct && fvg.direction === 'BEARISH')
      if (aligned) {
        push(reasons, 10, 'FVG aligned with trend')
        score += 10
      }
    }
    if (
      (fvg.kind === 'BULLISH_FVG_CREATED' || fvg.kind === 'BEARISH_FVG_CREATED') &&
      fvg.gapPercent < 0.05
    ) {
      push(reasons, -8, 'Small FVG')
      score -= 8
    }
    if (
      fvg.state === 'MITIGATED' ||
      fvg.state === 'INVALIDATED' ||
      isLifecycleKind(fvg.kind)
    ) {
      push(reasons, -15, 'Mitigated zone')
      score -= 15
    }
    if (fvg.state === 'ACTIVE') {
      const age = context.candleCount - 1 - fvg.candleIndex
      if (age >= 0 && age <= Math.max(24, Math.floor(context.candleCount * 0.08))) {
        push(reasons, 8, 'Fresh zone')
        score += 8
      } else if (age > Math.floor(context.candleCount * 0.45)) {
        push(reasons, -10, 'Old zone')
        score -= 10
      }
    }
  }

  // Sweep before reversal
  if (event.kind.includes('LIQUIDITY_SWEEP')) {
    const sweep = event as SmcLiquiditySweepEvent
    if (context.sweepBeforeReversal) {
      push(reasons, 15, 'Sweep before reversal')
      score += 15
    }
    if (sweep.ruleChecks?.displacementConfirmed) {
      push(reasons, 8, 'Sweep displacement confirmation')
      score += 8
    }
  }

  // Tiny internal swings
  if (event.kind.startsWith('INTERNAL_SWING')) {
    const swing = event as SmcClassifiedSwingEvent
    if (swing.prominence < 0.12) {
      push(reasons, -15, 'Tiny internal swing')
      score -= 15
    }
  }
  if (event.kind === 'SWING_HIGH' || event.kind === 'SWING_LOW') {
    const swing = event as SmcSwingEvent
    if (swing.classification === 'INTERNAL' && (swing.prominence ?? 1) < 0.12) {
      push(reasons, -15, 'Tiny internal swing')
      score -= 15
    }
  }

  // Equal level noise
  if (event.kind === 'EQUAL_HIGHS' || event.kind === 'EQUAL_LOWS') {
    const eq = event as SmcEqualLevelEvent
    if (eq.touchCount <= 2) {
      push(reasons, -10, 'Equal level noise')
      score -= 10
    }
  }

  // Multiple confirmations (refs / chains)
  if ('refs' in event && Array.isArray(event.refs) && event.refs.length >= 2) {
    push(reasons, 10, 'Multiple confirmations')
    score += 10
  }

  // Nearby duplicates (softer for structure breaks so Balanced does not wipe BOS/CHoCH clusters)
  if (context.nearbySameFamilyIds.length > 0) {
    const isStructureBreak =
      (event.kind.includes('BOS') && !event.kind.includes('ORDER')) ||
      event.kind.includes('CHOCH')
    const penalty = isStructureBreak ? -6 : -12
    push(reasons, penalty, 'Nearby duplicate')
    score += penalty
  }

  return {
    importanceScore: clampScore(score),
    importanceReasons: reasons,
  }
}

/** Family key used for nearby-duplicate detection. */
export function eventFamilyKey(kind: string): string {
  if (kind.includes('SWING_HIGH') || kind === 'SWING_HIGH') return 'SWING_HIGH'
  if (kind.includes('SWING_LOW') || kind === 'SWING_LOW') return 'SWING_LOW'
  if (kind.includes('BOS') && !kind.includes('ORDER')) return kind.startsWith('BULLISH') ? 'BULLISH_BOS' : 'BEARISH_BOS'
  if (kind.includes('CHOCH')) return kind.startsWith('BULLISH') ? 'BULLISH_CHOCH' : 'BEARISH_CHOCH'
  if (kind.includes('DISPLACEMENT')) return kind
  if (kind.includes('FVG') && kind.includes('CREATED')) return kind
  if (kind.includes('LIQUIDITY_SWEEP')) return kind
  if (kind.includes('ORDER_BLOCK') && kind.includes('CREATED')) return kind
  if (kind === 'EQUAL_HIGHS' || kind === 'EQUAL_LOWS') return kind
  return kind
}

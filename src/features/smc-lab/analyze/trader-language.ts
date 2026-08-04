/**
 * Presentation-only trader language helpers.
 * Never mutates engine outputs or scoring — maps display labels only.
 */

import type { SmcDowTheoryLayer } from '@/core/smc'
import type { QmlPattern, QmlStatus } from '@/core/smc'
import type {
  SetupCheck,
  SetupCheckName,
  SetupEngineResult,
  SetupStatus,
  SetupType,
  TradingSetup,
} from '@/core/setup'

export type TraderSide = 'BUY' | 'SELL' | 'WAIT'
export type TraderPhase =
  | 'ENTRY READY'
  | 'WAIT FOR RETEST'
  | 'WATCHING'
  | 'INVALID'
  | 'EXPIRED'
  | 'COMPLETED'
  | 'NO SETUP'

export interface TraderReasonRow {
  passed: boolean
  label: string
  technicalName: SetupCheckName
  technicalReason: string
}

export interface MarketDecisionView {
  side: TraderSide
  phase: TraderPhase
  /** Existing strength 0–100 shown as confidence (presentation only). */
  confidence: number | null
  marketLabel: string
  setupLabel: string | null
  setup: TradingSetup | null
  reasonRows: TraderReasonRow[]
  stillWaiting: string[]
  nextAction: string
  summaryReason: string
}

const CHECK_PASS_LABEL: Record<SetupCheckName, string> = {
  Trend: 'Trend confirmed',
  'Dow Theory': 'Market structure confirmed',
  Structure: 'Structure aligned',
  BOS: 'Break of structure confirmed',
  CHOCH: 'Change of character confirmed',
  Liquidity: 'Liquidity context present',
  Sweep: 'Liquidity sweep confirmed',
  Displacement: 'Strong displacement confirmed',
  FVG: 'Fair value gap aligned',
  OB: 'Order Block found',
  'Zone Lifecycle': 'Entry zone still valid',
  Retest: 'Price retested the entry zone',
  QML: 'Reversal level confirmed',
  Freshness: 'Setup is still fresh',
  Conflict: 'No conflicting signal',
}

const CHECK_FAIL_LABEL: Record<SetupCheckName, string> = {
  Trend: 'Trend not confirmed',
  'Dow Theory': 'Market structure not confirmed',
  Structure: 'Structure not aligned',
  BOS: 'Break of structure missing',
  CHOCH: 'Change of character missing',
  Liquidity: 'Liquidity context missing',
  Sweep: 'Liquidity sweep missing',
  Displacement: 'Strong displacement missing',
  FVG: 'Fair value gap not aligned',
  OB: 'Order Block not found',
  'Zone Lifecycle': 'Entry zone no longer valid',
  Retest: 'Price has not retested the entry zone',
  QML: 'Reversal level not ready',
  Freshness: 'Setup is too old',
  Conflict: 'Conflicting buy and sell signals',
}

export function humanCheckLabel(check: SetupCheck): string {
  return check.passed
    ? (CHECK_PASS_LABEL[check.name] ?? check.name)
    : (CHECK_FAIL_LABEL[check.name] ?? check.name)
}

export function humanMissingCondition(name: string): string {
  if ((CHECK_FAIL_LABEL as Record<string, string>)[name]) {
    return CHECK_FAIL_LABEL[name as SetupCheckName]
  }
  const lowered = name.toLowerCase()
  if (lowered.includes('dow')) return 'Market structure not confirmed'
  if (lowered.includes('retest')) return 'Price has not retested the entry zone'
  if (lowered.includes('qml')) return 'Reversal level not ready'
  if (lowered.includes('lifecycle')) return 'Entry zone no longer valid'
  if (lowered.includes('ob') || lowered.includes('order')) return 'Order Block not found'
  if (lowered.includes('fvg')) return 'Fair value gap not aligned'
  if (lowered.includes('sweep')) return 'Liquidity sweep missing'
  return name
}

export function humanSetupType(type: SetupType): string {
  switch (type) {
    case 'BULLISH_CONTINUATION':
      return 'Bullish Continuation'
    case 'BEARISH_CONTINUATION':
      return 'Bearish Continuation'
    case 'BULLISH_REVERSAL':
      return 'Bullish Reversal'
    case 'BEARISH_REVERSAL':
      return 'Bearish Reversal'
    case 'BULLISH_QML':
      return 'Bullish Reversal Level'
    case 'BEARISH_QML':
      return 'Bearish Reversal Level'
    default:
      return type.replaceAll('_', ' ')
  }
}

export function humanSetupStatus(status: SetupStatus): TraderPhase {
  switch (status) {
    case 'READY':
      return 'ENTRY READY'
    case 'WAITING_RETEST':
      return 'WAIT FOR RETEST'
    case 'WATCHING':
      return 'WATCHING'
    case 'INVALIDATED':
      return 'INVALID'
    case 'EXPIRED':
      return 'EXPIRED'
    case 'COMPLETED':
      return 'COMPLETED'
  }
}

export function humanMarketTrend(trend: SmcDowTheoryLayer['trend']): string {
  switch (trend) {
    case 'Bullish':
      return 'Bullish'
    case 'Bearish':
      return 'Bearish'
    case 'Pullback':
      return 'Pullback'
    case 'Reversal':
      return 'Reversal'
    case 'Range':
      return 'Range'
    default:
      return 'Unclear'
  }
}

export function trendConfidenceLabel(strength: number): string {
  if (strength >= 70) return 'Strong'
  if (strength >= 45) return 'Moderate'
  if (strength >= 25) return 'Weak'
  return 'Unclear'
}

export function preferredDirectionLabel(
  trend: SmcDowTheoryLayer['trend'],
): 'BUY ONLY' | 'SELL ONLY' | 'BOTH SIDES' | 'STAND ASIDE' {
  if (trend === 'Bullish') return 'BUY ONLY'
  if (trend === 'Bearish') return 'SELL ONLY'
  if (trend === 'Pullback' || trend === 'Reversal') return 'BOTH SIDES'
  return 'STAND ASIDE'
}

export function structureNarrative(dow: SmcDowTheoryLayer): string[] {
  const trend = dow.trend
  if (trend === 'Bearish') {
    return ['Lower Highs continue', 'Lower Lows continue']
  }
  if (trend === 'Bullish') {
    return ['Higher Highs continue', 'Higher Lows continue']
  }
  if (trend === 'Pullback') {
    return ['Pullback inside the active trend', 'Wait for continuation or break']
  }
  if (trend === 'Reversal') {
    return ['Structure is shifting', 'Confirm with a retest before committing']
  }
  if (trend === 'Range') {
    return ['Market is ranging', 'No clear directional edge']
  }
  return ['Not enough structure yet', 'Wait for clearer swings']
}

export function humanQmlStatus(status: QmlStatus): { title: string; explanation: string } {
  switch (status) {
    case 'CANDIDATE':
      return {
        title: 'Forming',
        explanation: 'A possible reversal level is forming, but structure is not confirmed yet.',
      }
    case 'CONFIRMED':
      return {
        title: 'Structure broken',
        explanation: 'Price has broken structure. The entry zone is being prepared.',
      }
    case 'ZONE_ACTIVE':
      return {
        title: 'Waiting for retest',
        explanation:
          'Price has broken structure but has not returned to the entry zone.',
      }
    case 'RETESTED':
      return {
        title: 'Waiting for retest',
        explanation:
          'Price has touched the entry zone. Watch for rejection before entry.',
      }
    case 'ENTRY_READY':
      return {
        title: 'Entry Ready',
        explanation: 'The setup is complete. Entry zone, stop, and context are available.',
      }
    case 'INVALIDATED':
      return {
        title: 'Invalid',
        explanation: 'The setup failed. Price moved through the invalidation level.',
      }
    case 'EXPIRED':
      return {
        title: 'Expired',
        explanation: 'The setup aged out before a usable entry formed.',
      }
  }
}

export function humanSetupProgress(setup: TradingSetup | null): {
  title: string
  explanation: string
} {
  if (!setup) {
    return {
      title: 'No active setup',
      explanation: 'Run detection and wait for a clear continuation or reversal sequence.',
    }
  }
  switch (setup.status) {
    case 'READY':
      return {
        title: 'Entry Ready',
        explanation: 'Conditions are complete. Review entry, stop, and target before acting.',
      }
    case 'WAITING_RETEST':
      return {
        title: 'Waiting for retest',
        explanation:
          'Price has broken structure but has not returned to the entry zone.',
      }
    case 'WATCHING':
      return {
        title: 'Forming',
        explanation: 'A setup is developing. Key conditions are still incomplete.',
      }
    case 'INVALIDATED':
      return {
        title: 'Invalid',
        explanation: 'This setup is no longer valid. Look for the next structure event.',
      }
    case 'EXPIRED':
      return {
        title: 'Expired',
        explanation: 'This setup is too old to trade. Wait for a fresh sequence.',
      }
    case 'COMPLETED':
      return {
        title: 'Completed',
        explanation: 'This setup has finished its lifecycle.',
      }
  }
}

export function nextActionForSetup(setup: TradingSetup | null, phase: TraderPhase): string {
  if (!setup || phase === 'NO SETUP') {
    return 'Wait for a clear market structure and setup to form.'
  }
  if (phase === 'ENTRY READY') {
    return setup.direction === 'BULLISH'
      ? 'Review the buy entry zone, stop below the zone, and suggested targets.'
      : 'Review the sell entry zone, stop above the zone, and suggested targets.'
  }
  if (phase === 'WAIT FOR RETEST') {
    return 'Wait for price to revisit the entry zone.'
  }
  if (phase === 'WATCHING') {
    const missing = setup.missingChecks.map(humanMissingCondition)
    if (missing.length > 0) {
      return `Still waiting: ${missing[0]!.charAt(0).toLowerCase()}${missing[0]!.slice(1)}.`
    }
    return 'Keep watching — the setup is not complete yet.'
  }
  if (phase === 'INVALID') {
    return 'Stand aside. This setup was invalidated.'
  }
  if (phase === 'EXPIRED') {
    return 'Stand aside. Wait for a fresh setup.'
  }
  return 'Monitor price and wait for the next clear signal.'
}

export function buildMarketDecisionView(
  result: SetupEngineResult | null,
  dow: SmcDowTheoryLayer,
  selectedSetup: TradingSetup | null,
): MarketDecisionView {
  const setup = selectedSetup ?? result?.summary.highestRanked ?? null
  const marketLabel = humanMarketTrend(dow.trend)

  if (!setup) {
    return {
      side: 'WAIT',
      phase: 'NO SETUP',
      confidence: null,
      marketLabel,
      setupLabel: null,
      setup: null,
      reasonRows: [],
      stillWaiting: ['No qualifying setup yet'],
      nextAction: 'Wait for a clear market structure and setup to form.',
      summaryReason: result?.summary.reason ?? 'No valid setup currently exists',
    }
  }

  const phase = humanSetupStatus(setup.status)
  let side: TraderSide = 'WAIT'
  if (setup.status === 'READY') {
    side = setup.direction === 'BULLISH' ? 'BUY' : 'SELL'
  } else if (
    setup.status === 'WAITING_RETEST' ||
    setup.status === 'WATCHING'
  ) {
    side = setup.direction === 'BULLISH' ? 'BUY' : 'SELL'
  }

  // Stance override when engine says WAIT due to conflict
  if (result?.summary.stance === 'WAIT' && result.summary.conflictCount > 0) {
    side = 'WAIT'
  }
  if (setup.status === 'INVALIDATED' || setup.status === 'EXPIRED') {
    side = 'WAIT'
  }

  const checks = [...setup.requiredChecks, ...setup.optionalChecks.filter((c) => c.passed)]
  // Prefer a compact trader checklist: required + passed optional highlights
  const reasonRows: TraderReasonRow[] = []
  const seen = new Set<string>()
  for (const c of checks) {
    if (seen.has(c.name)) continue
    seen.add(c.name)
    // Skip soft conflict row noise when passed
    if (c.name === 'Conflict' && c.passed) continue
    reasonRows.push({
      passed: c.passed,
      label: humanCheckLabel(c),
      technicalName: c.name,
      technicalReason: c.reason,
    })
  }

  const stillWaiting = setup.missingChecks.map(humanMissingCondition)

  return {
    side,
    phase,
    confidence: setup.strength.score,
    marketLabel,
    setupLabel: humanSetupType(setup.setupType),
    setup,
    reasonRows,
    stillWaiting,
    nextAction: nextActionForSetup(setup, phase),
    summaryReason: setup.reason,
  }
}

/** Pick the best QML pattern for Setup Progress display (presentation only). */
export function pickProgressPattern(
  patterns: readonly QmlPattern[],
  setup: TradingSetup | null,
): QmlPattern | null {
  if (setup?.eventChain) {
    const qmlId = setup.eventChain.find((e) => e.role === 'qml')?.id
    if (qmlId) {
      const match = patterns.find((p) => p.id === qmlId)
      if (match) return match
    }
  }
  const ranked = [...patterns].sort((a, b) => {
    const rank = (s: QmlStatus) =>
      s === 'ENTRY_READY'
        ? 6
        : s === 'RETESTED'
          ? 5
          : s === 'ZONE_ACTIVE'
            ? 4
            : s === 'CONFIRMED'
              ? 3
              : s === 'CANDIDATE'
                ? 2
                : 1
    return rank(b.status) - rank(a.status) || b.setupStrength - a.setupStrength
  })
  return ranked[0] ?? null
}

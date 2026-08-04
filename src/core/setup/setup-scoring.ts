/**
 * Setup strength scoring — quality 0–100, not win probability.
 */

import type { SetupCheck, SetupScoreReason, SetupStrength, SetupType } from './setup-types'

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, Math.round(n)))
}

const TYPE_BASE: Partial<Record<SetupType, number>> = {
  BULLISH_CONTINUATION: 45,
  BEARISH_CONTINUATION: 45,
  BULLISH_REVERSAL: 48,
  BEARISH_REVERSAL: 48,
  BULLISH_QML: 50,
  BEARISH_QML: 50,
}

const CHECK_WEIGHT: Partial<Record<SetupCheck['name'], number>> = {
  Trend: 8,
  'Dow Theory': 6,
  Structure: 8,
  BOS: 10,
  CHOCH: 12,
  Liquidity: 4,
  Sweep: 8,
  Displacement: 8,
  FVG: 6,
  OB: 8,
  'Zone Lifecycle': 8,
  Retest: 10,
  QML: 12,
  Freshness: 5,
  Conflict: 10,
}

export interface ScoreSetupInput {
  setupType: SetupType
  requiredChecks: readonly SetupCheck[]
  optionalChecks: readonly SetupCheck[]
  warnings: readonly string[]
  qmlStrength?: number | null
}

export function scoreSetup(input: ScoreSetupInput): SetupStrength {
  const reasons: SetupScoreReason[] = []
  let score = TYPE_BASE[input.setupType] ?? 40
  reasons.push({
    id: 'base',
    label: `Base ${input.setupType}`,
    delta: score,
    reason: 'Type baseline quality',
  })

  for (const c of input.requiredChecks) {
    const weight = CHECK_WEIGHT[c.name] ?? 4
    if (c.passed) {
      score += weight
      reasons.push({
        id: `req-${c.name}`,
        label: `+${weight} ${c.name}`,
        delta: weight,
        reason: c.reason,
      })
    } else {
      score -= Math.round(weight * 0.75)
      reasons.push({
        id: `req-miss-${c.name}`,
        label: `-${Math.round(weight * 0.75)} missing ${c.name}`,
        delta: -Math.round(weight * 0.75),
        reason: c.reason,
      })
    }
  }

  for (const c of input.optionalChecks) {
    const weight = Math.max(2, Math.round((CHECK_WEIGHT[c.name] ?? 4) * 0.6))
    if (c.passed) {
      score += weight
      reasons.push({
        id: `opt-${c.name}`,
        label: `+${weight} optional ${c.name}`,
        delta: weight,
        reason: c.reason,
      })
    }
  }

  if (input.qmlStrength != null && Number.isFinite(input.qmlStrength)) {
    const delta = Math.round((input.qmlStrength - 50) * 0.25)
    if (delta !== 0) {
      score += delta
      reasons.push({
        id: 'qml-strength',
        label: `${delta >= 0 ? '+' : ''}${delta} QML strength blend`,
        delta,
        reason: `QML setupStrength ${input.qmlStrength}`,
      })
    }
  }

  for (const warning of input.warnings) {
    score -= 4
    reasons.push({
      id: `warn-${reasons.length}`,
      label: '-4 warning',
      delta: -4,
      reason: warning,
    })
  }

  const finalScore = clamp(score)
  if (finalScore !== score) {
    reasons.push({
      id: 'clamp',
      label: 'Clamped to 0–100',
      delta: finalScore - score,
      reason: 'Strength is quality only; never outside 0–100',
    })
  }

  return { score: finalScore, reasons }
}

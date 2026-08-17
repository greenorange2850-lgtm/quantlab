// ─── Playbook Engine — Setup Quality Scoring ──────────────────────────────────
//
// Strength (0-100) reflects setup quality ONLY — conformance to the playbook
// template. It never encodes win probability or risk/reward.

import type { PlaybookCheck, ZoneSnapshot } from './types.js'

export interface StrengthInput {
  checks: PlaybookCheck[]
  zone: ZoneSnapshot | null
  maxTouches: number
  maxZoneAge: number
}

export const REQUIRED_WEIGHT = 0.7
export const OPTIONAL_WEIGHT = 0.3

export function scoreSetupStrength(input: StrengthInput): number {
  const required = input.checks.filter((c) => c.required)
  const optional = input.checks.filter((c) => !c.required)

  const requiredPassed = required.filter((c) => c.passed).length
  const optionalPassed = optional.filter((c) => c.passed).length

  const requiredRatio = required.length > 0 ? requiredPassed / required.length : 0
  const optionalRatio = optional.length > 0 ? optionalPassed / optional.length : 1

  let score = (requiredRatio * REQUIRED_WEIGHT + optionalRatio * OPTIONAL_WEIGHT) * 100

  // Setup-quality modifiers — never probability-related.
  if (input.zone) {
    if (input.zone.touchedCount === 0) score += 3
    else if (input.zone.touchedCount <= Math.max(1, input.maxTouches / 2)) score += 1.5
    if (input.zone.ageBars <= Math.max(1, input.maxZoneAge / 3)) score += 2
    if (!input.zone.invalidated) score += 2
  }

  return clamp(round1(score))
}

export function clamp(n: number): number {
  return Math.min(100, Math.max(0, n))
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}

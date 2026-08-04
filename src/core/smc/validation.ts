import type { SmcDetectorConfig } from './types'
import { cloneSmcDetectorConfig, DEFAULT_SMC_DETECTOR_CONFIG } from './defaults'

export interface SmcConfigValidationResult {
  ok: boolean
  errors: string[]
  config: SmcDetectorConfig
}

const PIVOT_MIN = 1
const PIVOT_MAX = 50
const TOLERANCE_MIN = 0
const TOLERANCE_MAX = 5
const BREAK_PCT_MIN = 0
const BREAK_PCT_MAX = 10

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, Math.round(value)))
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, value))
}

/** Validate and sanitize SMC detector config. Never throws. */
export function validateSmcDetectorConfig(
  input: Partial<SmcDetectorConfig> | null | undefined,
): SmcConfigValidationResult {
  const errors: string[] = []
  const base = cloneSmcDetectorConfig(DEFAULT_SMC_DETECTOR_CONFIG)

  const swingIn = input?.swing
  const bosIn = input?.bos

  const pivotLeft = clampInt(swingIn?.pivotLeft ?? base.swing.pivotLeft, PIVOT_MIN, PIVOT_MAX)
  const pivotRight = clampInt(swingIn?.pivotRight ?? base.swing.pivotRight, PIVOT_MIN, PIVOT_MAX)
  const equalTolerancePercent = clampNumber(
    swingIn?.equalTolerancePercent ?? base.swing.equalTolerancePercent,
    TOLERANCE_MIN,
    TOLERANCE_MAX,
  )

  if (swingIn?.pivotLeft != null && swingIn.pivotLeft !== pivotLeft) {
    errors.push(`pivotLeft clamped to ${pivotLeft} (allowed ${PIVOT_MIN}–${PIVOT_MAX})`)
  }
  if (swingIn?.pivotRight != null && swingIn.pivotRight !== pivotRight) {
    errors.push(`pivotRight clamped to ${pivotRight} (allowed ${PIVOT_MIN}–${PIVOT_MAX})`)
  }
  if (
    swingIn?.equalTolerancePercent != null &&
    swingIn.equalTolerancePercent !== equalTolerancePercent
  ) {
    errors.push(
      `equalTolerancePercent clamped to ${equalTolerancePercent} (allowed ${TOLERANCE_MIN}–${TOLERANCE_MAX})`,
    )
  }

  const minimumBreakPercent = clampNumber(
    bosIn?.minimumBreakPercent ?? base.bos.minimumBreakPercent,
    BREAK_PCT_MIN,
    BREAK_PCT_MAX,
  )
  if (
    bosIn?.minimumBreakPercent != null &&
    bosIn.minimumBreakPercent !== minimumBreakPercent
  ) {
    errors.push(
      `minimumBreakPercent clamped to ${minimumBreakPercent} (allowed ${BREAK_PCT_MIN}–${BREAK_PCT_MAX})`,
    )
  }

  const breakMode = bosIn?.breakMode === 'CLOSE' ? 'CLOSE' : 'CLOSE'
  if (bosIn?.breakMode != null && bosIn.breakMode !== 'CLOSE') {
    errors.push('breakMode must be CLOSE in Phase 1; forced to CLOSE')
  }

  const config: SmcDetectorConfig = {
    swing: {
      enabled: swingIn?.enabled ?? base.swing.enabled,
      pivotLeft,
      pivotRight,
      equalTolerancePercent,
    },
    bos: {
      enabled: bosIn?.enabled ?? base.bos.enabled,
      breakMode,
      minimumBreakPercent,
      requireLatestConfirmedSwing:
        bosIn?.requireLatestConfirmedSwing ?? base.bos.requireLatestConfirmedSwing,
      allowRepeatedBreaksOfSameSwing:
        bosIn?.allowRepeatedBreaksOfSameSwing ?? base.bos.allowRepeatedBreaksOfSameSwing,
    },
  }

  return { ok: errors.length === 0, errors, config }
}

export const SMC_CONFIG_BOUNDS = {
  pivotMin: PIVOT_MIN,
  pivotMax: PIVOT_MAX,
  toleranceMin: TOLERANCE_MIN,
  toleranceMax: TOLERANCE_MAX,
  breakPctMin: BREAK_PCT_MIN,
  breakPctMax: BREAK_PCT_MAX,
} as const

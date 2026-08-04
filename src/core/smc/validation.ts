import type { SmcDetectorConfig } from './types'
import { cloneSmcDetectorConfig, DEFAULT_SMC_DETECTOR_CONFIG } from './defaults'

export interface SmcConfigValidationResult {
  ok: boolean
  errors: string[]
  warnings: string[]
  config: SmcDetectorConfig
}

const PIVOT_MIN = 1
const PIVOT_MAX = 50
const TOLERANCE_MIN = 0
const TOLERANCE_MAX = 5
const BREAK_PCT_MIN = 0
const BREAK_PCT_MAX = 10
const ATR_MIN = 2
const ATR_MAX = 100

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, Math.round(value)))
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, value))
}

function dependencyWarnings(config: SmcDetectorConfig): string[] {
  const warnings: string[] = []
  if (config.bos.enabled && !config.swing.enabled) {
    warnings.push('Break of Structure requires Market Swings — BOS will be inactive.')
  }
  if (config.choch.enabled && (!config.swing.enabled || !config.structure.enabled)) {
    warnings.push('CHoCH requires Market Swings and Structure — CHoCH will be inactive.')
  }
  if (
    config.liquiditySweep.enabled &&
    !config.swing.enabled &&
    !config.equalLevels.enabled
  ) {
    warnings.push(
      'Liquidity Sweep requires Swings or Equal Levels — sweep detection will be inactive.',
    )
  }
  if (config.orderBlock.enabled && !config.bos.enabled && !config.choch.enabled) {
    warnings.push('Order Block requires BOS or CHoCH — Order Block will be inactive.')
  }
  if (config.orderBlock.enabled && config.orderBlock.requireDisplacement && !config.displacement.enabled) {
    warnings.push(
      'Order Block requires displacement but Displacement is disabled — Order Block will be inactive.',
    )
  }
  if (config.orderBlock.enabled && config.orderBlock.requireFvg && !config.fvg.enabled) {
    warnings.push(
      'Order Block requires FVG but Fair Value Gap is disabled — Order Block will be inactive.',
    )
  }
  if (config.choch.enabled && config.choch.requireDisplacement && !config.displacement.enabled) {
    warnings.push(
      'CHoCH requires displacement but Displacement is disabled — CHoCH shifts needing displacement will not emit.',
    )
  }
  return warnings
}

/** Validate and sanitize SMC detector config. Never throws. */
export function validateSmcDetectorConfig(
  input: Partial<SmcDetectorConfig> | null | undefined,
): SmcConfigValidationResult {
  const errors: string[] = []
  const base = cloneSmcDetectorConfig(DEFAULT_SMC_DETECTOR_CONFIG)

  const swingIn = input?.swing
  const structureIn = input?.structure
  const bosIn = input?.bos
  const chochIn = input?.choch
  const dispIn = input?.displacement
  const fvgIn = input?.fvg
  const eqIn = input?.equalLevels
  const sweepIn = input?.liquiditySweep
  const obIn = input?.orderBlock

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
    errors.push('breakMode must be CLOSE; forced to CLOSE')
  }

  const config: SmcDetectorConfig = {
    swing: {
      enabled: swingIn?.enabled ?? base.swing.enabled,
      pivotLeft,
      pivotRight,
      equalTolerancePercent,
    },
    structure: {
      enabled: structureIn?.enabled ?? base.structure.enabled,
      internalPivotLeft: clampInt(
        structureIn?.internalPivotLeft ?? base.structure.internalPivotLeft,
        PIVOT_MIN,
        PIVOT_MAX,
      ),
      internalPivotRight: clampInt(
        structureIn?.internalPivotRight ?? base.structure.internalPivotRight,
        PIVOT_MIN,
        PIVOT_MAX,
      ),
      externalPivotLeft: clampInt(
        structureIn?.externalPivotLeft ?? base.structure.externalPivotLeft,
        PIVOT_MIN,
        PIVOT_MAX,
      ),
      externalPivotRight: clampInt(
        structureIn?.externalPivotRight ?? base.structure.externalPivotRight,
        PIVOT_MIN,
        PIVOT_MAX,
      ),
      minimumExternalProminencePercent: clampNumber(
        structureIn?.minimumExternalProminencePercent ??
          base.structure.minimumExternalProminencePercent,
        0,
        20,
      ),
      minimumExternalBarsApart: clampInt(
        structureIn?.minimumExternalBarsApart ?? base.structure.minimumExternalBarsApart,
        1,
        200,
      ),
    },
    bos: {
      enabled: bosIn?.enabled ?? base.bos.enabled,
      breakMode,
      minimumBreakPercent,
      requireLatestConfirmedSwing:
        bosIn?.requireLatestConfirmedSwing ?? base.bos.requireLatestConfirmedSwing,
      allowRepeatedBreaksOfSameSwing:
        bosIn?.allowRepeatedBreaksOfSameSwing ?? base.bos.allowRepeatedBreaksOfSameSwing,
      preferExternalSwings: bosIn?.preferExternalSwings ?? base.bos.preferExternalSwings,
      structureScope: bosIn?.structureScope ?? base.bos.structureScope,
    },
    choch: {
      enabled: chochIn?.enabled ?? base.choch.enabled,
      breakMode: 'CLOSE',
      minimumBreakPercent: clampNumber(
        chochIn?.minimumBreakPercent ?? base.choch.minimumBreakPercent,
        BREAK_PCT_MIN,
        BREAK_PCT_MAX,
      ),
      requireLatestConfirmedSwing:
        chochIn?.requireLatestConfirmedSwing ?? base.choch.requireLatestConfirmedSwing,
      preferExternalSwings: chochIn?.preferExternalSwings ?? base.choch.preferExternalSwings,
      structureScope: chochIn?.structureScope ?? base.choch.structureScope,
      requireDisplacement: chochIn?.requireDisplacement ?? base.choch.requireDisplacement,
    },
    displacement: {
      enabled: dispIn?.enabled ?? base.displacement.enabled,
      atrPeriod: clampInt(dispIn?.atrPeriod ?? base.displacement.atrPeriod, ATR_MIN, ATR_MAX),
      minimumBodyAtrMultiple: clampNumber(
        dispIn?.minimumBodyAtrMultiple ?? base.displacement.minimumBodyAtrMultiple,
        0,
        20,
      ),
      minimumBodyToRangeRatio: clampNumber(
        dispIn?.minimumBodyToRangeRatio ?? base.displacement.minimumBodyToRangeRatio,
        0,
        1,
      ),
      maximumOppositeWickRatio: clampNumber(
        dispIn?.maximumOppositeWickRatio ?? base.displacement.maximumOppositeWickRatio,
        0,
        1,
      ),
      requireStructureBreak:
        dispIn?.requireStructureBreak ?? base.displacement.requireStructureBreak,
      requireFvgCreation: dispIn?.requireFvgCreation ?? base.displacement.requireFvgCreation,
    },
    fvg: {
      enabled: fvgIn?.enabled ?? base.fvg.enabled,
      minimumGapPercent: clampNumber(
        fvgIn?.minimumGapPercent ?? base.fvg.minimumGapPercent,
        0,
        20,
      ),
      minimumGapAtrMultiple: clampNumber(
        fvgIn?.minimumGapAtrMultiple ?? base.fvg.minimumGapAtrMultiple,
        0,
        20,
      ),
      atrPeriod: clampInt(fvgIn?.atrPeriod ?? base.fvg.atrPeriod, ATR_MIN, ATR_MAX),
      requireDisplacementMiddleCandle:
        fvgIn?.requireDisplacementMiddleCandle ?? base.fvg.requireDisplacementMiddleCandle,
      trackMitigation: fvgIn?.trackMitigation ?? base.fvg.trackMitigation,
      mitigationMode: fvgIn?.mitigationMode ?? base.fvg.mitigationMode,
    },
    equalLevels: {
      enabled: eqIn?.enabled ?? base.equalLevels.enabled,
      tolerancePercent: clampNumber(
        eqIn?.tolerancePercent ?? base.equalLevels.tolerancePercent,
        0,
        5,
      ),
      minimumTouches: clampInt(eqIn?.minimumTouches ?? base.equalLevels.minimumTouches, 2, 20),
      minimumBarsApart: clampInt(
        eqIn?.minimumBarsApart ?? base.equalLevels.minimumBarsApart,
        1,
        200,
      ),
      useInternalSwings: eqIn?.useInternalSwings ?? base.equalLevels.useInternalSwings,
      useExternalSwings: eqIn?.useExternalSwings ?? base.equalLevels.useExternalSwings,
    },
    liquiditySweep: {
      enabled: sweepIn?.enabled ?? base.liquiditySweep.enabled,
      structureScope: sweepIn?.structureScope ?? base.liquiditySweep.structureScope,
      minimumPenetrationPercent: clampNumber(
        sweepIn?.minimumPenetrationPercent ?? base.liquiditySweep.minimumPenetrationPercent,
        0,
        20,
      ),
      maximumCloseDistancePercent: clampNumber(
        sweepIn?.maximumCloseDistancePercent ??
          base.liquiditySweep.maximumCloseDistancePercent,
        0,
        20,
      ),
      requireSameCandleRejection:
        sweepIn?.requireSameCandleRejection ?? base.liquiditySweep.requireSameCandleRejection,
      requireDisplacementAfterSweep:
        sweepIn?.requireDisplacementAfterSweep ??
        base.liquiditySweep.requireDisplacementAfterSweep,
      displacementConfirmationBars: clampInt(
        sweepIn?.displacementConfirmationBars ??
          base.liquiditySweep.displacementConfirmationBars,
        0,
        50,
      ),
      equalLevelTolerancePercent: clampNumber(
        sweepIn?.equalLevelTolerancePercent ??
          base.liquiditySweep.equalLevelTolerancePercent,
        0,
        5,
      ),
    },
    orderBlock: {
      enabled: obIn?.enabled ?? base.orderBlock.enabled,
      requireDisplacement: obIn?.requireDisplacement ?? base.orderBlock.requireDisplacement,
      requireFvg: obIn?.requireFvg ?? base.orderBlock.requireFvg,
      sourceBreak: obIn?.sourceBreak ?? base.orderBlock.sourceBreak,
      zoneMode: obIn?.zoneMode ?? base.orderBlock.zoneMode,
      searchBackBars: clampInt(obIn?.searchBackBars ?? base.orderBlock.searchBackBars, 1, 100),
      invalidationMode: obIn?.invalidationMode ?? base.orderBlock.invalidationMode,
      trackMitigation: obIn?.trackMitigation ?? base.orderBlock.trackMitigation,
      mitigationMode: obIn?.mitigationMode ?? base.orderBlock.mitigationMode,
    },
  }

  // Enforce dependency disablement without silently enabling hidden deps.
  if (config.bos.enabled && !config.swing.enabled) config.bos.enabled = false
  if (config.choch.enabled && (!config.swing.enabled || !config.structure.enabled)) {
    config.choch.enabled = false
  }
  if (
    config.liquiditySweep.enabled &&
    !config.swing.enabled &&
    !config.equalLevels.enabled
  ) {
    config.liquiditySweep.enabled = false
  }
  if (config.orderBlock.enabled && !config.bos.enabled && !config.choch.enabled) {
    config.orderBlock.enabled = false
  }
  if (
    config.orderBlock.enabled &&
    config.orderBlock.requireDisplacement &&
    !config.displacement.enabled
  ) {
    config.orderBlock.enabled = false
  }
  if (config.orderBlock.enabled && config.orderBlock.requireFvg && !config.fvg.enabled) {
    config.orderBlock.enabled = false
  }

  const warnings = dependencyWarnings(config)
  return { ok: errors.length === 0, errors, warnings, config }
}

export const SMC_CONFIG_BOUNDS = {
  pivotMin: PIVOT_MIN,
  pivotMax: PIVOT_MAX,
  toleranceMin: TOLERANCE_MIN,
  toleranceMax: TOLERANCE_MAX,
  breakPctMin: BREAK_PCT_MIN,
  breakPctMax: BREAK_PCT_MAX,
  atrMin: ATR_MIN,
  atrMax: ATR_MAX,
} as const

export function moduleDependencyReason(
  moduleId: string,
  config: SmcDetectorConfig,
): string | null {
  switch (moduleId) {
    case 'break-of-structure':
      return !config.swing.enabled ? 'Requires Market Swings' : null
    case 'choch':
      if (!config.swing.enabled) return 'Requires Market Swings'
      if (!config.structure.enabled) return 'Requires Internal / External Structure'
      return null
    case 'liquidity-sweep':
      if (!config.swing.enabled && !config.equalLevels.enabled) {
        return 'Requires Market Swings or Equal High / Equal Low'
      }
      return null
    case 'order-block':
      if (!config.bos.enabled && !config.choch.enabled) return 'Requires BOS or CHoCH'
      if (config.orderBlock.requireDisplacement && !config.displacement.enabled) {
        return 'Requires Displacement (per config)'
      }
      if (config.orderBlock.requireFvg && !config.fvg.enabled) {
        return 'Requires Fair Value Gap (per config)'
      }
      return null
    default:
      return null
  }
}

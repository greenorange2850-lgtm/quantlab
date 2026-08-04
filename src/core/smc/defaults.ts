import type { SmcDetectorConfig } from './types'

/** QuantLab Default baseline — Phase 2 modules enabled with conservative defaults. */
export const DEFAULT_SMC_DETECTOR_CONFIG: SmcDetectorConfig = {
  swing: {
    enabled: true,
    pivotLeft: 5,
    pivotRight: 5,
    equalTolerancePercent: 0,
  },
  structure: {
    enabled: true,
    internalPivotLeft: 3,
    internalPivotRight: 3,
    // Stricter external pivots: dominance vs next-best extreme (not full window range).
    externalPivotLeft: 10,
    externalPivotRight: 10,
    minimumExternalProminencePercent: 0.35,
    minimumExternalBarsApart: 16,
  },
  bos: {
    enabled: true,
    breakMode: 'CLOSE',
    minimumBreakPercent: 0,
    requireLatestConfirmedSwing: true,
    allowRepeatedBreaksOfSameSwing: false,
    preferExternalSwings: false,
    structureScope: 'BOTH',
  },
  choch: {
    enabled: true,
    breakMode: 'CLOSE',
    minimumBreakPercent: 0,
    requireLatestConfirmedSwing: true,
    preferExternalSwings: false,
    structureScope: 'BOTH',
    requireDisplacement: false,
  },
  displacement: {
    enabled: true,
    atrPeriod: 14,
    minimumBodyAtrMultiple: 1.2,
    minimumBodyToRangeRatio: 0.55,
    maximumOppositeWickRatio: 0.35,
    requireStructureBreak: false,
    requireFvgCreation: false,
  },
  fvg: {
    enabled: true,
    minimumGapPercent: 0.02,
    minimumGapAtrMultiple: 0,
    atrPeriod: 14,
    requireDisplacementMiddleCandle: false,
    trackMitigation: true,
    mitigationMode: 'TOUCH',
  },
  equalLevels: {
    enabled: true,
    tolerancePercent: 0.05,
    minimumTouches: 2,
    minimumBarsApart: 3,
    useInternalSwings: true,
    useExternalSwings: true,
  },
  liquiditySweep: {
    enabled: true,
    structureScope: 'BOTH',
    minimumPenetrationPercent: 0.02,
    maximumCloseDistancePercent: 1,
    requireSameCandleRejection: true,
    requireDisplacementAfterSweep: false,
    displacementConfirmationBars: 3,
    equalLevelTolerancePercent: 0.05,
    allowRepeatedSweepsOfSameLevel: false,
  },
  orderBlock: {
    enabled: true,
    requireDisplacement: true,
    requireFvg: false,
    sourceBreak: 'BOTH',
    zoneMode: 'FULL_CANDLE',
    searchBackBars: 10,
    invalidationMode: 'CLOSE_BEYOND',
    trackMitigation: true,
    mitigationMode: 'TOUCH',
  },
}

/**
 * Phase-1-compatible config: swings + BOS only.
 * Used by tests that assert Phase-1-only behavior when new modules are off.
 */
export const PHASE1_COMPAT_SMC_CONFIG: SmcDetectorConfig = {
  ...DEFAULT_SMC_DETECTOR_CONFIG,
  structure: { ...DEFAULT_SMC_DETECTOR_CONFIG.structure, enabled: false },
  choch: { ...DEFAULT_SMC_DETECTOR_CONFIG.choch, enabled: false },
  displacement: { ...DEFAULT_SMC_DETECTOR_CONFIG.displacement, enabled: false },
  fvg: { ...DEFAULT_SMC_DETECTOR_CONFIG.fvg, enabled: false },
  equalLevels: { ...DEFAULT_SMC_DETECTOR_CONFIG.equalLevels, enabled: false },
  liquiditySweep: { ...DEFAULT_SMC_DETECTOR_CONFIG.liquiditySweep, enabled: false },
  orderBlock: { ...DEFAULT_SMC_DETECTOR_CONFIG.orderBlock, enabled: false },
}

export function cloneSmcDetectorConfig(
  config: SmcDetectorConfig = DEFAULT_SMC_DETECTOR_CONFIG,
): SmcDetectorConfig {
  return {
    swing: { ...config.swing },
    structure: { ...config.structure },
    bos: { ...config.bos },
    choch: { ...config.choch },
    displacement: { ...config.displacement },
    fvg: { ...config.fvg },
    equalLevels: { ...config.equalLevels },
    liquiditySweep: { ...config.liquiditySweep },
    orderBlock: { ...config.orderBlock },
  }
}

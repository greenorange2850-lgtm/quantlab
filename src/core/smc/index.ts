export type {
  SmcDetectionKind,
  SmcDetectorConfig,
  SmcSwingConfig,
  SmcStructureConfig,
  SmcBosConfig,
  SmcChochConfig,
  SmcDisplacementConfig,
  SmcFvgConfig,
  SmcEqualLevelsConfig,
  SmcLiquiditySweepConfig,
  SmcOrderBlockConfig,
  SmcSwingEvent,
  SmcClassifiedSwingEvent,
  SmcBosEvent,
  SmcChochEvent,
  SmcDisplacementEvent,
  SmcFvgEvent,
  SmcEqualLevelEvent,
  SmcLiquiditySweepEvent,
  SmcOrderBlockEvent,
  SmcDetectionDiagnostics,
  SmcDetectionResult,
  SmcEvent,
  SmcEventRef,
  SmcStructureState,
  SmcSwingClassification,
  SmcInvariantCounts,
  SmcModuleTiming,
} from './types'
export { SMC_DETECTOR_VERSION } from './types'

export {
  DEFAULT_SMC_DETECTOR_CONFIG,
  PHASE1_COMPAT_SMC_CONFIG,
  cloneSmcDetectorConfig,
} from './defaults'

export {
  validateSmcDetectorConfig,
  SMC_CONFIG_BOUNDS,
  moduleDependencyReason,
  type SmcConfigValidationResult,
} from './validation'

export { detectConfirmedSwings } from './swing-detector'
export { detectBreakOfStructure } from './bos-detector'
export { classifyInternalExternalStructure } from './structure-classifier'
export { detectStructureBreaks } from './structure-breaks'
export { detectDisplacement, isDisplacementCandleAt } from './displacement-detector'
export { detectFairValueGaps } from './fvg-detector'
export { detectEqualLevels } from './equal-levels-detector'
export { detectLiquiditySweeps } from './liquidity-sweep-detector'
export { detectOrderBlocks } from './order-block-detector'
export {
  detectSmc,
  detectSmcUntil,
  resolveSmcConfig,
  emptySmcDetectionResult,
  eventsAtCandle,
} from './detection-pipeline'
export {
  auditSmcInvariants,
  sanitizeSmcDetectionResult,
  isValidBullishBos,
  isValidBearishBos,
  type SmcInvariantReport,
} from './invariants'

export {
  SMC_MODULES,
  SMC_DETECTION_MODULE_ORDER,
  listActiveSmcModules,
  listPlannedSmcModules,
  type SmcModuleDescriptor,
  type SmcModuleStatus,
  type SmcModuleConfigKey,
} from './modules'

export {
  BUILTIN_SMC_PROFILES,
  BUILTIN_SMC_PRESETS,
  QUANTLAB_DEFAULT_PROFILE,
  ICT_INSPIRED_PROFILE,
  SWING_STRUCTURE_PROFILE,
  INTERNAL_EXTERNAL_PROFILE,
  CUSTOM_PROFILE_TEMPLATE,
  getBuiltinSmcProfile,
  listBuiltinSmcProfiles,
  listBuiltinSmcPresets,
  countProfileEvents,
  describeCandleEventDifference,
  type SmcDetectionProfile,
  type SmcProfileId,
  type SmcConfigPreset,
  type SmcProfileCompareCounts,
} from './profiles'

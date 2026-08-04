export type {
  SmcDetectionKind,
  SmcDetectorConfig,
  SmcSwingConfig,
  SmcBosConfig,
  SmcSwingEvent,
  SmcBosEvent,
  SmcDetectionDiagnostics,
  SmcDetectionResult,
  SmcEvent,
} from './types'
export { SMC_DETECTOR_VERSION } from './types'

export {
  DEFAULT_SMC_DETECTOR_CONFIG,
  cloneSmcDetectorConfig,
} from './defaults'

export {
  validateSmcDetectorConfig,
  SMC_CONFIG_BOUNDS,
  type SmcConfigValidationResult,
} from './validation'

export { detectConfirmedSwings } from './swing-detector'
export { detectBreakOfStructure } from './bos-detector'
export { detectSmc, detectSmcUntil, resolveSmcConfig } from './detection-pipeline'
export {
  auditSmcInvariants,
  sanitizeSmcDetectionResult,
  isValidBullishBos,
  isValidBearishBos,
  type SmcInvariantReport,
} from './invariants'

export {
  SMC_MODULES,
  listActiveSmcModules,
  listPlannedSmcModules,
  type SmcModuleDescriptor,
  type SmcModuleStatus,
} from './modules'

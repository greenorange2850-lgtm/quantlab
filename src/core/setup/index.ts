export {
  SETUP_ENGINE_VERSION,
  DEFAULT_SETUP_ENGINE_CONFIG,
  SETUP_TYPES_V1,
  FUTURE_SETUP_TYPES,
  type SetupType,
  type SetupDirection,
  type SetupStatus,
  type SetupCheckName,
  type SetupCheck,
  type SetupScoreReason,
  type SetupStrength,
  type SetupEntryZone,
  type SetupStopReference,
  type SetupTargetCandidate,
  type SetupEventRef,
  type TradingSetup,
  type SetupConflict,
  type SetupSummaryStance,
  type SetupSummary,
  type SetupDiagnostics,
  type SetupReviewVerdict,
  type SetupReviewRecord,
  type SetupValidationMetrics,
  type SetupEngineConfig,
  type EvaluateSetupsInput,
  type SetupEngineResult,
} from './setup-types'

export {
  checkTrend,
  checkDowTheory,
  checkStructure,
  checkBos,
  checkChoch,
  checkLiquidity,
  checkSweep,
  checkDisplacement,
  checkFvg,
  checkOb,
  checkZoneLifecycle,
  checkRetest,
  checkQml,
  checkFreshness,
  checkConflictFlag,
  missingFromChecks,
  latestCreatedFvg,
  latestCreatedOb,
  latestDisplacement,
  latestOpposingSweep,
  findZoneForSource,
  qmlStatusAtVisibleIndex,
  rewindQmlPattern,
  type SetupCheckContext,
} from './setup-checks'

export { scoreSetup, type ScoreSetupInput } from './setup-scoring'

export {
  compareSetups,
  rankSetups,
  rankedSetupIds,
  pickHighestRanked,
} from './setup-ranking'

export { buildSetupSummary } from './setup-summary'

export {
  createSetupReview,
  computeSetupValidationMetrics,
  upsertSetupReview,
  reviewsBySetupType,
  isActionableStatus,
} from './setup-validator'

export {
  emptySetupDiagnostics,
  buildSetupDiagnostics,
} from './setup-diagnostics'

export {
  evaluateSetups,
  emptySetupEngineResult,
  toSetupVisualContext,
} from './setup-engine'

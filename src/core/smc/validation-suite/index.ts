export type {
  SmcValidationModule,
  SmcModuleAcceptanceStatus,
  SmcGoldenLabel,
  SmcGoldenDatasetScope,
  SmcGoldenDataset,
  SmcEventMatchTolerance,
  SmcDetectedEventProbe,
  SmcEventMatch,
  SmcModuleValidationMetrics,
  SmcLookAheadViolation,
  SmcProgressiveConsistencyReport,
  SmcWrongTagCount,
  SmcValidationReport,
  SmcAcceptanceGate,
} from './types'
export {
  DEFAULT_SMC_MATCH_TOLERANCE,
  SMC_ACCEPTANCE_GATES,
} from './types'

export {
  validationModuleForKind,
  scoreEventMatch,
  matchGoldenLabels,
} from './matching'

export {
  precisionRecall,
  reviewedAgreement,
  acceptanceStatusForModule,
  buildModuleMetrics,
  SMC_VALIDATION_MODULES,
} from './metrics'

export { toDetectedProbes, filterProbesByModule, qmlPatternToProbe } from './probes'

export {
  matchQmlGoldenLabels,
  DEFAULT_QML_MATCH_TOLERANCE,
  type QmlMatchTolerance,
  type QmlGoldenLabel,
} from './qml-matching'

export {
  validateProgressiveConsistency,
  earliestAppearanceIndex,
  eventsEqualByIdentity,
} from './progressive'

export {
  evaluateSmcValidation,
  goldenLabelFromProbe,
  createGoldenDatasetId,
  type SmcReviewSample,
  type EvaluateValidationInput,
} from './evaluate'

export type {
  ScoringObjective,
  ParameterRange,
  RandomSearchConstraints,
  RandomSearchConfig,
  AdaptiveStageBudget,
  SearchPresetId,
  ResearchSessionStatus,
  RandomSearchLiveStatus,
  OptimizationStageId,
  CandidateRejectionReason,
  RandomSearchCandidate,
  RandomSearchProgress,
  StageBudgetProgress,
  NewBestEvent,
  ImprovementEvent,
  OptimizationBaseline,
  StabilityLevel,
  ParameterStabilityDetail,
  StabilityResult,
  PlateauReason,
  PlateauResult,
  OptimizationVerdict,
  MetricChange,
  ParameterChange,
  RecommendationDecision,
  OptimizationResultSummary,
  ResearchSession,
  ResearchReport,
  ResearchAnalysisNarrative,
  ResearchRiskLevel,
  ResearchRating,
  RunRandomSearchOptions,
  PauseController,
} from './types.js'

export {
  DEFAULT_STAGE_BUDGET,
  OPTIMIZATION_RESULT_SCHEMA_VERSION,
} from './types.js'

export { scoreFromReport, passesConstraints } from './scoring.js'
export {
  validateParameterRanges,
  validateRandomSearchConfig,
  sampleStrategyParams,
  type RangeValidationIssue,
} from './sampling.js'
export { runRandomSearch, getProgressSnapshot } from './random-search.js'
export { runAdaptiveSearch } from './adaptive-search.js'
export {
  buildResearchReport,
  buildResearchAnalysisNarrative,
} from './build-research-report.js'
export {
  createEmptyProgress,
  deriveLiveSearchStatus,
  estimateRemainingMs,
  formatDurationMs,
  formatLiveStatusLabel,
  withElapsed,
  buildProgressPayload,
  createTimingState,
  DEFAULT_PROGRESS_THROTTLE_MS,
} from './progress.js'
export {
  createThrottledProgressHandler,
  type ThrottledProgressHandler,
  type ThrottledProgressHandlerOptions,
} from './progress-throttle.js'
export {
  yieldToBrowser,
  createAdaptiveBatchController,
  TARGET_BATCH_BUDGET_MS,
  type RandomSearchPerfDiagnostics,
  type AdaptiveBatchController,
} from './cooperative-schedule.js'
export {
  createRandomSearchRunControls,
  type RandomSearchRunControls,
  type CancelIntent,
} from './run-controls.js'

export { parameterFingerprint, UniqueCandidateTracker } from './fingerprint.js'
export { resolveStageBudgets, emptyStageProgress } from './stage-budget.js'
export {
  sampleNeighborhood,
  fixedStabilityNeighbors,
  selectRefinementCenters,
  estimateSearchSpaceSize,
} from './neighborhood.js'
export { analyzeStability } from './stability.js'
export {
  detectPlateau,
  plateauReasonLabel,
  DEFAULT_PLATEAU_UNIQUE_WINDOW,
  DEFAULT_PLATEAU_EPSILON,
} from './plateau.js'
export { selectRecommendedCandidate } from './recommendation.js'
export {
  buildMetricChanges,
  buildParameterChanges,
  deriveVerdict,
  ratingFromExistingMetrics,
} from './improvement-compare.js'
export { SEARCH_PRESETS, getSearchPreset, type SearchPresetDefinition } from './search-presets.js'
export { createPauseController } from './pause-controller.js'
export { isEligibleCandidate, collectRejectionReasons } from './rejection.js'

import type { ParameterRange } from './types.js'

/** Default MA Cross ranges for the Random Search UI. */
export const DEFAULT_MA_CROSS_RANGES: ParameterRange[] = [
  { name: 'fastPeriod', min: 5, max: 30, step: 1 },
  { name: 'slowPeriod', min: 20, max: 100, step: 1 },
  { name: 'rsiPeriod', min: 7, max: 21, step: 1 },
]

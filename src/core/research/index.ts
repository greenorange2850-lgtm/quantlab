export type {
  ScoringObjective,
  ParameterRange,
  RandomSearchConstraints,
  RandomSearchConfig,
  ResearchSessionStatus,
  RandomSearchLiveStatus,
  RandomSearchCandidate,
  RandomSearchProgress,
  ResearchSession,
  ResearchReport,
  ResearchAnalysisNarrative,
  ResearchRiskLevel,
  ResearchRating,
  RunRandomSearchOptions,
} from './types.js'

export { scoreFromReport, passesConstraints } from './scoring.js'
export {
  validateParameterRanges,
  validateRandomSearchConfig,
  sampleStrategyParams,
  type RangeValidationIssue,
} from './sampling.js'
export { runRandomSearch, getProgressSnapshot } from './random-search.js'
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

import type { ParameterRange } from './types.js'

/** Default MA Cross ranges for the Random Search UI. */
export const DEFAULT_MA_CROSS_RANGES: ParameterRange[] = [
  { name: 'fastPeriod', min: 5, max: 30, step: 1 },
  { name: 'slowPeriod', min: 20, max: 100, step: 1 },
  { name: 'rsiPeriod', min: 7, max: 21, step: 1 },
]

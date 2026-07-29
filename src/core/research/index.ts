export type {
  ScoringObjective,
  ParameterRange,
  RandomSearchConstraints,
  RandomSearchConfig,
  ResearchSessionStatus,
  RandomSearchCandidate,
  RandomSearchProgress,
  ResearchSession,
  ResearchReport,
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
export { buildResearchReport } from './build-research-report.js'

import type { ParameterRange } from './types.js'

/** Default MA Cross ranges for the Random Search UI. */
export const DEFAULT_MA_CROSS_RANGES: ParameterRange[] = [
  { name: 'fastPeriod', min: 5, max: 30, step: 1 },
  { name: 'slowPeriod', min: 20, max: 100, step: 1 },
  { name: 'rsiPeriod', min: 7, max: 21, step: 1 },
]

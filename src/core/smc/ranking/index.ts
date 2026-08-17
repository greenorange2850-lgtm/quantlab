export type {
  SmcVisibilityMode,
  SmcImportanceReason,
  SmcRankedEventMeta,
  SmcRankingDiagnostics,
  SmcIntelligenceLayer,
  SmcVisibilityPolicy,
  SmcVisibilityStageCounts,
  SmcVisibilityModuleBucket,
  SmcVisibilityPipelineDiagnostics,
} from './types'
export {
  SMC_RANKING_VERSION,
  SMC_VISIBILITY_POLICIES,
} from './types'

export { scoreSmcEvent, eventFamilyKey } from './score-event'
export {
  rankSmcDetectionResult,
  applySmcIntelligence,
  withSmcVisibilityMode,
  getEventImportance,
  isEventVisibleByRanking,
  filterDetectionByRanking,
  relatedEventsByRank,
} from './rank-events'
export {
  buildVisibilityPipelineDiagnostics,
  withRenderedCounts,
  visibilityModuleForKind,
} from './pipeline-diagnostics'

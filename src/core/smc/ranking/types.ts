/** Visibility modes for the intelligence layer (never delete events). */
export type SmcVisibilityMode = 'focus' | 'balanced' | 'debug'

export interface SmcImportanceReason {
  /** Signed contribution toward the final 0–100 score. */
  delta: number
  /** Human-readable factor, e.g. "+20 External Structure". */
  label: string
}

export interface SmcRankedEventMeta {
  eventId: string
  importanceScore: number
  importanceReasons: SmcImportanceReason[]
  /** True when this event passes the active visibility mode filter. */
  visible: boolean
}

export interface SmcRankingDiagnostics {
  detectedEvents: number
  visibleEvents: number
  hiddenByRanking: number
  averageImportance: number
  highestImportance: number
  lowestImportance: number
  mode: SmcVisibilityMode
  focusThreshold: number
  balancedThreshold: number
  focusMaxVisible: number
  balancedMaxVisible: number
}

export interface SmcIntelligenceLayer {
  /** Ranking schema version — independent of detectorVersion. */
  rankingVersion: string
  mode: SmcVisibilityMode
  byEventId: Record<string, SmcRankedEventMeta>
  /** Event ids sorted by importance descending. */
  rankedEventIds: string[]
  diagnostics: SmcRankingDiagnostics
}

export interface SmcVisibilityPolicy {
  mode: SmcVisibilityMode
  /** Minimum score to be considered (before max-cap trim). */
  minScore: number
  /** Hard cap on visible reviewable events (Debug = Infinity). */
  maxVisible: number
}

export const SMC_RANKING_VERSION = 'smc-rank-1'

export const SMC_VISIBILITY_POLICIES: Record<SmcVisibilityMode, SmcVisibilityPolicy> = {
  focus: { mode: 'focus', minScore: 70, maxVisible: 40 },
  balanced: { mode: 'balanced', minScore: 45, maxVisible: 80 },
  debug: { mode: 'debug', minScore: 0, maxVisible: Number.POSITIVE_INFINITY },
}

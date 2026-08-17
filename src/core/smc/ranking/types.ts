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

export interface SmcVisibilityStageCounts {
  detectorCount: number
  rankedCount: number
  visibleCount: number
  chartEligibleCount: number
  chartRenderedCount: number
  listRenderedCount: number
}

export type SmcVisibilityModuleBucket =
  | 'Swing'
  | 'BOS'
  | 'CHoCH'
  | 'Displacement'
  | 'FVG'
  | 'EqualLevel'
  | 'LiquiditySweep'
  | 'OrderBlock'
  | 'Other'

export interface SmcVisibilityPipelineDiagnostics {
  overall: SmcVisibilityStageCounts
  byModule: Record<SmcVisibilityModuleBucket, SmcVisibilityStageCounts>
  notes: string[]
  mode: string
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
  /** Per-stage visibility pipeline counts (detector → ranked → visible). */
  pipeline?: SmcVisibilityPipelineDiagnostics
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
  /** Minimum score for non-structure events (before max-cap trim). */
  minScore: number
  /**
   * Minimum score for BOS/CHoCH. Balanced uses 0 so detector structure
   * breaks are not accidentally wiped by the general floor.
   */
  structureMinScore: number
  /** Hard cap on visible reviewable events (Debug = Infinity). */
  maxVisible: number
  /** Prefer keeping BOS/CHoCH when trimming to maxVisible. */
  protectStructureBreaks: boolean
}

export const SMC_RANKING_VERSION = 'smc-rank-1.1'

export const SMC_VISIBILITY_POLICIES: Record<SmcVisibilityMode, SmcVisibilityPolicy> = {
  focus: {
    mode: 'focus',
    minScore: 70,
    structureMinScore: 70,
    maxVisible: 40,
    protectStructureBreaks: true,
  },
  balanced: {
    mode: 'balanced',
    minScore: 45,
    // Structure breaks use a separate floor so internal BOS (base ~52) and
    // CHoCH are not wiped by the general threshold or sweep-dominated top-N.
    structureMinScore: 0,
    maxVisible: 120,
    protectStructureBreaks: true,
  },
  debug: {
    mode: 'debug',
    minScore: 0,
    structureMinScore: 0,
    maxVisible: Number.POSITIVE_INFINITY,
    protectStructureBreaks: false,
  },
}

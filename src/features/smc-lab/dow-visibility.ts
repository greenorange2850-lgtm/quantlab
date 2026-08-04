import type {
  DowSwingLabel,
  SmcClassifiedSwingEvent,
  SmcDowSwingMeta,
  SmcIntelligenceLayer,
  SmcStructureEventProjection,
  SmcVisibilityMode,
} from '@/core/smc'
import type { SmcDensityPreset } from './persistence/types'
import { resolveDowSwingLabel } from './dow-label'

/** Non-null HH/HL/LH/LL — what users expect from the Dow labels toggle. */
export type DowClassifiedSwing = SmcClassifiedSwingEvent & {
  dowLabel: DowSwingLabel
}

export interface DowChartVisibilityDiagnostics {
  classifiedDowCount: number
  densityEligibleDowCount: number
  rankingVisibleDowCount: number
  chartRenderedDowCount: number
  hiddenByDensity: number
  hiddenByRanking: number
}

export interface DowChartVisibilityNotice {
  hiddenCount: number
  message: string
}

export interface DowChartVisibilityResult {
  /** Progressive classified swings that should render on the chart for Dow UX. */
  visibleSwings: SmcClassifiedSwingEvent[]
  visibleSwingIds: Set<string>
  /** Swings with non-null Dow class that survive both gates. */
  renderedDowSwings: DowClassifiedSwing[]
  diagnostics: DowChartVisibilityDiagnostics
  notice: DowChartVisibilityNotice | null
}

export interface ProjectDowChartVisibilityInput {
  classifiedSwings: readonly SmcClassifiedSwingEvent[]
  swingClassification: Record<string, DowSwingLabel | null>
  bySwingId?: Record<string, SmcDowSwingMeta>
  densityPreset: SmcDensityPreset
  visibilityMode: SmcVisibilityMode
  intelligence?: SmcIntelligenceLayer | null
  structureEvents?: readonly SmcStructureEventProjection[]
  selectedEventId?: string | null
  visibleIndex: number
  /** When false, notice is suppressed (toggle controls suffix only). */
  showDowTheoryLabels?: boolean
  /** How many top-ranked internal Dow swings Balanced protects. */
  balancedInternalProtectCount?: number
  /** Latest external count treated as "current" for Minimal/Focus. */
  currentExternalCount?: number
  /** Candle lookback for "currently relevant" externals. */
  recentContextBars?: number
}

function hasNonNullDowLabel(
  swing: SmcClassifiedSwingEvent,
  swingClassification: Record<string, DowSwingLabel | null>,
  bySwingId?: Record<string, SmcDowSwingMeta>,
): DowSwingLabel | null {
  const label = resolveDowSwingLabel(swing, swingClassification, bySwingId)
  return label ?? null
}

function latestExternalIds(
  swings: readonly SmcClassifiedSwingEvent[],
  count: number,
): Set<string> {
  return new Set(
    [...swings]
      .filter((s) => s.classification === 'EXTERNAL')
      .sort((a, b) => b.candleIndex - a.candleIndex || a.id.localeCompare(b.id))
      .slice(0, count)
      .map((s) => s.id),
  )
}

function isCurrentlyRelevantExternal(
  swing: SmcClassifiedSwingEvent,
  visibleIndex: number,
  currentExternalIds: Set<string>,
  structureById: Map<string, SmcStructureEventProjection>,
  recentContextBars: number,
): boolean {
  if (swing.classification !== 'EXTERNAL') return false
  if (currentExternalIds.has(swing.id)) return true
  if (visibleIndex - swing.candleIndex <= recentContextBars) return true
  const structure = structureById.get(swing.id)
  if (
    structure &&
    (structure.relevance === 'CURRENT_STRUCTURE' || structure.relevance === 'RECENT_CONTEXT')
  ) {
    return true
  }
  return false
}

function topRankedInternalIds(
  dowSwings: readonly DowClassifiedSwing[],
  intelligence: SmcIntelligenceLayer | null | undefined,
  protectCount: number,
): Set<string> {
  const internals = dowSwings.filter((s) => s.classification === 'INTERNAL')
  const ranked = [...internals].sort((a, b) => {
    const sa = intelligence?.byEventId[a.id]?.importanceScore ?? 0
    const sb = intelligence?.byEventId[b.id]?.importanceScore ?? 0
    if (sb !== sa) return sb - sa
    return b.candleIndex - a.candleIndex || a.id.localeCompare(b.id)
  })
  return new Set(ranked.slice(0, protectCount).map((s) => s.id))
}

function isFocusCurrent(
  swing: SmcClassifiedSwingEvent,
  selectedEventId: string | null | undefined,
  currentExternalIds: Set<string>,
  structureById: Map<string, SmcStructureEventProjection>,
): boolean {
  if (selectedEventId && swing.id === selectedEventId) return true
  if (currentExternalIds.has(swing.id)) return true
  const structure = structureById.get(swing.id)
  return structure?.relevance === 'CURRENT_STRUCTURE'
}

function densityAllows(
  swing: SmcClassifiedSwingEvent,
  densityPreset: SmcDensityPreset,
  relevantExternal: boolean,
): boolean {
  switch (densityPreset) {
    case 'full-debug':
      return true
    case 'structure':
      // All confirmed Dow swings are density-eligible; internals still need ranking.
      return true
    case 'minimal':
    case 'liquidity':
    default:
      // Preserve currently relevant external Dow swings only; hide internals.
      return swing.classification === 'EXTERNAL' && relevantExternal
  }
}

function intelligenceAllows(
  swing: SmcClassifiedSwingEvent,
  mode: SmcVisibilityMode,
  selectedEventId: string | null | undefined,
  currentExternalIds: Set<string>,
  structureById: Map<string, SmcStructureEventProjection>,
  protectedInternalIds: Set<string>,
  intelligence: SmcIntelligenceLayer | null | undefined,
): boolean {
  if (mode === 'debug') return true
  if (mode === 'focus') {
    return isFocusCurrent(swing, selectedEventId, currentExternalIds, structureById)
  }
  // Balanced: protect all external Dow swings + top-ranked internals.
  if (swing.classification === 'EXTERNAL') return true
  if (protectedInternalIds.has(swing.id)) return true
  // Also keep ranking-visible internals when the floor already admitted them.
  return intelligence?.byEventId[swing.id]?.visible === true
}

/**
 * Project which Dow-classified swings should appear on the chart.
 *
 * Density + Intelligence gates only — does not change Dow algorithm or id join.
 * The Show Dow Theory labels toggle is applied later for suffix formatting only.
 */
export function projectDowChartVisibility(
  input: ProjectDowChartVisibilityInput,
): DowChartVisibilityResult {
  const {
    classifiedSwings,
    swingClassification,
    bySwingId,
    densityPreset,
    visibilityMode,
    intelligence = null,
    structureEvents = [],
    selectedEventId = null,
    visibleIndex,
    showDowTheoryLabels = true,
    balancedInternalProtectCount = 6,
    currentExternalCount = 4,
    recentContextBars = 48,
  } = input

  const structureById = new Map(structureEvents.map((s) => [s.eventId, s]))
  const currentExternalIds = latestExternalIds(classifiedSwings, currentExternalCount)

  const dowSwings: DowClassifiedSwing[] = []
  for (const swing of classifiedSwings) {
    const dowLabel = hasNonNullDowLabel(swing, swingClassification, bySwingId)
    if (dowLabel == null) continue
    dowSwings.push({ ...swing, dowLabel })
  }

  const protectedInternalIds = topRankedInternalIds(
    dowSwings,
    intelligence,
    balancedInternalProtectCount,
  )

  const densityEligible: DowClassifiedSwing[] = []
  const rankingVisible: DowClassifiedSwing[] = []
  const rendered: DowClassifiedSwing[] = []

  for (const swing of dowSwings) {
    const relevantExternal = isCurrentlyRelevantExternal(
      swing,
      visibleIndex,
      currentExternalIds,
      structureById,
      recentContextBars,
    )
    const densityOk = densityAllows(swing, densityPreset, relevantExternal)
    const rankingOk = intelligenceAllows(
      swing,
      visibilityMode,
      selectedEventId,
      currentExternalIds,
      structureById,
      protectedInternalIds,
      intelligence,
    )

    // Structure: show ranked-visible internals (and all externals that pass intelligence).
    const structureInternalOk =
      densityPreset !== 'structure' ||
      swing.classification === 'EXTERNAL' ||
      rankingOk

    if (densityOk) densityEligible.push(swing)
    if (rankingOk) rankingVisible.push(swing)
    if (densityOk && rankingOk && structureInternalOk) rendered.push(swing)
  }

  // Include seed / unlabeled classified swings that share ids with rendered Dow set? No —
  // chart still shows other structure swings via the normal ranking/lifecycle path.
  // We only *protect* Dow-labeled swings that would otherwise be stripped.
  const visibleSwingIds = new Set(rendered.map((s) => s.id))
  const visibleSwings = classifiedSwings.filter((s) => visibleSwingIds.has(s.id))

  const classifiedDowCount = dowSwings.length
  const densityEligibleDowCount = densityEligible.length
  const rankingVisibleDowCount = rankingVisible.length
  const chartRenderedDowCount = rendered.length
  const hiddenByDensity = Math.max(0, classifiedDowCount - densityEligibleDowCount)
  const hiddenByRanking = Math.max(0, densityEligibleDowCount - chartRenderedDowCount)

  const diagnostics: DowChartVisibilityDiagnostics = {
    classifiedDowCount,
    densityEligibleDowCount,
    rankingVisibleDowCount,
    chartRenderedDowCount,
    hiddenByDensity,
    hiddenByRanking,
  }

  const hiddenCount = Math.max(0, classifiedDowCount - chartRenderedDowCount)
  const notice: DowChartVisibilityNotice | null =
    showDowTheoryLabels && classifiedDowCount > 0 && chartRenderedDowCount === 0
      ? {
          hiddenCount,
          message: `Dow labels are enabled; ${hiddenCount} classification${
            hiddenCount === 1 ? ' is' : 's are'
          } hidden by Density or Intelligence visibility.`,
        }
      : showDowTheoryLabels && hiddenCount > 0 && chartRenderedDowCount > 0
        ? null // Partial hide is OK when some labels still render — no scary empty-state notice.
        : null

  // Stronger empty-state: also notice when some render but user asked for notice when
  // "classifications exist but none render" — handled above. When all hidden, notice fires.

  return {
    visibleSwings,
    visibleSwingIds,
    renderedDowSwings: rendered,
    diagnostics,
    notice,
  }
}

/** Merge Dow-protected swings into a chart classified-swing list (stable, unique by id). */
export function mergeDowProtectedSwings(
  base: readonly SmcClassifiedSwingEvent[],
  dowProtected: readonly SmcClassifiedSwingEvent[],
): SmcClassifiedSwingEvent[] {
  const byId = new Map<string, SmcClassifiedSwingEvent>()
  for (const s of base) byId.set(s.id, s)
  for (const s of dowProtected) {
    if (!byId.has(s.id)) byId.set(s.id, s)
  }
  return [...byId.values()].sort(
    (a, b) => a.candleIndex - b.candleIndex || a.id.localeCompare(b.id),
  )
}

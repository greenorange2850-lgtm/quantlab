import type { ZoneLifecycleMeta, ZoneLifecycleReport } from './zone-lifecycle-types'

/** Chart-facing zone lifecycle states (projection only — not detector enums). */
export type SmcChartZoneState =
  | 'ACTIVE'
  | 'TOUCHED'
  | 'PARTIALLY_MITIGATED'
  | 'MITIGATED'
  | 'FILLED'
  | 'INVALIDATED'
  | 'EXPIRED'
  | 'SWEPT'
  | 'BROKEN'
  | 'SUPERSEDED'
  | 'NEW'
  | 'PARTIAL'
  | 'SWEEPED'
  | 'CONSUMED'

export type SmcZoneKind =
  | 'FVG'
  | 'ORDER_BLOCK'
  | 'EQUAL_LEVEL'
  | 'LIQUIDITY_LEVEL'
  | 'QML'

export type SmcStructureRelevance =
  | 'CURRENT_STRUCTURE'
  | 'SETUP_REFERENCED'
  | 'RECENT_CONTEXT'
  | 'HISTORICAL'
  | 'HIDDEN_BY_DEFAULT'

/** Smart chart visibility presets (orthogonal to ranking Focus/Balanced/Debug). */
export type SmcSmartVisibilityPreset =
  | 'active-only'
  | 'setup-focus'
  | 'balanced'
  | 'history'
  | 'debug'

export interface SmcZoneProjection {
  zoneId: string
  zoneKind: SmcZoneKind
  direction: 'BULLISH' | 'BEARISH'
  sourceEventId: string
  startIndex: number
  /** Inclusive end candle index for chart extent. */
  endIndex: number
  low: number
  high: number
  midpoint?: number
  state: SmcChartZoneState
  firstTouchIndex?: number
  mitigationIndex?: number
  invalidationIndex?: number
  expirationIndex?: number
  /** True when the zone is still valid at the progressive visible index. */
  activeAtVisibleIndex: boolean
  setupRefs: string[]
  lifecycleReason: string
  shortLabel: string
  fullLabel: string
  /** Why the zone remains visible / is hidden under the active preset. */
  visibilityReason: string
  extendsToVisibleEdge: boolean
  /** Phase 6 managed lifecycle metadata (optional for backward compat). */
  lifecycle?: ZoneLifecycleMeta
}

export interface SmcStructureEventProjection {
  eventId: string
  kind: string
  candleIndex: number
  relevance: SmcStructureRelevance
  visible: boolean
  reason: string
}

export interface SmcSetupVisualContext {
  setupId: string
  direction: 'BULLISH' | 'BEARISH'
  status:
    | 'WATCHING'
    | 'WAITING_RETEST'
    | 'RETESTED'
    | 'READY'
    | 'INVALIDATED'
    | 'COMPLETED'
    | 'EXPIRED'
  eventIds: string[]
  zoneIds: string[]
  entryZone?: { low: number; high: number }
  stopLevel?: number
  targetLevels?: number[]
}

export interface SmcZoneLifecycleSettings {
  showActive: boolean
  showTouched: boolean
  showMitigatedFilled: boolean
  showInvalidated: boolean
  extendActiveZonesRight: boolean
  fadeOldActiveZones: boolean
}

export const DEFAULT_ZONE_LIFECYCLE_SETTINGS: SmcZoneLifecycleSettings = {
  showActive: true,
  showTouched: true,
  showMitigatedFilled: false,
  showInvalidated: false,
  extendActiveZonesRight: true,
  fadeOldActiveZones: true,
}

export interface SmcLifecycleDiagnostics {
  fvgActiveUntouched: number
  fvgTouched: number
  fvgPartiallyMitigated: number
  fvgFilled: number
  fvgInvalidated: number
  fvgHiddenByVisibility: number
  obFresh: number
  obTouched: number
  obPartial: number
  obMitigated: number
  obInvalidated: number
  obHiddenByVisibility: number
  liquidityActiveUnswept: number
  liquiditySwept: number
  liquidityBroken: number
  liquiditySuperseded: number
  zonesExtendingToVisibleIndex: number
  zonesClippedAtTerminal: number
  setupForcedVisible: number
  hiddenByLifecycle: number
  hiddenByRanking: number
  hiddenByLayerToggle: number
  invariants: SmcLifecycleInvariantCounts
  status: 'COMPLETE' | 'FAILED'
  invariantDetails: string[]
}

export interface SmcLifecycleInvariantCounts {
  filledFvgExtendingPastFill: number
  invalidatedFvgExtendingPastInvalidation: number
  mitigatedObRenderedActive: number
  invalidatedObExtendingRight: number
  sweptLiquidityExtendingPastSweep: number
  brokenLiquidityRenderedActive: number
  activeUntouchedMissingUnexplained: number
  setupReferencedHidden: number
  ok: boolean
}

export interface SmcLifecycleProjectionResult {
  visibleIndex: number
  preset: SmcSmartVisibilityPreset
  zones: SmcZoneProjection[]
  /** Zones after smart-visibility filter (what the chart should draw). */
  visibleZones: SmcZoneProjection[]
  /** Phase 6 managed zones (source of truth for lifecycle metadata). */
  managedZones: ZoneLifecycleMeta[]
  /** Phase 6 aggregate lifecycle report. */
  lifecycleReport: ZoneLifecycleReport
  structureEvents: SmcStructureEventProjection[]
  setup: SmcSetupVisualContext | null
  diagnostics: SmcLifecycleDiagnostics
  settings: SmcZoneLifecycleSettings
}

export function emptyLifecycleInvariantCounts(): SmcLifecycleInvariantCounts {
  return {
    filledFvgExtendingPastFill: 0,
    invalidatedFvgExtendingPastInvalidation: 0,
    mitigatedObRenderedActive: 0,
    invalidatedObExtendingRight: 0,
    sweptLiquidityExtendingPastSweep: 0,
    brokenLiquidityRenderedActive: 0,
    activeUntouchedMissingUnexplained: 0,
    setupReferencedHidden: 0,
    ok: true,
  }
}

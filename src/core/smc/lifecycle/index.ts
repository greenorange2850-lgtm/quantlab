export type {
  SmcChartZoneState,
  SmcZoneKind,
  SmcStructureRelevance,
  SmcSmartVisibilityPreset,
  SmcZoneProjection,
  SmcStructureEventProjection,
  SmcSetupVisualContext,
  SmcZoneLifecycleSettings,
  SmcLifecycleDiagnostics,
  SmcLifecycleInvariantCounts,
  SmcLifecycleProjectionResult,
} from './types'
export {
  DEFAULT_ZONE_LIFECYCLE_SETTINGS,
  emptyLifecycleInvariantCounts,
} from './types'

export { projectFvgZones } from './project-fvg'
export { projectOrderBlockZones } from './project-ob'
export { projectLiquidityZones } from './project-liquidity'
export {
  filterZonesBySmartVisibility,
  projectStructureRelevance,
} from './visibility'
export { auditLifecycleProjectionInvariants } from './invariants'
export {
  projectSmcLifecycle,
  createMockSetupVisualContext,
  type ProjectSmcLifecycleInput,
} from './project'

export {
  ZONE_LIFECYCLE_VERSION,
  DEFAULT_EXPIRE_AFTER_CANDLES,
  type ZoneLifecycleState,
  type ZoneLifecycleType,
  type ZoneLifecycleDirection,
  type ZoneLifecycleFamily,
  type ZoneLifecycleMeta,
  type ZoneLifecycleTransitionInput,
  type ZoneLifecycleTransitionResult,
  type ZoneLifecycleEngineInput,
  type ZoneLifecycleEngineResult,
  type ZoneLifecycleRenderStyle,
  type ZoneLifecycleVisibilityMode,
  type ZoneLifecycleReport,
} from './zone-lifecycle-types'
export {
  transitionZoneLifecycle,
  isLiveLifecycleState,
  isTerminalLifecycleState,
} from './zone-lifecycle-transition'
export {
  runZoneLifecycleEngine,
  filterZonesByLifecycleVisibility,
} from './zone-lifecycle-engine'
export {
  renderStyleForLifecycleState,
  renderStyleForZone,
  toChartZoneState,
  fromChartZoneState,
  lifecycleStateLabel,
} from './zone-lifecycle-render'
export { buildZoneLifecycleReport } from './zone-lifecycle-report'
export { managedZoneToProjection } from './zone-lifecycle-bridge'

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

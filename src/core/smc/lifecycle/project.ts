import type { SmcDetectionResult } from '../types'
import { projectQmlZones } from '../qml'
import { auditLifecycleProjectionInvariants } from './invariants'
import {
  DEFAULT_ZONE_LIFECYCLE_SETTINGS,
  type SmcLifecycleDiagnostics,
  type SmcLifecycleProjectionResult,
  type SmcSetupVisualContext,
  type SmcSmartVisibilityPreset,
  type SmcZoneLifecycleSettings,
} from './types'
import { filterZonesBySmartVisibility, projectStructureRelevance } from './visibility'
import { managedZoneToProjection } from './zone-lifecycle-bridge'
import { runZoneLifecycleEngine } from './zone-lifecycle-engine'
import { buildZoneLifecycleReport } from './zone-lifecycle-report'

export interface ProjectSmcLifecycleInput {
  detection: SmcDetectionResult
  visibleIndex: number
  preset?: SmcSmartVisibilityPreset
  settings?: Partial<SmcZoneLifecycleSettings>
  setup?: SmcSetupVisualContext | null
}

function buildDiagnostics(
  zones: SmcLifecycleProjectionResult['zones'],
  visibleZones: SmcLifecycleProjectionResult['visibleZones'],
  setupZoneIds: Set<string> | undefined,
): SmcLifecycleDiagnostics {
  const { counts, details } = auditLifecycleProjectionInvariants(
    zones,
    visibleZones,
    setupZoneIds,
  )

  const hiddenByLifecycle = zones.length - visibleZones.length

  return {
    fvgActiveUntouched: zones.filter(
      (z) => z.zoneKind === 'FVG' && z.state === 'ACTIVE',
    ).length,
    fvgTouched: zones.filter((z) => z.zoneKind === 'FVG' && z.state === 'TOUCHED').length,
    fvgPartiallyMitigated: zones.filter(
      (z) => z.zoneKind === 'FVG' && z.state === 'PARTIALLY_MITIGATED',
    ).length,
    fvgFilled: zones.filter((z) => z.zoneKind === 'FVG' && z.state === 'FILLED').length,
    fvgInvalidated: zones.filter(
      (z) => z.zoneKind === 'FVG' && z.state === 'INVALIDATED',
    ).length,
    fvgHiddenByVisibility: zones.filter(
      (z) => z.zoneKind === 'FVG' && !visibleZones.some((v) => v.zoneId === z.zoneId),
    ).length,
    obFresh: zones.filter((z) => z.zoneKind === 'ORDER_BLOCK' && z.state === 'ACTIVE')
      .length,
    obTouched: zones.filter((z) => z.zoneKind === 'ORDER_BLOCK' && z.state === 'TOUCHED')
      .length,
    obPartial: zones.filter(
      (z) => z.zoneKind === 'ORDER_BLOCK' && z.state === 'PARTIALLY_MITIGATED',
    ).length,
    obMitigated: zones.filter(
      (z) => z.zoneKind === 'ORDER_BLOCK' && z.state === 'MITIGATED',
    ).length,
    obInvalidated: zones.filter(
      (z) => z.zoneKind === 'ORDER_BLOCK' && z.state === 'INVALIDATED',
    ).length,
    obHiddenByVisibility: zones.filter(
      (z) =>
        z.zoneKind === 'ORDER_BLOCK' && !visibleZones.some((v) => v.zoneId === z.zoneId),
    ).length,
    liquidityActiveUnswept: zones.filter(
      (z) =>
        (z.zoneKind === 'LIQUIDITY_LEVEL' || z.zoneKind === 'EQUAL_LEVEL') &&
        z.state === 'ACTIVE',
    ).length,
    liquiditySwept: zones.filter(
      (z) =>
        (z.zoneKind === 'LIQUIDITY_LEVEL' || z.zoneKind === 'EQUAL_LEVEL') &&
        (z.state === 'SWEPT' || z.state === 'SWEEPED'),
    ).length,
    liquidityBroken: zones.filter(
      (z) =>
        (z.zoneKind === 'LIQUIDITY_LEVEL' || z.zoneKind === 'EQUAL_LEVEL') &&
        z.state === 'BROKEN',
    ).length,
    liquiditySuperseded: zones.filter(
      (z) =>
        (z.zoneKind === 'LIQUIDITY_LEVEL' || z.zoneKind === 'EQUAL_LEVEL') &&
        (z.state === 'SUPERSEDED' || z.state === 'CONSUMED'),
    ).length,
    zonesExtendingToVisibleIndex: visibleZones.filter((z) => z.extendsToVisibleEdge).length,
    zonesClippedAtTerminal: visibleZones.filter((z) => !z.extendsToVisibleEdge).length,
    setupForcedVisible: visibleZones.filter((z) => z.visibilityReason.includes('Setup')).length,
    hiddenByLifecycle,
    hiddenByRanking: 0,
    hiddenByLayerToggle: 0,
    invariants: counts,
    status: counts.ok ? 'COMPLETE' : 'FAILED',
    invariantDetails: details,
  }
}

/**
 * Derive chart zone projections + smart visibility from detector events.
 * Pure / deterministic. Does not mutate detection arrays.
 */
export function projectSmcLifecycle(
  input: ProjectSmcLifecycleInput,
): SmcLifecycleProjectionResult {
  const preset = input.preset ?? 'balanced'
  const settings: SmcZoneLifecycleSettings = {
    ...DEFAULT_ZONE_LIFECYCLE_SETTINGS,
    ...input.settings,
  }
  const visibleIndex = Math.max(0, input.visibleIndex)
  const detection = input.detection
  const setup = input.setup ?? null
  const setupZoneIds = setup ? new Set(setup.zoneIds) : undefined
  const setupEventIds = setup ? new Set(setup.eventIds) : undefined

  // Phase 6 lifecycle manager — projection only; detectors untouched.
  const managed = runZoneLifecycleEngine({
    fvgEvents: detection.fvgEvents,
    orderBlockEvents: detection.orderBlockEvents,
    equalLevelEvents: detection.equalLevelEvents,
    liquiditySweepEvents: detection.liquiditySweepEvents,
    visibleIndex,
    extendActiveRight: settings.extendActiveZonesRight,
  })
  const lifecycleReport = buildZoneLifecycleReport(managed.zones)

  const managedZones = managed.zones.map((meta) => {
    const setupRefs =
      setupZoneIds?.has(meta.id) && setup ? [setup.setupId] : ([] as string[])
    return managedZoneToProjection(meta, setupRefs)
  })

  // QML zones are projected separately (derived layer, not zone-lifecycle manager).
  const qmlZones = projectQmlZones(detection.qml?.patterns ?? [], visibleIndex, {
    extendActiveRight: settings.extendActiveZonesRight,
  }).map((z) =>
    setupZoneIds?.has(z.zoneId) && setup
      ? { ...z, setupRefs: [...new Set([...z.setupRefs, setup.setupId])] }
      : z,
  )

  const zones = [...managedZones, ...qmlZones]

  const visibleZones = filterZonesBySmartVisibility(
    zones,
    preset === 'setup-focus' && !setup ? 'balanced' : preset,
    settings,
    setupZoneIds,
  )

  const structureEvents = projectStructureRelevance(
    detection,
    visibleIndex,
    preset === 'setup-focus' && !setup ? 'balanced' : preset,
    setupEventIds,
  )

  const diagnostics = buildDiagnostics(zones, visibleZones, setupZoneIds)

  return {
    visibleIndex,
    preset,
    zones,
    visibleZones,
    managedZones: managed.zones,
    lifecycleReport,
    structureEvents,
    setup,
    diagnostics,
    settings,
  }
}

/** Mock setup context for UI testing until Setup Builder exists. */
export function createMockSetupVisualContext(
  detection: SmcDetectionResult,
  visibleIndex: number,
): SmcSetupVisualContext | null {
  const bos = detection.bosEvents.filter((e) => e.candleIndex <= visibleIndex).at(-1)
  const fvg = detection.fvgEvents.find(
    (e) =>
      (e.kind === 'BULLISH_FVG_CREATED' || e.kind === 'BEARISH_FVG_CREATED') &&
      e.candleIndex <= visibleIndex,
  )
  const ob = detection.orderBlockEvents.find(
    (e) =>
      (e.kind === 'BULLISH_ORDER_BLOCK_CREATED' ||
        e.kind === 'BEARISH_ORDER_BLOCK_CREATED') &&
      e.candleIndex <= visibleIndex,
  )
  const sweep = detection.liquiditySweepEvents.filter((e) => e.candleIndex <= visibleIndex).at(-1)
  if (!bos && !fvg && !ob) return null

  const direction =
    bos?.kind.startsWith('BULLISH') || fvg?.direction === 'BULLISH' || ob?.direction === 'BULLISH'
      ? 'BULLISH'
      : 'BEARISH'

  const eventIds = [bos?.id, fvg?.id, ob?.id, sweep?.id].filter(Boolean) as string[]
  const zoneIds = [fvg?.fvgId, ob?.orderBlockId].filter(Boolean) as string[]

  return {
    setupId: 'mock-setup-1',
    direction,
    status: 'WATCHING',
    eventIds,
    zoneIds,
    entryZone: ob
      ? { low: ob.zoneLow, high: ob.zoneHigh }
      : fvg
        ? { low: fvg.lowerBoundary, high: fvg.upperBoundary }
        : undefined,
    stopLevel: ob
      ? direction === 'BULLISH'
        ? ob.zoneLow
        : ob.zoneHigh
      : undefined,
    targetLevels: sweep ? [sweep.sweptLevel] : undefined,
  }
}

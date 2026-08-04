import type { SmcLifecycleInvariantCounts, SmcZoneProjection } from './types'
import { emptyLifecycleInvariantCounts } from './types'

/** Projection invariants — all must be zero for COMPLETE. */
export function auditLifecycleProjectionInvariants(
  zones: readonly SmcZoneProjection[],
  visibleZones: readonly SmcZoneProjection[],
  setupZoneIds?: ReadonlySet<string>,
): { counts: SmcLifecycleInvariantCounts; details: string[] } {
  const counts = emptyLifecycleInvariantCounts()
  const details: string[] = []

  for (const zone of zones) {
    if (zone.zoneKind === 'FVG' && zone.state === 'FILLED' && zone.mitigationIndex != null) {
      if (zone.endIndex > zone.mitigationIndex) {
        counts.filledFvgExtendingPastFill += 1
        details.push(`Filled FVG ${zone.zoneId} extends past fill candle ${zone.mitigationIndex}`)
      }
    }
    if (zone.zoneKind === 'FVG' && zone.state === 'INVALIDATED' && zone.invalidationIndex != null) {
      if (zone.endIndex > zone.invalidationIndex) {
        counts.invalidatedFvgExtendingPastInvalidation += 1
        details.push(
          `Invalidated FVG ${zone.zoneId} extends past invalidation ${zone.invalidationIndex}`,
        )
      }
    }
    if (zone.zoneKind === 'ORDER_BLOCK' && zone.state === 'MITIGATED') {
      const drawnActive = visibleZones.some(
        (v) => v.zoneId === zone.zoneId && v.activeAtVisibleIndex && v.state === 'ACTIVE',
      )
      if (drawnActive) {
        counts.mitigatedObRenderedActive += 1
        details.push(`Mitigated OB ${zone.zoneId} rendered as active`)
      }
      if (zone.mitigationIndex != null && zone.endIndex > zone.mitigationIndex) {
        counts.mitigatedObRenderedActive += 1
        details.push(`Mitigated OB ${zone.zoneId} extends past mitigation candle`)
      }
    }
    if (
      zone.zoneKind === 'ORDER_BLOCK' &&
      zone.state === 'INVALIDATED' &&
      zone.invalidationIndex != null &&
      zone.endIndex > zone.invalidationIndex
    ) {
      counts.invalidatedObExtendingRight += 1
      details.push(`Invalidated OB ${zone.zoneId} extends past invalidation`)
    }
    if (
      (zone.zoneKind === 'LIQUIDITY_LEVEL' || zone.zoneKind === 'EQUAL_LEVEL') &&
      (zone.state === 'SWEPT' || zone.state === 'SWEEPED') &&
      zone.mitigationIndex != null &&
      zone.endIndex > zone.mitigationIndex
    ) {
      counts.sweptLiquidityExtendingPastSweep += 1
      details.push(`Swept liquidity ${zone.zoneId} extends past sweep`)
    }
    if (
      (zone.zoneKind === 'LIQUIDITY_LEVEL' || zone.zoneKind === 'EQUAL_LEVEL') &&
      zone.state === 'BROKEN' &&
      zone.activeAtVisibleIndex
    ) {
      counts.brokenLiquidityRenderedActive += 1
      details.push(`Broken liquidity ${zone.zoneId} marked active`)
    }
  }

  if (setupZoneIds) {
    for (const id of setupZoneIds) {
      const zone = zones.find((z) => z.zoneId === id)
      if (!zone) continue
      if (!visibleZones.some((v) => v.zoneId === id)) {
        counts.setupReferencedHidden += 1
        details.push(`Setup-referenced zone ${id} hidden`)
      }
    }
  }

  counts.ok =
    counts.filledFvgExtendingPastFill === 0 &&
    counts.invalidatedFvgExtendingPastInvalidation === 0 &&
    counts.mitigatedObRenderedActive === 0 &&
    counts.invalidatedObExtendingRight === 0 &&
    counts.sweptLiquidityExtendingPastSweep === 0 &&
    counts.brokenLiquidityRenderedActive === 0 &&
    counts.activeUntouchedMissingUnexplained === 0 &&
    counts.setupReferencedHidden === 0

  return { counts, details }
}

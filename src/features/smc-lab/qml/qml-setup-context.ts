import type { SmcSetupVisualContext } from '@/core/smc'
import type { QmlPattern } from '@/core/smc'

/** Build Setup Focus context from a selected QML pattern (complete chain). */
export function createQmlSetupVisualContext(pattern: QmlPattern): SmcSetupVisualContext {
  const status: SmcSetupVisualContext['status'] =
    pattern.status === 'ENTRY_READY'
      ? 'READY'
      : pattern.status === 'RETESTED'
        ? 'RETESTED'
        : pattern.status === 'INVALIDATED'
          ? 'INVALIDATED'
          : pattern.status === 'EXPIRED'
            ? 'COMPLETED'
            : 'WATCHING'

  const eventIds = [
    pattern.sourceSwingId,
    pattern.extremeSwingId,
    pattern.structureShiftEventId,
    pattern.id,
    pattern.confirmationRefs.displacementEventId,
    pattern.confirmationRefs.fvgEventId,
    pattern.confirmationRefs.sweepEventId,
    pattern.confirmationRefs.orderBlockId,
  ].filter((id): id is string => Boolean(id && id.length > 0))

  return {
    setupId: pattern.id,
    direction: pattern.direction,
    status,
    eventIds,
    zoneIds: [pattern.zoneId],
    entryZone: { low: pattern.zoneLow, high: pattern.zoneHigh },
    stopLevel:
      pattern.direction === 'BULLISH' ? pattern.zoneLow : pattern.zoneHigh,
  }
}

export function filterQmlPatternsForVisibility(
  patterns: readonly QmlPattern[],
  mode: 'focus' | 'balanced' | 'debug',
): QmlPattern[] {
  if (mode === 'debug') return [...patterns]
  if (mode === 'focus') {
    const confirmed = patterns.filter(
      (p) =>
        p.status === 'CONFIRMED' ||
        p.status === 'ZONE_ACTIVE' ||
        p.status === 'RETESTED' ||
        p.status === 'ENTRY_READY',
    )
    return confirmed.slice(0, 1)
  }
  // balanced: confirmed active/retested/ready only
  return patterns.filter(
    (p) =>
      p.status === 'ZONE_ACTIVE' ||
      p.status === 'RETESTED' ||
      p.status === 'ENTRY_READY' ||
      p.status === 'CONFIRMED',
  )
}

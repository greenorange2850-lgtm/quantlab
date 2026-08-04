import type {
  SmcEqualLevelEvent,
  SmcLiquiditySweepEvent,
} from '../types'
import type { SmcChartZoneState, SmcZoneProjection } from './types'

/**
 * Project equal-level / liquidity level zones.
 * Unswept levels extend right; swept/broken levels clip at the terminal candle.
 */
export function projectLiquidityZones(
  equalLevels: readonly SmcEqualLevelEvent[],
  sweeps: readonly SmcLiquiditySweepEvent[],
  visibleIndex: number,
  options?: { extendActiveRight?: boolean },
): SmcZoneProjection[] {
  const extendActive = options?.extendActiveRight !== false
  const knownEquals = equalLevels.filter((e) => e.candleIndex <= visibleIndex)
  const knownSweeps = sweeps.filter((e) => e.candleIndex <= visibleIndex)
  const projections: SmcZoneProjection[] = []

  // Equal levels as liquidity bands (thin)
  for (const eq of knownEquals) {
    const side = eq.kind === 'EQUAL_HIGHS' ? 'BEARISH' : 'BULLISH'
    const short = eq.kind === 'EQUAL_HIGHS' ? 'BSL' : 'SSL'
    const matchingSweeps = knownSweeps.filter((s) => {
      if (eq.kind === 'EQUAL_HIGHS') {
        return (
          s.kind === 'BUY_SIDE_LIQUIDITY_SWEEP' &&
          s.candleIndex >= eq.candleIndex &&
          (s.equalLevelId === eq.id ||
            Math.abs(s.sweptLevel - eq.level) / Math.max(Math.abs(eq.level), 1) < 0.001)
        )
      }
      return (
        s.kind === 'SELL_SIDE_LIQUIDITY_SWEEP' &&
        s.candleIndex >= eq.candleIndex &&
        (s.equalLevelId === eq.id ||
          Math.abs(s.sweptLevel - eq.level) / Math.max(Math.abs(eq.level), 1) < 0.001)
      )
    })
    matchingSweeps.sort((a, b) => a.candleIndex - b.candleIndex)

    const sweep = matchingSweeps[0]
    let state: SmcChartZoneState = 'ACTIVE'
    let terminalIndex: number | undefined
    let lifecycleReason: string

    if (sweep) {
      // Close-through is not emitted as sweep by detector — sweeps imply reclaim.
      state = 'SWEPT'
      terminalIndex = sweep.candleIndex
      lifecycleReason = 'Liquidity level swept; extent stops at sweep candle.'
    } else {
      lifecycleReason = 'Unswept liquidity level extends to visible candle.'
    }

    const stillActive = state === 'ACTIVE'
    const endIndex =
      stillActive && extendActive
        ? visibleIndex
        : Math.min(terminalIndex ?? eq.candleIndex, visibleIndex)

    const pad = Math.abs(eq.level) * 0.0003 || 0.01
    projections.push({
      zoneId: `liq-${eq.id}`,
      zoneKind: 'LIQUIDITY_LEVEL',
      direction: side === 'BEARISH' ? 'BEARISH' : 'BULLISH',
      sourceEventId: eq.id,
      startIndex: eq.candleIndex,
      endIndex,
      low: eq.level - pad,
      high: eq.level + pad,
      midpoint: eq.level,
      state,
      mitigationIndex: terminalIndex,
      activeAtVisibleIndex: stillActive,
      setupRefs: [],
      lifecycleReason,
      shortLabel: short,
      fullLabel: `${short} · ${stillActive ? 'Unswept' : 'Swept'}`,
      visibilityReason: stillActive ? 'Active unswept liquidity' : 'Swept liquidity',
      extendsToVisibleEdge: stillActive && extendActive,
    })
  }

  // Standalone sweeps without equal-level source — mark as SWEPT point bands
  for (const sweep of knownSweeps) {
    const already = projections.some(
      (p) =>
        p.zoneKind === 'LIQUIDITY_LEVEL' &&
        p.mitigationIndex === sweep.candleIndex &&
        Math.abs((p.midpoint ?? 0) - sweep.sweptLevel) /
          Math.max(Math.abs(sweep.sweptLevel), 1) <
          0.001,
    )
    if (already) continue
    const buy = sweep.kind === 'BUY_SIDE_LIQUIDITY_SWEEP'
    const pad = Math.abs(sweep.sweptLevel) * 0.0003 || 0.01
    projections.push({
      zoneId: `sweep-level-${sweep.id}`,
      zoneKind: 'LIQUIDITY_LEVEL',
      direction: buy ? 'BEARISH' : 'BULLISH',
      sourceEventId: sweep.id,
      startIndex: Math.max(0, sweep.candleIndex - 1),
      endIndex: sweep.candleIndex,
      low: sweep.sweptLevel - pad,
      high: sweep.sweptLevel + pad,
      midpoint: sweep.sweptLevel,
      state: 'SWEPT',
      mitigationIndex: sweep.candleIndex,
      activeAtVisibleIndex: false,
      setupRefs: [],
      lifecycleReason: 'Standalone sweep level clipped at sweep candle.',
      shortLabel: buy ? 'BSL' : 'SSL',
      fullLabel: `${buy ? 'BSL' : 'SSL'} · Swept`,
      visibilityReason: 'Swept liquidity',
      extendsToVisibleEdge: false,
    })
  }

  return projections.sort((a, b) => a.startIndex - b.startIndex || a.zoneId.localeCompare(b.zoneId))
}

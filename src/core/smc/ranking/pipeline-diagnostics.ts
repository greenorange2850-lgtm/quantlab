import type { SmcDetectionKind, SmcDetectionResult, SmcEvent } from '../types'
import type {
  SmcVisibilityModuleBucket,
  SmcVisibilityPipelineDiagnostics,
  SmcVisibilityStageCounts,
} from './types'

function emptyStage(): SmcVisibilityStageCounts {
  return {
    detectorCount: 0,
    rankedCount: 0,
    visibleCount: 0,
    chartEligibleCount: 0,
    chartRenderedCount: 0,
    listRenderedCount: 0,
  }
}

export function visibilityModuleForKind(kind: SmcDetectionKind): SmcVisibilityModuleBucket {
  if (kind.includes('SWING') || kind === 'EQUAL_HIGHS' || kind === 'EQUAL_LOWS') {
    if (kind === 'EQUAL_HIGHS' || kind === 'EQUAL_LOWS') return 'EqualLevel'
    return 'Swing'
  }
  if (kind.includes('BOS') && !kind.includes('ORDER')) return 'BOS'
  if (kind.includes('CHOCH')) return 'CHoCH'
  if (kind.includes('DISPLACEMENT')) return 'Displacement'
  if (kind.includes('FVG')) return 'FVG'
  if (kind.includes('LIQUIDITY_SWEEP')) return 'LiquiditySweep'
  if (kind.includes('ORDER_BLOCK')) return 'OrderBlock'
  return 'Other'
}

function listDetectorEvents(result: SmcDetectionResult): SmcEvent[] {
  const useClassified = result.classifiedSwings.length > 0
  return [
    ...(useClassified ? result.classifiedSwings : result.swings),
    ...result.bosEvents,
    ...result.chochEvents,
    ...result.displacementEvents,
    ...result.fvgEvents.filter(
      (e) => e.kind === 'BULLISH_FVG_CREATED' || e.kind === 'BEARISH_FVG_CREATED',
    ),
    ...result.equalLevelEvents,
    ...result.liquiditySweepEvents,
    ...result.orderBlockEvents.filter(
      (e) =>
        e.kind === 'BULLISH_ORDER_BLOCK_CREATED' ||
        e.kind === 'BEARISH_ORDER_BLOCK_CREATED',
    ),
  ]
}

/**
 * Build stage counts for the visibility pipeline.
 * chartRenderedCount / listRenderedCount default to 0 — UI fills them.
 */
export function buildVisibilityPipelineDiagnostics(
  result: SmcDetectionResult,
): SmcVisibilityPipelineDiagnostics {
  const modules: SmcVisibilityModuleBucket[] = [
    'Swing',
    'BOS',
    'CHoCH',
    'Displacement',
    'FVG',
    'EqualLevel',
    'LiquiditySweep',
    'OrderBlock',
    'Other',
  ]
  const byModule = Object.fromEntries(modules.map((m) => [m, emptyStage()])) as Record<
    SmcVisibilityModuleBucket,
    SmcVisibilityStageCounts
  >
  const overall = emptyStage()
  const intelligence = result.intelligence
  const mode = intelligence?.mode ?? 'none'

  const detectorEvents = listDetectorEvents(result)
  for (const event of detectorEvents) {
    const module = visibilityModuleForKind(event.kind)
    byModule[module].detectorCount += 1
    overall.detectorCount += 1

    const meta = intelligence?.byEventId[event.id]
    if (meta) {
      byModule[module].rankedCount += 1
      overall.rankedCount += 1
      if (meta.visible) {
        byModule[module].visibleCount += 1
        overall.visibleCount += 1
        byModule[module].chartEligibleCount += 1
        overall.chartEligibleCount += 1
      }
    }
  }

  const notes: string[] = []
  if (mode === 'balanced' || mode === 'focus') {
    if (byModule.BOS.detectorCount > 0 && byModule.BOS.visibleCount === 0) {
      notes.push(
        'BOS detectorCount > 0 but visibleCount is 0 — ranking visibility hid all BOS (check score floor / module diversity).',
      )
    }
    if (byModule.CHoCH.detectorCount > 0 && byModule.CHoCH.visibleCount === 0) {
      notes.push(
        'CHoCH detectorCount > 0 but visibleCount is 0 — ranking visibility hid all CHoCH.',
      )
    }
    if (
      byModule.LiquiditySweep.visibleCount >
        byModule.BOS.visibleCount + byModule.CHoCH.visibleCount &&
      byModule.BOS.detectorCount + byModule.CHoCH.detectorCount > 0
    ) {
      notes.push(
        'Sweeps dominate visible set relative to BOS/CHoCH — verify module diversity policy.',
      )
    }
  }
  if (!intelligence) {
    notes.push('No intelligence layer attached — ranked/visible counts are zero.')
  }

  return { overall, byModule, notes, mode }
}

export function withRenderedCounts(
  diagnostics: SmcVisibilityPipelineDiagnostics,
  rendered: {
    chartByModule?: Partial<Record<SmcVisibilityModuleBucket, number>>
    listByModule?: Partial<Record<SmcVisibilityModuleBucket, number>>
    chartOverall?: number
    listOverall?: number
  },
): SmcVisibilityPipelineDiagnostics {
  const next: SmcVisibilityPipelineDiagnostics = {
    ...diagnostics,
    overall: { ...diagnostics.overall },
    byModule: Object.fromEntries(
      Object.entries(diagnostics.byModule).map(([k, v]) => [k, { ...v }]),
    ) as SmcVisibilityPipelineDiagnostics['byModule'],
    notes: [...diagnostics.notes],
  }
  if (rendered.chartOverall != null) next.overall.chartRenderedCount = rendered.chartOverall
  if (rendered.listOverall != null) next.overall.listRenderedCount = rendered.listOverall
  for (const [module, count] of Object.entries(rendered.chartByModule ?? {})) {
    const bucket = next.byModule[module as SmcVisibilityModuleBucket]
    if (bucket && count != null) bucket.chartRenderedCount = count
  }
  for (const [module, count] of Object.entries(rendered.listByModule ?? {})) {
    const bucket = next.byModule[module as SmcVisibilityModuleBucket]
    if (bucket && count != null) bucket.listRenderedCount = count
  }
  return next
}

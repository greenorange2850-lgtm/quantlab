import type {
  SmcDetectionResult,
  SmcVisibilityModuleBucket,
  SmcVisibilityPipelineDiagnostics,
} from '@/core/smc'
import {
  buildVisibilityPipelineDiagnostics,
  visibilityModuleForKind,
  withRenderedCounts,
} from '@/core/smc'
import { listReviewableEvents } from './event-counts'
import type { SmcChartLayerToggles } from './components/SmcCandlestickChart'
import type { SmcEventFilter } from './components/SmcEventList'

function matchesListFilter(kind: string, filter: SmcEventFilter): boolean {
  switch (filter) {
    case 'ALL':
    case 'UNREVIEWED':
    case 'CORRECT':
    case 'WRONG':
      return true
    case 'SWINGS':
      return kind === 'SWING_HIGH' || kind === 'SWING_LOW'
    case 'STRUCTURE':
      return (
        kind === 'INTERNAL_SWING_HIGH' ||
        kind === 'INTERNAL_SWING_LOW' ||
        kind === 'EXTERNAL_SWING_HIGH' ||
        kind === 'EXTERNAL_SWING_LOW'
      )
    case 'BOS':
      return kind === 'BULLISH_BOS' || kind === 'BEARISH_BOS'
    case 'CHOCH':
      return kind === 'BULLISH_CHOCH' || kind === 'BEARISH_CHOCH'
    case 'DISPLACEMENT':
      return kind.includes('DISPLACEMENT')
    case 'FVG':
      return kind.includes('FVG')
    case 'EQUAL':
      return kind === 'EQUAL_HIGHS' || kind === 'EQUAL_LOWS'
    case 'SWEEP':
      return kind.includes('LIQUIDITY_SWEEP')
    case 'OB':
      return kind.includes('ORDER_BLOCK')
    default:
      return kind === filter
  }
}

function allowBreakOnChart(
  layers: SmcChartLayerToggles,
  classification: string | undefined,
): boolean {
  return layers.internalBreaks || classification !== 'INTERNAL'
}

/**
 * Count chart-rendered markers for the visible window after layer toggles.
 * Uses ranking-filtered detection arrays (same input the chart receives).
 */
export function countChartRenderedByModule(
  detection: SmcDetectionResult,
  layers: SmcChartLayerToggles,
  windowStart: number,
  windowLength: number,
): Record<SmcVisibilityModuleBucket, number> {
  const counts: Record<SmcVisibilityModuleBucket, number> = {
    Swing: 0,
    BOS: 0,
    CHoCH: 0,
    Displacement: 0,
    FVG: 0,
    EqualLevel: 0,
    LiquiditySweep: 0,
    OrderBlock: 0,
    Other: 0,
  }
  const inWindow = (idx: number) => idx >= windowStart && idx < windowStart + windowLength

  for (const s of detection.classifiedSwings) {
    if (!inWindow(s.candleIndex)) continue
    if (s.classification === 'EXTERNAL' && !layers.externalSwings) continue
    if (s.classification === 'INTERNAL' && !layers.internalSwings) continue
    counts.Swing += 1
  }
  if (detection.classifiedSwings.length === 0 && layers.externalSwings) {
    for (const s of detection.swings) {
      if (!inWindow(s.candleIndex)) continue
      counts.Swing += 1
    }
  }
  if (layers.bosLabels) {
    for (const e of detection.bosEvents) {
      if (!inWindow(e.candleIndex)) continue
      if (!allowBreakOnChart(layers, e.brokenSwingClassification)) continue
      counts.BOS += 1
    }
  }
  if (layers.chochLabels) {
    for (const e of detection.chochEvents) {
      if (!inWindow(e.candleIndex)) continue
      if (!allowBreakOnChart(layers, e.brokenSwingClassification)) continue
      counts.CHoCH += 1
    }
  }
  if (layers.displacement) {
    for (const e of detection.displacementEvents) {
      if (!inWindow(e.candleIndex)) continue
      counts.Displacement += 1
    }
  }
  if (layers.activeFvg || layers.mitigatedFvg) {
    for (const e of detection.fvgEvents) {
      if (e.kind !== 'BULLISH_FVG_CREATED' && e.kind !== 'BEARISH_FVG_CREATED') continue
      if (!inWindow(e.candleIndex)) continue
      counts.FVG += 1
    }
  }
  if (layers.equalLevels) {
    for (const e of detection.equalLevelEvents) {
      if (!inWindow(e.candleIndex)) continue
      counts.EqualLevel += 1
    }
  }
  if (layers.liquiditySweeps) {
    for (const e of detection.liquiditySweepEvents) {
      if (!inWindow(e.candleIndex)) continue
      counts.LiquiditySweep += 1
    }
  }
  if (layers.activeOrderBlocks || layers.invalidatedOrderBlocks) {
    for (const e of detection.orderBlockEvents) {
      if (
        e.kind !== 'BULLISH_ORDER_BLOCK_CREATED' &&
        e.kind !== 'BEARISH_ORDER_BLOCK_CREATED'
      ) {
        continue
      }
      if (!inWindow(e.candleIndex)) continue
      counts.OrderBlock += 1
    }
  }
  return counts
}

export function countListRenderedByModule(
  detection: SmcDetectionResult,
  filter: SmcEventFilter,
  rankingVisibleOnly: boolean,
): Record<SmcVisibilityModuleBucket, number> {
  const counts: Record<SmcVisibilityModuleBucket, number> = {
    Swing: 0,
    BOS: 0,
    CHoCH: 0,
    Displacement: 0,
    FVG: 0,
    EqualLevel: 0,
    LiquiditySweep: 0,
    OrderBlock: 0,
    Other: 0,
  }
  for (const event of listReviewableEvents(detection)) {
    if (
      rankingVisibleOnly &&
      detection.intelligence?.byEventId[event.id]?.visible === false
    ) {
      continue
    }
    if (!matchesListFilter(event.kind, filter)) continue
    counts[visibilityModuleForKind(event.kind)] += 1
  }
  return counts
}

export function buildLabVisibilityPipelineDiagnostics(input: {
  fullDetection: SmcDetectionResult
  chartDetection: SmcDetectionResult
  layers: SmcChartLayerToggles
  windowStart: number
  windowLength: number
  listFilter: SmcEventFilter
  rankingVisibleOnly: boolean
}): SmcVisibilityPipelineDiagnostics {
  const base = buildVisibilityPipelineDiagnostics(input.fullDetection)
  const chartByModule = countChartRenderedByModule(
    input.chartDetection,
    input.layers,
    input.windowStart,
    input.windowLength,
  )
  const listByModule = countListRenderedByModule(
    input.fullDetection,
    input.listFilter,
    input.rankingVisibleOnly,
  )
  const chartOverall = Object.values(chartByModule).reduce((a, b) => a + b, 0)
  const listOverall = Object.values(listByModule).reduce((a, b) => a + b, 0)
  const merged = withRenderedCounts(base, {
    chartByModule,
    listByModule,
    chartOverall,
    listOverall,
  })

  if (
    merged.byModule.BOS.visibleCount > 0 &&
    chartByModule.BOS === 0 &&
    input.layers.bosLabels &&
    !input.layers.internalBreaks
  ) {
    merged.notes.push(
      'BOS are ranking-visible but chartRenderedCount is 0 — enable "Internal BOS/CHoCH" layer (or Structure density) to render internal breaks.',
    )
  }
  if (
    merged.byModule.CHoCH.visibleCount > 0 &&
    chartByModule.CHoCH === 0 &&
    input.layers.chochLabels &&
    !input.layers.internalBreaks
  ) {
    merged.notes.push(
      'CHoCH are ranking-visible but chartRenderedCount is 0 — enable "Internal BOS/CHoCH" layer to render internal breaks.',
    )
  }
  return merged
}

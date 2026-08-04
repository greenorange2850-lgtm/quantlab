import type { Candle } from '@/data/candles'
import type {
  DowSwingLabel,
  SmcBosEvent,
  SmcChochEvent,
  SmcClassifiedSwingEvent,
  SmcDisplacementEvent,
  SmcDowSwingMeta,
  SmcEqualLevelEvent,
  SmcFvgEvent,
  SmcLiquiditySweepEvent,
  SmcOrderBlockEvent,
  SmcSetupVisualContext,
  SmcSwingEvent,
  SmcZoneProjection,
} from '@/core/smc'
import { renderStyleForLifecycleState } from '@/core/smc/lifecycle/zone-lifecycle-render'
import type { SmcLabPreferences, SmcManualAnnotation } from '../persistence/types'
import type { SmcRankedEventMeta } from '@/core/smc'
import {
  projectSwingChartMarker,
  structureSwingShortLabel,
  swingLabelChipWidth,
} from '../dow-label'

/** Chart layer toggles — mirrors SmcLabPreferences['layerToggles']. */
export type SmcChartLayerToggles = SmcLabPreferences['layerToggles']

interface SmcCandlestickChartProps {
  candles: Candle[]
  swings: SmcSwingEvent[]
  classifiedSwings?: SmcClassifiedSwingEvent[]
  bosEvents: SmcBosEvent[]
  chochEvents?: SmcChochEvent[]
  displacementEvents?: SmcDisplacementEvent[]
  fvgEvents?: SmcFvgEvent[]
  equalLevelEvents?: SmcEqualLevelEvent[]
  liquiditySweepEvents?: SmcLiquiditySweepEvent[]
  orderBlockEvents?: SmcOrderBlockEvent[]
  /** Lifecycle zone projections — preferred over raw FVG/OB geometry when provided. */
  zoneProjections?: SmcZoneProjection[]
  setupContext?: SmcSetupVisualContext | null
  annotations?: SmcManualAnnotation[]
  selectedEventId: string | null
  selectedZoneId?: string | null
  onSelectZone?: (zoneId: string) => void
  /** When a break is selected, highlight its broken swing. */
  highlightSwingId?: string | null
  layers: SmcChartLayerToggles
  windowStartIndex: number
  densityWarning?: string | null
  /** Importance metadata for overlap collapse (higher score kept). */
  importanceById?: Record<string, SmcRankedEventMeta>
  /** Dow Theory swingId → HH/HL/LH/LL (null = seed). From result.dowTheory.swingClassification. */
  dowSwingClassification?: Record<string, DowSwingLabel | null>
  /** Optional bySwingId map for robust label lookup (result.dowTheory.bySwingId). */
  dowBySwingId?: Record<string, SmcDowSwingMeta>
}

const WIDTH = 720
const HEIGHT = 300
const PLOT = { left: 12, right: 48, top: 28, bottom: 28 }

/** Soft cap for labels in the visible window before density warning. */
export const SMC_MARKER_DENSITY_WARN = 18
/** Max stacked labels per candle before collapsing to "+N events". */
const MAX_STACKED_LABELS = 3

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return '—'
  if (Math.abs(value) >= 1000) return value.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (Math.abs(value) >= 1) return value.toLocaleString('en-US', { maximumFractionDigits: 2 })
  return value.toLocaleString('en-US', { maximumFractionDigits: 5 })
}

function stackOffsets(
  items: Array<{ id: string; localIndex: number; preferAbove: boolean }>,
): Map<string, number> {
  const sorted = [...items].sort((a, b) => a.localIndex - b.localIndex)
  const offsets = new Map<string, number>()
  const occupied: Array<{ x: number; lane: number; above: boolean }> = []

  for (const item of sorted) {
    let lane = 0
    for (;;) {
      const clash = occupied.some(
        (o) =>
          o.above === item.preferAbove &&
          o.lane === lane &&
          Math.abs(o.x - item.localIndex) < 2,
      )
      if (!clash) break
      lane += 1
      if (lane > 6) break
    }
    occupied.push({ x: item.localIndex, lane, above: item.preferAbove })
    offsets.set(item.id, lane * 12)
  }
  return offsets
}

function zoneOpacity(state: string, setupHighlighted: boolean, zone?: SmcZoneProjection): number {
  if (setupHighlighted) return 0.32
  if (zone?.lifecycle) {
    const style = renderStyleForLifecycleState(zone.lifecycle.currentState)
    if (style.hiddenByDefault) return 0
    return style.opacity
  }
  switch (state) {
    case 'NEW':
    case 'ACTIVE':
      return 0.28
    case 'TOUCHED':
      return 0.2
    case 'PARTIAL':
    case 'PARTIALLY_MITIGATED':
      return 0.18
    case 'FILLED':
    case 'MITIGATED':
    case 'SWEPT':
    case 'SWEEPED':
    case 'CONSUMED':
    case 'SUPERSEDED':
      return 0.1
    case 'INVALIDATED':
    case 'BROKEN':
      return 0.16
    case 'EXPIRED':
      return 0
    default:
      return 0.1
  }
}

function zoneStrokeDash(state: string, zone?: SmcZoneProjection): string | undefined {
  if (zone?.lifecycle) {
    return renderStyleForLifecycleState(zone.lifecycle.currentState).strokeDasharray
  }
  if (state === 'PARTIAL' || state === 'PARTIALLY_MITIGATED') return '4 3'
  if (state === 'TOUCHED') return undefined
  if (
    state === 'FILLED' ||
    state === 'MITIGATED' ||
    state === 'INVALIDATED' ||
    state === 'SWEPT' ||
    state === 'SWEEPED' ||
    state === 'BROKEN' ||
    state === 'CONSUMED'
  ) {
    return '3 2'
  }
  return undefined
}

function layerAllowsZone(zone: SmcZoneProjection, layers: SmcChartLayerToggles): boolean {
  const finished =
    zone.state === 'FILLED' ||
    zone.state === 'MITIGATED' ||
    zone.state === 'INVALIDATED' ||
    zone.state === 'SWEPT' ||
    zone.state === 'SWEEPED' ||
    zone.state === 'BROKEN' ||
    zone.state === 'EXPIRED' ||
    zone.state === 'CONSUMED' ||
    zone.state === 'SUPERSEDED'
  if (zone.zoneKind === 'FVG') {
    if (finished) return layers.mitigatedFvg
    return layers.activeFvg
  }
  if (zone.zoneKind === 'ORDER_BLOCK') {
    if (finished) return layers.invalidatedOrderBlocks
    return layers.activeOrderBlocks
  }
  if (zone.zoneKind === 'LIQUIDITY_LEVEL' || zone.zoneKind === 'EQUAL_LEVEL') {
    return layers.equalLevels || layers.liquiditySweeps
  }
  return true
}

function isActiveZoneState(state: string): boolean {
  return state === 'ACTIVE' || state === 'TOUCHED' || state === 'HALF_FILLED'
}

function isMitigatedZoneState(state: string): boolean {
  return (
    state === 'FULLY_FILLED' ||
    state === 'MITIGATED' ||
    state === 'INVALIDATED'
  )
}

function endIndexForFvg(
  created: SmcFvgEvent,
  all: SmcFvgEvent[],
  windowEndExclusive: number,
): number {
  const later = all
    .filter(
      (e) =>
        e.fvgId === created.fvgId &&
        e.candleIndex > created.candleIndex &&
        (e.kind === 'FVG_FULLY_FILLED' ||
          e.kind === 'FVG_INVALIDATED' ||
          e.kind === 'FVG_HALF_FILLED' ||
          e.kind === 'FVG_TOUCHED'),
    )
    .sort((a, b) => a.candleIndex - b.candleIndex)
  if (created.state === 'ACTIVE' && later.length === 0) {
    return windowEndExclusive - 1
  }
  const first = later[0]
  if (first) return Math.min(first.candleIndex, windowEndExclusive - 1)
  return Math.min(created.candleIndex + 1, windowEndExclusive - 1)
}

function endIndexForOb(
  created: SmcOrderBlockEvent,
  all: SmcOrderBlockEvent[],
  windowEndExclusive: number,
): number {
  const later = all
    .filter(
      (e) =>
        e.orderBlockId === created.orderBlockId &&
        e.candleIndex > created.candleIndex &&
        (e.kind === 'ORDER_BLOCK_MITIGATED' ||
          e.kind === 'ORDER_BLOCK_INVALIDATED' ||
          e.kind === 'ORDER_BLOCK_TOUCHED'),
    )
    .sort((a, b) => a.candleIndex - b.candleIndex)
  if (created.mitigationStatus === 'ACTIVE' && later.length === 0) {
    return windowEndExclusive - 1
  }
  const first = later[0]
  if (first) return Math.min(first.candleIndex, windowEndExclusive - 1)
  return Math.min(created.candleIndex + 1, windowEndExclusive - 1)
}

type ChartLabel = {
  id: string
  localIndex: number
  preferAbove: boolean
  text: string
  fill: string
  bg: string
  width: number
  price: number
}

export function SmcCandlestickChart({
  candles,
  swings,
  classifiedSwings = [],
  bosEvents,
  chochEvents = [],
  displacementEvents = [],
  fvgEvents = [],
  equalLevelEvents = [],
  liquiditySweepEvents = [],
  orderBlockEvents = [],
  zoneProjections,
  setupContext = null,
  annotations = [],
  selectedEventId,
  selectedZoneId = null,
  onSelectZone,
  highlightSwingId = null,
  layers,
  windowStartIndex,
  densityWarning = null,
  importanceById,
  dowSwingClassification = {},
  dowBySwingId = {},
}: SmcCandlestickChartProps) {
  if (candles.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded-lg border border-dashed border-border/70 bg-white/[0.02] text-xs text-muted-foreground">
        Load market data and run detection to render the chart.
      </div>
    )
  }

  const prices = candles.flatMap((c) => [c.high, c.low])
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  const padding = Math.max((maxPrice - minPrice) * 0.1, Math.abs(maxPrice) * 0.001, 1e-8)
  const yMin = minPrice - padding
  const yMax = maxPrice + padding
  const plotWidth = WIDTH - PLOT.left - PLOT.right
  const plotHeight = HEIGHT - PLOT.top - PLOT.bottom
  const candleSlot = candles.length > 1 ? plotWidth / (candles.length - 1) : plotWidth
  const bodyWidth = clamp(candleSlot * 0.58, 1.5, 8)
  const windowEndExclusive = windowStartIndex + candles.length

  const xForLocal = (localIndex: number) =>
    candles.length === 1 ? PLOT.left + plotWidth / 2 : PLOT.left + localIndex * candleSlot
  const yForPrice = (price: number) => PLOT.top + ((yMax - price) / (yMax - yMin)) * plotHeight
  const indexByTime = new Map(candles.map((c, i) => [c.time, i]))

  const inWindow = (candleIndex: number) => {
    const local = candleIndex - windowStartIndex
    return local >= 0 && local < candles.length
  }

  const visibleClassified = classifiedSwings.filter((s) => {
    if (!inWindow(s.candleIndex)) return false
    if (s.classification === 'EXTERNAL') return layers.externalSwings
    if (s.classification === 'INTERNAL') return layers.internalSwings
    return false
  })

  const visibleBaseSwings =
    classifiedSwings.length === 0 && layers.externalSwings
      ? swings.filter((s) => inWindow(s.candleIndex))
      : []

  const allowBreak = (classification: string | undefined) =>
    layers.internalBreaks || classification !== 'INTERNAL'

  const visibleBos = layers.bosLabels
    ? bosEvents.filter(
        (e) => inWindow(e.candleIndex) && allowBreak(e.brokenSwingClassification),
      )
    : []
  const visibleChoch = layers.chochLabels
    ? chochEvents.filter(
        (e) => inWindow(e.candleIndex) && allowBreak(e.brokenSwingClassification),
      )
    : []
  const visibleSweeps = layers.liquiditySweeps
    ? liquiditySweepEvents.filter((e) => inWindow(e.candleIndex))
    : []
  const visibleDisplacement = layers.displacement
    ? displacementEvents.filter((e) => inWindow(e.candleIndex))
    : []
  const visibleEqual = layers.equalLevels
    ? equalLevelEvents.filter((e) => inWindow(e.candleIndex))
    : []

  const showConnectors = layers.bosLines || layers.connectorLines

  const labels: ChartLabel[] = []

  // Default ON when the pref key is absent (older saved layer objects).
  const showDow = layers.dowTheoryLabels ?? true
  for (const swing of visibleClassified) {
    const isHigh = swing.kind.includes('HIGH')
    // Deterministic join: exact event id → originalSwingId/sourceSwingId wrappers.
    // Density/collision below must keep the full combined text (never strip only Dow suffix).
    const marker = projectSwingChartMarker(
      swing,
      dowSwingClassification,
      dowBySwingId,
      showDow,
    )
    labels.push({
      id: marker.id,
      localIndex: swing.candleIndex - windowStartIndex,
      preferAbove: isHigh,
      text: marker.text,
      fill: isHigh ? '#e9d5ff' : '#99f6e4',
      bg: isHigh ? '#7e22ce' : '#0f766e',
      width: marker.width,
      price: swing.price,
    })
  }
  for (const swing of visibleBaseSwings) {
    const isHigh = swing.kind === 'SWING_HIGH'
    const text = structureSwingShortLabel(swing.kind)
    labels.push({
      id: swing.id,
      localIndex: swing.candleIndex - windowStartIndex,
      preferAbove: isHigh,
      text,
      fill: '#fff',
      bg: isHigh ? '#7e22ce' : '#0f766e',
      width: swingLabelChipWidth(text),
      price: swing.price,
    })
  }
  for (const event of visibleBos) {
    const bull = event.kind === 'BULLISH_BOS'
    labels.push({
      id: event.id,
      localIndex: event.candleIndex - windowStartIndex,
      preferAbove: bull,
      text: bull ? 'BOS ↑' : 'BOS ↓',
      fill: '#fff',
      bg: bull ? '#0ea5e9' : '#ea580c',
      width: 36,
      price: event.closePrice,
    })
  }
  for (const event of visibleChoch) {
    const bull = event.kind === 'BULLISH_CHOCH'
    labels.push({
      id: event.id,
      localIndex: event.candleIndex - windowStartIndex,
      preferAbove: bull,
      text: bull ? 'CHoCH ↑' : 'CHoCH ↓',
      fill: '#fff',
      bg: bull ? '#6366f1' : '#db2777',
      width: 48,
      price: event.closePrice,
    })
  }
  for (const event of visibleSweeps) {
    const buy = event.kind === 'BUY_SIDE_LIQUIDITY_SWEEP'
    labels.push({
      id: event.id,
      localIndex: event.candleIndex - windowStartIndex,
      preferAbove: buy,
      text: buy ? 'BSL Sweep' : 'SSL Sweep',
      fill: '#fff',
      bg: buy ? '#f59e0b' : '#14b8a6',
      width: 58,
      price: event.close,
    })
  }
  for (const event of visibleDisplacement) {
    const bull = event.kind === 'BULLISH_DISPLACEMENT'
    labels.push({
      id: event.id,
      localIndex: event.candleIndex - windowStartIndex,
      preferAbove: bull,
      text: bull ? 'Disp ↑' : 'Disp ↓',
      fill: '#fff',
      bg: bull ? '#22c55e' : '#ef4444',
      width: 40,
      price: candles[event.candleIndex - windowStartIndex]?.close ?? 0,
    })
  }
  for (const event of visibleEqual) {
    const highs = event.kind === 'EQUAL_HIGHS'
    labels.push({
      id: event.id,
      localIndex: event.candleIndex - windowStartIndex,
      preferAbove: highs,
      text: highs ? 'EQH' : 'EQL',
      fill: '#fff',
      bg: '#64748b',
      width: 28,
      price: event.level,
    })
  }

  // Density: keep higher importance labels; collapse lower into "+N events"
  const byCandle = new Map<number, ChartLabel[]>()
  for (const label of labels) {
    const list = byCandle.get(label.localIndex) ?? []
    list.push(label)
    byCandle.set(label.localIndex, list)
  }
  const scoreOf = (id: string) => importanceById?.[id]?.importanceScore ?? 0
  const renderedLabels: ChartLabel[] = []
  const overflowByCandle = new Map<number, number>()
  for (const [localIndex, group] of byCandle) {
    const sorted = [...group].sort((a, b) => {
      const diff = scoreOf(b.id) - scoreOf(a.id)
      if (diff !== 0) return diff
      return a.id.localeCompare(b.id)
    })
    if (sorted.length <= MAX_STACKED_LABELS) {
      renderedLabels.push(...sorted)
    } else {
      renderedLabels.push(...sorted.slice(0, MAX_STACKED_LABELS))
      overflowByCandle.set(localIndex, sorted.length - MAX_STACKED_LABELS)
    }
  }

  const stacks = stackOffsets(
    renderedLabels.map((l) => ({
      id: l.id,
      localIndex: l.localIndex,
      preferAbove: l.preferAbove,
    })),
  )

  const hasSelection = Boolean(selectedEventId)
  const markerCount = labels.length

  const fvgCreated = fvgEvents.filter(
    (e) => e.kind === 'BULLISH_FVG_CREATED' || e.kind === 'BEARISH_FVG_CREATED',
  )
  const obCreated = orderBlockEvents.filter(
    (e) =>
      e.kind === 'BULLISH_ORDER_BLOCK_CREATED' || e.kind === 'BEARISH_ORDER_BLOCK_CREATED',
  )

  return (
    <div className="space-y-2">
      {densityWarning || markerCount >= SMC_MARKER_DENSITY_WARN ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
          {densityWarning ??
            `High marker density (${markerCount} in view). Select an event to focus, or use a Minimal density preset.`}
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-xl border border-border/70 bg-slate-950/40 p-2">
        <svg
          role="img"
          aria-label="SMC Lab candlestick chart with Phase 2 structure markers"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full min-w-[320px]"
        >
          {[0.25, 0.5, 0.75].map((ratio) => {
            const price = yMin + (yMax - yMin) * ratio
            const y = yForPrice(price)
            return (
              <g key={ratio}>
                <line
                  x1={PLOT.left}
                  x2={WIDTH - PLOT.right}
                  y1={y}
                  y2={y}
                  stroke="currentColor"
                  className="text-white/10"
                  strokeWidth={1}
                />
                <text
                  x={WIDTH - PLOT.right + 4}
                  y={y + 3}
                  className="fill-muted-foreground"
                  fontSize={9}
                >
                  {formatPrice(price)}
                </text>
              </g>
            )
          })}

          {/* Lifecycle zone projections (preferred) */}
          {(zoneProjections ?? []).map((zone) => {
            if (!layerAllowsZone(zone, layers) && !zone.setupRefs.length) return null
            const lifeStyle = zone.lifecycle
              ? renderStyleForLifecycleState(zone.lifecycle.currentState)
              : null
            if (lifeStyle?.hiddenByDefault && lifeStyle.opacity <= 0) return null
            const setupHighlighted =
              Boolean(setupContext?.zoneIds.includes(zone.zoneId)) ||
              selectedZoneId === zone.zoneId
            const startLocal = zone.startIndex - windowStartIndex
            const endLocal = zone.endIndex - windowStartIndex
            if (endLocal < 0 || startLocal >= candles.length) return null
            const x1 = xForLocal(clamp(startLocal, 0, candles.length - 1))
            const x2 = xForLocal(clamp(endLocal, 0, candles.length - 1))
            const yTop = yForPrice(zone.high)
            const yBot = yForPrice(zone.low)
            const bull = zone.direction === 'BULLISH'
            const fill =
              zone.zoneKind === 'ORDER_BLOCK'
                ? bull
                  ? '#3b82f6'
                  : '#a855f7'
                : zone.zoneKind === 'LIQUIDITY_LEVEL' || zone.zoneKind === 'EQUAL_LEVEL'
                  ? '#f59e0b'
                  : bull
                    ? '#22c55e'
                    : '#ef4444'
            const stroke =
              lifeStyle?.showInvalidationCross
                ? '#ef4444'
                : setupHighlighted
                  ? '#fde68a'
                  : fill
            const midY = (Math.min(yTop, yBot) + Math.max(yTop, yBot)) / 2
            const rx = Math.min(x1, x2)
            const ry = Math.min(yTop, yBot)
            const rw = Math.max(2, Math.abs(x2 - x1))
            const rh = Math.max(2, Math.abs(yBot - yTop))
            const labelSuffix =
              lifeStyle?.labelSuffix ??
              (zone.state === 'ACTIVE'
                ? ''
                : zone.state === 'TOUCHED'
                  ? '·T'
                  : zone.state === 'PARTIALLY_MITIGATED' || zone.state === 'PARTIAL'
                    ? '·P'
                    : zone.state === 'FILLED' || zone.state === 'MITIGATED'
                      ? '·M'
                      : zone.state === 'INVALIDATED'
                        ? '·X'
                        : zone.state === 'SWEPT' || zone.state === 'SWEEPED'
                          ? '·S'
                          : zone.state === 'CONSUMED' || zone.state === 'SUPERSEDED'
                            ? '·C'
                            : '')
            return (
              <g
                key={`zone-${zone.zoneId}`}
                className={onSelectZone ? 'cursor-pointer' : undefined}
                onClick={() => onSelectZone?.(zone.zoneId)}
              >
                <rect
                  x={rx}
                  y={ry}
                  width={rw}
                  height={rh}
                  fill={fill}
                  opacity={zoneOpacity(zone.state, setupHighlighted, zone)}
                  stroke={stroke}
                  strokeWidth={setupHighlighted ? 1.5 : 0.75}
                  strokeDasharray={zoneStrokeDash(zone.state, zone)}
                />
                {lifeStyle?.showInvalidationCross ? (
                  <>
                    <line
                      x1={rx}
                      y1={ry}
                      x2={rx + rw}
                      y2={ry + rh}
                      stroke="#ef4444"
                      strokeWidth={1.25}
                      opacity={0.85}
                    />
                    <line
                      x1={rx + rw}
                      y1={ry}
                      x2={rx}
                      y2={ry + rh}
                      stroke="#ef4444"
                      strokeWidth={1.25}
                      opacity={0.85}
                    />
                  </>
                ) : null}
                <text
                  x={rx + 2}
                  y={midY}
                  className="fill-white"
                  fontSize={8}
                  opacity={0.85}
                >
                  {zone.shortLabel}
                  {labelSuffix}
                </text>
              </g>
            )
          })}

          {/* Legacy FVG/OB bands when projections not provided */}
          {!zoneProjections
            ? fvgCreated.map((zone) => {
            const active = isActiveZoneState(zone.state)
            const mitigated = isMitigatedZoneState(zone.state)
            if (active && !layers.activeFvg) return null
            if (mitigated && !layers.mitigatedFvg) return null
            if (!active && !mitigated) {
              if (!layers.activeFvg && !layers.mitigatedFvg) return null
            }
            const endIdx = endIndexForFvg(zone, fvgEvents, windowEndExclusive)
            const startLocal = zone.candleIndices[0] - windowStartIndex
            const endLocal = endIdx - windowStartIndex
            if (endLocal < 0 || startLocal >= candles.length) return null
            const x1 = xForLocal(clamp(startLocal, 0, candles.length - 1))
            const x2 = xForLocal(clamp(endLocal, 0, candles.length - 1))
            const yTop = yForPrice(zone.upperBoundary)
            const yBot = yForPrice(zone.lowerBoundary)
            const bull = zone.direction === 'BULLISH'
            return (
              <rect
                key={`fvg-${zone.id}`}
                x={Math.min(x1, x2)}
                y={Math.min(yTop, yBot)}
                width={Math.max(2, Math.abs(x2 - x1))}
                height={Math.max(2, Math.abs(yBot - yTop))}
                fill={bull ? '#22c55e' : '#ef4444'}
                opacity={active ? 0.18 : 0.08}
                stroke={bull ? '#86efac' : '#fca5a5'}
                strokeWidth={0.75}
                strokeDasharray={mitigated ? '3 2' : undefined}
              />
            )
          })
            : null}

          {!zoneProjections
            ? obCreated.map((zone) => {
            const active = isActiveZoneState(zone.mitigationStatus)
            const invalid = zone.invalidationStatus || zone.mitigationStatus === 'INVALIDATED'
            const mitigated = isMitigatedZoneState(zone.mitigationStatus)
            if (active && !layers.activeOrderBlocks) return null
            if ((mitigated || invalid) && !layers.invalidatedOrderBlocks) return null
            if (!active && !mitigated && !invalid) {
              if (!layers.activeOrderBlocks) return null
            }
            const endIdx = endIndexForOb(zone, orderBlockEvents, windowEndExclusive)
            const startLocal = zone.sourceCandleIndex - windowStartIndex
            const endLocal = endIdx - windowStartIndex
            if (endLocal < 0 || startLocal >= candles.length) return null
            const x1 = xForLocal(clamp(startLocal, 0, candles.length - 1))
            const x2 = xForLocal(clamp(endLocal, 0, candles.length - 1))
            const yTop = yForPrice(zone.zoneHigh)
            const yBot = yForPrice(zone.zoneLow)
            const bull = zone.direction === 'BULLISH'
            return (
              <rect
                key={`ob-${zone.id}`}
                x={Math.min(x1, x2)}
                y={Math.min(yTop, yBot)}
                width={Math.max(2, Math.abs(x2 - x1))}
                height={Math.max(2, Math.abs(yBot - yTop))}
                fill={bull ? '#3b82f6' : '#a855f7'}
                opacity={active ? 0.2 : 0.08}
                stroke={bull ? '#93c5fd' : '#d8b4fe'}
                strokeWidth={0.75}
                strokeDasharray={invalid || mitigated ? '3 2' : undefined}
              />
            )
          })
            : null}

          {/* Setup entry / stop / targets */}
          {setupContext?.entryZone ? (
            <rect
              x={PLOT.left}
              y={yForPrice(setupContext.entryZone.high)}
              width={plotWidth}
              height={Math.max(
                2,
                Math.abs(
                  yForPrice(setupContext.entryZone.low) - yForPrice(setupContext.entryZone.high),
                ),
              )}
              fill="#fde68a"
              opacity={0.12}
              stroke="#fbbf24"
              strokeWidth={1}
            />
          ) : null}
          {setupContext?.stopLevel != null ? (
            <line
              x1={PLOT.left}
              x2={PLOT.left + plotWidth}
              y1={yForPrice(setupContext.stopLevel)}
              y2={yForPrice(setupContext.stopLevel)}
              stroke="#f87171"
              strokeWidth={1}
              strokeDasharray="4 3"
            />
          ) : null}
          {(setupContext?.targetLevels ?? []).map((level, i) => (
            <line
              key={`tgt-${i}`}
              x1={PLOT.left}
              x2={PLOT.left + plotWidth}
              y1={yForPrice(level)}
              y2={yForPrice(level)}
              stroke="#34d399"
              strokeWidth={1}
              strokeDasharray="4 3"
            />
          ))}

          {candles.map((c, i) => {
            const x = xForLocal(i)
            const yOpen = yForPrice(c.open)
            const yClose = yForPrice(c.close)
            const yHigh = yForPrice(c.high)
            const yLow = yForPrice(c.low)
            const up = c.close >= c.open
            const color = up ? '#34d399' : '#f87171'
            const bodyTop = Math.min(yOpen, yClose)
            const bodyHeight = Math.max(1, Math.abs(yClose - yOpen))
            return (
              <g key={c.time}>
                <line x1={x} x2={x} y1={yHigh} y2={yLow} stroke={color} strokeWidth={1} />
                <rect
                  x={x - bodyWidth / 2}
                  y={bodyTop}
                  width={bodyWidth}
                  height={bodyHeight}
                  fill={color}
                  opacity={0.9}
                />
              </g>
            )
          })}

          {showConnectors &&
            [...visibleBos, ...visibleChoch].map((event) => {
              const breakLocal = event.candleIndex - windowStartIndex
              const swingLocal = event.brokenSwingCandleIndex - windowStartIndex
              if (breakLocal < 0 || breakLocal >= candles.length) return null
              if (swingLocal < 0 || swingLocal >= candles.length) return null
              const dim =
                hasSelection &&
                selectedEventId !== event.id &&
                highlightSwingId !== event.brokenSwingId
              const y = yForPrice(event.brokenSwingPrice)
              const isChoch = event.kind.includes('CHOCH')
              const bull = event.kind.startsWith('BULLISH')
              const color = isChoch
                ? bull
                  ? '#818cf8'
                  : '#f472b6'
                : bull
                  ? '#38bdf8'
                  : '#fb923c'
              return (
                <line
                  key={`line-${event.id}`}
                  x1={xForLocal(swingLocal)}
                  x2={xForLocal(breakLocal)}
                  y1={y}
                  y2={y}
                  stroke={color}
                  strokeWidth={selectedEventId === event.id ? 2 : 1}
                  strokeDasharray="4 3"
                  opacity={dim ? 0.15 : 0.85}
                />
              )
            })}

          {/* Swing markers */}
          {[...visibleClassified, ...visibleBaseSwings].map((swing) => {
            const local = swing.candleIndex - windowStartIndex
            const x = xForLocal(local)
            const y = yForPrice(swing.price)
            const isHigh = swing.kind.includes('HIGH')
            const selected =
              selectedEventId === swing.id || highlightSwingId === swing.id
            const dim = hasSelection && !selected
            return (
              <circle
                key={`dot-${swing.id}`}
                cx={x}
                cy={y}
                r={selected ? 5 : 3.5}
                fill={isHigh ? '#c084fc' : '#2dd4bf'}
                stroke="#fff"
                strokeWidth={selected ? 1.5 : 0.75}
                opacity={dim ? 0.2 : 1}
              />
            )
          })}

          {renderedLabels.map((label) => {
            const x = xForLocal(label.localIndex)
            const y = yForPrice(label.price)
            const selected = selectedEventId === label.id
            const dim = hasSelection && !selected && highlightSwingId !== label.id
            const stack = stacks.get(label.id) ?? 0
            const labelY = label.preferAbove ? y - 22 - stack : y + 6 + stack
            const half = label.width / 2
            return (
              <g key={label.id} opacity={dim ? 0.18 : 1}>
                <rect
                  x={x - half}
                  y={labelY}
                  width={label.width}
                  height={14}
                  rx={3}
                  fill={label.bg}
                  opacity={selected ? 1 : 0.9}
                />
                <text
                  x={x}
                  y={labelY + 10}
                  textAnchor="middle"
                  fontSize={9}
                  fontWeight={700}
                  fill={label.fill}
                >
                  {label.text}
                </text>
              </g>
            )
          })}

          {[...overflowByCandle.entries()].map(([localIndex, extra]) => {
            const group = byCandle.get(localIndex) ?? []
            const preferAbove = group.some((g) => g.preferAbove)
            const price = group[0]?.price ?? 0
            const x = xForLocal(localIndex)
            const y = yForPrice(price)
            const labelY = preferAbove ? y - 22 - MAX_STACKED_LABELS * 12 : y + 6 + MAX_STACKED_LABELS * 12
            return (
              <g key={`overflow-${localIndex}`}>
                <rect
                  x={x - 28}
                  y={labelY}
                  width={56}
                  height={14}
                  rx={3}
                  fill="#334155"
                  opacity={0.95}
                />
                <text
                  x={x}
                  y={labelY + 10}
                  textAnchor="middle"
                  fontSize={9}
                  fontWeight={700}
                  fill="#e2e8f0"
                >
                  +{extra} events
                </text>
              </g>
            )
          })}

          {layers.manualMarks &&
            annotations.map((ann) => {
              const local = indexByTime.get(ann.timestamp)
              if (local == null) return null
              const x = xForLocal(local)
              const y = yForPrice(ann.price)
              return (
                <g key={ann.id} opacity={0.8}>
                  <rect
                    x={x - 3}
                    y={y - 3}
                    width={6}
                    height={6}
                    fill="none"
                    stroke="#fbbf24"
                    strokeWidth={1.5}
                  />
                  <text
                    x={x}
                    y={y - 8}
                    textAnchor="middle"
                    fontSize={8}
                    className="fill-amber-300"
                  >
                    M
                  </text>
                </g>
              )
            })}
        </svg>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Focused window: {candles.length} candles (indices {windowStartIndex}–
        {windowStartIndex + candles.length - 1}). eSH/eSL = external, iSH/iSL = internal. BOS/CHoCH
        mark the break close. Connector lines default off.
      </p>
    </div>
  )
}

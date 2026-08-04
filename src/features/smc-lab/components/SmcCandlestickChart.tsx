import type { Candle } from '@/data/candles'
import type { SmcBosEvent, SmcSwingEvent } from '@/core/smc'
import type { SmcManualAnnotation } from '../persistence/types'

export interface SmcChartLayerToggles {
  swings: boolean
  bosLabels: boolean
  bosLines: boolean
  manualMarks: boolean
  validationMarks: boolean
}

interface SmcCandlestickChartProps {
  candles: Candle[]
  swings: SmcSwingEvent[]
  bosEvents: SmcBosEvent[]
  annotations?: SmcManualAnnotation[]
  selectedEventId: string | null
  /** When a BOS is selected, highlight its broken swing. */
  highlightSwingId?: string | null
  layers: SmcChartLayerToggles
  windowStartIndex: number
  densityWarning?: string | null
}

const WIDTH = 720
const HEIGHT = 300
const PLOT = { left: 12, right: 48, top: 28, bottom: 28 }

/** Soft cap for labels in the visible window before density warning. */
export const SMC_MARKER_DENSITY_WARN = 18

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return '—'
  if (Math.abs(value) >= 1000) return value.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (Math.abs(value) >= 1) return value.toLocaleString('en-US', { maximumFractionDigits: 2 })
  return value.toLocaleString('en-US', { maximumFractionDigits: 5 })
}

/**
 * Stack labels that would collide on nearby x positions.
 * Returns pixel offset upward (negative y direction in SVG = subtract).
 */
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
      if (lane > 4) break
    }
    occupied.push({ x: item.localIndex, lane, above: item.preferAbove })
    offsets.set(item.id, lane * 12)
  }
  return offsets
}

export function SmcCandlestickChart({
  candles,
  swings,
  bosEvents,
  annotations = [],
  selectedEventId,
  highlightSwingId = null,
  layers,
  windowStartIndex,
  densityWarning = null,
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

  const xForLocal = (localIndex: number) =>
    candles.length === 1 ? PLOT.left + plotWidth / 2 : PLOT.left + localIndex * candleSlot
  const yForPrice = (price: number) => PLOT.top + ((yMax - price) / (yMax - yMin)) * plotHeight
  const indexByTime = new Map(candles.map((c, i) => [c.time, i]))

  const visibleSwings = layers.swings
    ? swings.filter((s) => {
        const local = s.candleIndex - windowStartIndex
        return local >= 0 && local < candles.length
      })
    : []

  const visibleBos = bosEvents.filter((e) => {
    const local = e.candleIndex - windowStartIndex
    return local >= 0 && local < candles.length
  })

  const labelItems = [
    ...visibleSwings.map((s) => ({
      id: s.id,
      localIndex: s.candleIndex - windowStartIndex,
      preferAbove: s.kind === 'SWING_HIGH',
    })),
    ...(layers.bosLabels
      ? visibleBos.map((e) => ({
          id: e.id,
          localIndex: e.candleIndex - windowStartIndex,
          preferAbove: e.kind === 'BULLISH_BOS',
        }))
      : []),
  ]
  const stacks = stackOffsets(labelItems)

  const hasSelection = Boolean(selectedEventId)
  const markerCount = visibleSwings.length + (layers.bosLabels ? visibleBos.length : 0)

  return (
    <div className="space-y-2">
      {densityWarning || markerCount >= SMC_MARKER_DENSITY_WARN ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
          {densityWarning ??
            `High marker density (${markerCount} in view). Select an event to focus, or tighten pivots.`}
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-xl border border-border/70 bg-slate-950/40 p-2">
        <svg
          role="img"
          aria-label="SMC Lab candlestick chart with swing and BOS markers"
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

          {layers.bosLines &&
            visibleBos.map((event) => {
              const breakLocal = event.candleIndex - windowStartIndex
              const swingLocal = event.brokenSwingCandleIndex - windowStartIndex
              if (breakLocal < 0 || breakLocal >= candles.length) return null
              if (swingLocal < 0 || swingLocal >= candles.length) return null
              const dim =
                hasSelection &&
                selectedEventId !== event.id &&
                highlightSwingId !== event.brokenSwingId
              const y = yForPrice(event.brokenSwingPrice)
              const color = event.kind === 'BULLISH_BOS' ? '#38bdf8' : '#fb923c'
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

          {visibleSwings.map((swing) => {
            const local = swing.candleIndex - windowStartIndex
            const x = xForLocal(local)
            const y = yForPrice(swing.price)
            const isHigh = swing.kind === 'SWING_HIGH'
            const selected =
              selectedEventId === swing.id || highlightSwingId === swing.id
            const dim = hasSelection && !selected
            const stack = stacks.get(swing.id) ?? 0
            return (
              <g key={swing.id} opacity={dim ? 0.2 : 1}>
                <circle
                  cx={x}
                  cy={y}
                  r={selected ? 5 : 3.5}
                  fill={isHigh ? '#c084fc' : '#2dd4bf'}
                  stroke="#fff"
                  strokeWidth={selected ? 1.5 : 0.75}
                />
                <text
                  x={x}
                  y={isHigh ? y - 8 - stack : y + 14 + stack}
                  textAnchor="middle"
                  fontSize={9}
                  fontWeight={600}
                  className={isHigh ? 'fill-purple-300' : 'fill-teal-300'}
                >
                  {isHigh ? 'SH' : 'SL'}
                </text>
              </g>
            )
          })}

          {layers.bosLabels &&
            visibleBos.map((event) => {
              const local = event.candleIndex - windowStartIndex
              const x = xForLocal(local)
              const y = yForPrice(event.closePrice)
              const bull = event.kind === 'BULLISH_BOS'
              const selected = selectedEventId === event.id
              const dim = hasSelection && !selected
              const stack = stacks.get(event.id) ?? 0
              const labelY = bull ? y - 22 - stack : y + 6 + stack
              return (
                <g key={event.id} opacity={dim ? 0.18 : 1}>
                  <rect
                    x={x - 18}
                    y={labelY}
                    width={36}
                    height={14}
                    rx={3}
                    fill={bull ? '#0ea5e9' : '#ea580c'}
                    opacity={selected ? 1 : 0.9}
                  />
                  <text
                    x={x}
                    y={labelY + 10}
                    textAnchor="middle"
                    fontSize={9}
                    fontWeight={700}
                    fill="#fff"
                  >
                    {bull ? 'BOS ↑' : 'BOS ↓'}
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
        {windowStartIndex + candles.length - 1}). SH/SL mark the swing bar; BOS marks the break
        close.
      </p>
    </div>
  )
}

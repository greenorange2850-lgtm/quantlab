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
  layers: SmcChartLayerToggles
  /** Windowed slice already applied by parent — full visible candle set. */
  windowStartIndex: number
}

const WIDTH = 720
const HEIGHT = 320
const PLOT = { left: 12, right: 48, top: 20, bottom: 28 }

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return '—'
  if (Math.abs(value) >= 1000) return value.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (Math.abs(value) >= 1) return value.toLocaleString('en-US', { maximumFractionDigits: 2 })
  return value.toLocaleString('en-US', { maximumFractionDigits: 5 })
}

export function SmcCandlestickChart({
  candles,
  swings,
  bosEvents,
  annotations = [],
  selectedEventId,
  layers,
  windowStartIndex,
}: SmcCandlestickChartProps) {
  if (candles.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-lg border border-dashed border-border/70 bg-white/[0.02] text-xs text-muted-foreground">
        Load market data and run detection to render the chart.
      </div>
    )
  }

  const prices = candles.flatMap((c) => [c.high, c.low])
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  const padding = Math.max((maxPrice - minPrice) * 0.08, Math.abs(maxPrice) * 0.001, 1e-8)
  const yMin = minPrice - padding
  const yMax = maxPrice + padding
  const plotWidth = WIDTH - PLOT.left - PLOT.right
  const plotHeight = HEIGHT - PLOT.top - PLOT.bottom
  const candleSlot = candles.length > 1 ? plotWidth / (candles.length - 1) : plotWidth
  const bodyWidth = clamp(candleSlot * 0.58, 1.5, 7)

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

  return (
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
            const swing = swings.find((s) => s.id === event.brokenSwingId)
            if (!swing) return null
            const swingLocal = swing.candleIndex - windowStartIndex
            if (swingLocal < 0 || breakLocal < 0) return null
            const y = yForPrice(event.brokenSwingPrice)
            const x1 = xForLocal(Math.max(0, swingLocal))
            const x2 = xForLocal(breakLocal)
            const color = event.kind === 'BULLISH_BOS' ? '#38bdf8' : '#fb923c'
            return (
              <line
                key={`line-${event.id}`}
                x1={x1}
                x2={x2}
                y1={y}
                y2={y}
                stroke={color}
                strokeWidth={selectedEventId === event.id ? 2 : 1}
                strokeDasharray="4 3"
                opacity={0.85}
              />
            )
          })}

        {visibleSwings.map((swing) => {
          const local = swing.candleIndex - windowStartIndex
          const x = xForLocal(local)
          const y = yForPrice(swing.price)
          const isHigh = swing.kind === 'SWING_HIGH'
          const selected = selectedEventId === swing.id
          return (
            <g key={swing.id}>
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
                y={isHigh ? y - 8 : y + 14}
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
            return (
              <g key={event.id}>
                <rect
                  x={x - 18}
                  y={bull ? y - 22 : y + 6}
                  width={36}
                  height={14}
                  rx={3}
                  fill={bull ? '#0ea5e9' : '#ea580c'}
                  opacity={selected ? 1 : 0.85}
                />
                <text
                  x={x}
                  y={bull ? y - 12 : y + 16}
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
  )
}

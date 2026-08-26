import type { Candle } from '@/data/candles'
import type { ReplayTradeMarker } from '@/core/backtest/execution-events'
import {
  PLAYBOOK_MARKER_COLORS,
  PLAYBOOK_MARKER_LABELS,
  playbookMarkerPlotPrice,
  type PlaybookReplayMarker,
} from '@/features/playbook/replay-markers'

interface ReplayCandlestickChartProps {
  candles: Candle[]
  markers: ReplayTradeMarker[]
  selectedTradeId: string | null
  visibleEntryMarkers: ReplayTradeMarker[]
  visibleExitMarkers: ReplayTradeMarker[]
  dimUnselected?: boolean
  playbookMarkers?: PlaybookReplayMarker[]
  selectedPlaybookMarkerId?: string | null
  showPlaybookLifecycleOutcome?: boolean
  onSelectPlaybookMarker?: (markerId: string) => void
}

const WIDTH = 360
const HEIGHT = 250
const PLOT = {
  left: 14,
  right: 32,
  top: 18,
  bottom: 26,
}

function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return 'Unavailable'
  if (Math.abs(value) >= 1000) return value.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (Math.abs(value) >= 1) return value.toLocaleString('en-US', { maximumFractionDigits: 2 })
  return value.toLocaleString('en-US', { maximumFractionDigits: 6 })
}

function markerLabel(marker: ReplayTradeMarker): 'BUY' | 'SELL' {
  return marker.direction === 'LONG' ? 'BUY' : 'SELL'
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function ReplayCandlestickChart({
  candles,
  markers,
  selectedTradeId,
  visibleEntryMarkers,
  visibleExitMarkers,
  dimUnselected = true,
  playbookMarkers = [],
  selectedPlaybookMarkerId = null,
  showPlaybookLifecycleOutcome = false,
  onSelectPlaybookMarker,
}: ReplayCandlestickChartProps) {
  const selectedMarker =
    markers.find((marker) => marker.tradeId === selectedTradeId) ?? visibleEntryMarkers.at(-1) ?? null
  const visibleEntryIds = new Set(visibleEntryMarkers.map((marker) => marker.tradeId))
  const visibleExitIds = new Set(visibleExitMarkers.map((marker) => marker.tradeId))
  const candleIndexByTime = new Map(candles.map((candle, index) => [candle.time, index]))
  const closeByTime = new Map(candles.map((candle) => [candle.time, candle.close]))
  const selectedPlaybookMarker =
    playbookMarkers.find((marker) => marker.id === selectedPlaybookMarkerId) ?? null

  if (candles.length === 0) {
    return (
      <div className="flex h-[240px] items-center justify-center rounded-lg border border-dashed border-border/70 bg-white/[0.02] text-xs text-muted-foreground">
        Replay candles unavailable for this window.
      </div>
    )
  }

  const markerPrices = visibleEntryMarkers.flatMap((marker) => [
    marker.entryPrice,
    marker.stopLossPrice,
    marker.takeProfitPrice,
    visibleExitIds.has(marker.tradeId) ? marker.exitPrice : null,
  ])
  const playbookPrices = playbookMarkers.flatMap((marker) => {
    const plot = playbookMarkerPlotPrice(marker, closeByTime)
    return [
      plot,
      marker.stopReference?.price ?? null,
      selectedPlaybookMarker?.id === marker.id ? marker.targets[0]?.price ?? null : null,
    ]
  })
  const prices = [
    ...candles.flatMap((candle) => [candle.high, candle.low]),
    ...markerPrices.filter((price): price is number => price != null && Number.isFinite(price)),
    ...playbookPrices.filter((price): price is number => price != null && Number.isFinite(price)),
  ]
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  const padding = Math.max((maxPrice - minPrice) * 0.08, Math.abs(maxPrice) * 0.001, 1e-8)
  const yMin = minPrice - padding
  const yMax = maxPrice + padding
  const plotWidth = WIDTH - PLOT.left - PLOT.right
  const plotHeight = HEIGHT - PLOT.top - PLOT.bottom
  const candleSlot = candles.length > 1 ? plotWidth / (candles.length - 1) : plotWidth
  const candleBodyWidth = clamp(candleSlot * 0.58, 2, 8)

  const xForIndex = (index: number) =>
    candles.length === 1 ? PLOT.left + plotWidth / 2 : PLOT.left + index * candleSlot
  const yForPrice = (price: number) => PLOT.top + ((yMax - price) / (yMax - yMin)) * plotHeight
  const xForTime = (time: number) => {
    const index = candleIndexByTime.get(time)
    return index == null ? null : xForIndex(index)
  }

  const selectedEntryX = selectedMarker ? xForTime(selectedMarker.entryTime) : null
  const selectedExitX = selectedMarker ? xForTime(selectedMarker.exitTime) : null
  const selectedEntryY = selectedMarker ? yForPrice(selectedMarker.entryPrice) : null
  const selectedExitY = selectedMarker ? yForPrice(selectedMarker.exitPrice) : null
  const selectedExitVisible = selectedMarker ? visibleExitIds.has(selectedMarker.tradeId) : false

  const gridPrices = [0.25, 0.5, 0.75].map((ratio) => yMin + (yMax - yMin) * ratio)

  return (
    <div className="rounded-xl border border-border/70 bg-slate-950/40 p-2">
      <svg
        role="img"
        aria-label={
          playbookMarkers.length > 0
            ? 'Backtest replay candlestick chart with trade and playbook markers'
            : 'Backtest replay candlestick chart with trade markers'
        }
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-[250px] w-full overflow-visible"
        preserveAspectRatio="none"
      >
        <rect x="0" y="0" width={WIDTH} height={HEIGHT} rx="14" fill="rgba(255,255,255,0.015)" />

        {gridPrices.map((price) => {
          const y = yForPrice(price)
          return (
            <g key={price}>
              <line
                x1={PLOT.left}
                x2={WIDTH - PLOT.right}
                y1={y}
                y2={y}
                stroke="rgba(255,255,255,0.06)"
                strokeDasharray="4 6"
              />
              <text x={WIDTH - PLOT.right + 5} y={y + 3} fill="#71717a" fontSize="9">
                {formatPrice(price)}
              </text>
            </g>
          )
        })}

        {selectedMarker && selectedEntryY != null && (
          <g>
            <line
              x1={PLOT.left}
              x2={WIDTH - PLOT.right}
              y1={selectedEntryY}
              y2={selectedEntryY}
              stroke={selectedMarker.direction === 'LONG' ? '#22c55e' : '#ef4444'}
              strokeOpacity="0.48"
              strokeDasharray="5 4"
            />
            <text x={PLOT.left + 4} y={selectedEntryY - 5} fill="#d4d4d8" fontSize="9">
              Entry {formatPrice(selectedMarker.entryPrice)}
            </text>
          </g>
        )}

        {selectedMarker && selectedExitY != null && selectedExitVisible && (
          <g>
            <line
              x1={PLOT.left}
              x2={WIDTH - PLOT.right}
              y1={selectedExitY}
              y2={selectedExitY}
              stroke="#a78bfa"
              strokeOpacity="0.5"
              strokeDasharray="3 5"
            />
            <text x={PLOT.left + 4} y={selectedExitY + 12} fill="#d4d4d8" fontSize="9">
              Exit {formatPrice(selectedMarker.exitPrice)}
            </text>
          </g>
        )}

        {selectedMarker?.stopLossPrice != null && (
          <g>
            <line
              x1={PLOT.left}
              x2={WIDTH - PLOT.right}
              y1={yForPrice(selectedMarker.stopLossPrice)}
              y2={yForPrice(selectedMarker.stopLossPrice)}
              stroke="#f97316"
              strokeOpacity="0.5"
              strokeDasharray="2 4"
            />
            <text
              x={WIDTH - PLOT.right - 58}
              y={yForPrice(selectedMarker.stopLossPrice) - 4}
              fill="#fb923c"
              fontSize="9"
            >
              Stop {formatPrice(selectedMarker.stopLossPrice)}
            </text>
          </g>
        )}

        {selectedMarker?.takeProfitPrice != null && (
          <g>
            <line
              x1={PLOT.left}
              x2={WIDTH - PLOT.right}
              y1={yForPrice(selectedMarker.takeProfitPrice)}
              y2={yForPrice(selectedMarker.takeProfitPrice)}
              stroke="#38bdf8"
              strokeOpacity="0.5"
              strokeDasharray="2 4"
            />
            <text
              x={WIDTH - PLOT.right - 52}
              y={yForPrice(selectedMarker.takeProfitPrice) - 4}
              fill="#7dd3fc"
              fontSize="9"
            >
              TP {formatPrice(selectedMarker.takeProfitPrice)}
            </text>
          </g>
        )}

        {selectedMarker &&
          selectedEntryX != null &&
          selectedExitX != null &&
          selectedEntryY != null &&
          selectedExitY != null &&
          selectedExitVisible && (
            <line
              x1={selectedEntryX}
              x2={selectedExitX}
              y1={selectedEntryY}
              y2={selectedExitY}
              stroke="#f8fafc"
              strokeOpacity="0.72"
              strokeWidth="1.5"
            />
          )}

        {candles.map((candle, index) => {
          const x = xForIndex(index)
          const openY = yForPrice(candle.open)
          const closeY = yForPrice(candle.close)
          const highY = yForPrice(candle.high)
          const lowY = yForPrice(candle.low)
          const up = candle.close >= candle.open
          const bodyTop = Math.min(openY, closeY)
          const bodyHeight = Math.max(1, Math.abs(closeY - openY))
          const color = up ? '#22c55e' : '#ef4444'

          return (
            <g key={candle.time}>
              <line x1={x} x2={x} y1={highY} y2={lowY} stroke={color} strokeOpacity="0.65" />
              <rect
                x={x - candleBodyWidth / 2}
                y={bodyTop}
                width={candleBodyWidth}
                height={bodyHeight}
                rx="1"
                fill={color}
                fillOpacity={up ? 0.42 : 0.5}
                stroke={color}
                strokeOpacity="0.75"
              />
            </g>
          )
        })}

        {visibleEntryMarkers.map((marker) => {
          const x = xForTime(marker.entryTime)
          if (x == null) return null
          const y = yForPrice(marker.entryPrice)
          const isSelected = marker.tradeId === selectedTradeId
          const label = markerLabel(marker)
          const color = marker.direction === 'LONG' ? '#22c55e' : '#ef4444'
          const opacity = dimUnselected && selectedTradeId && !isSelected ? 0.4 : 1

          return (
            <g key={`entry-${marker.tradeId}`} opacity={opacity}>
              <circle cx={x} cy={y} r={isSelected ? 4.5 : 3.5} fill={color} stroke="#020617" strokeWidth="1.5" />
              <rect
                x={clamp(x - 17, PLOT.left, WIDTH - PLOT.right - 34)}
                y={clamp(y - 25, 2, HEIGHT - 42)}
                width="34"
                height="15"
                rx="4"
                fill={color}
                fillOpacity="0.2"
                stroke={color}
                strokeOpacity="0.6"
              />
              <text
                x={clamp(x, PLOT.left + 17, WIDTH - PLOT.right - 17)}
                y={clamp(y - 14, 13, HEIGHT - 31)}
                fill="#f8fafc"
                textAnchor="middle"
                fontSize="9"
                fontWeight="700"
              >
                {label}
              </text>
            </g>
          )
        })}

        {visibleExitMarkers.map((marker) => {
          const x = xForTime(marker.exitTime)
          if (x == null || !visibleEntryIds.has(marker.tradeId)) return null
          const y = yForPrice(marker.exitPrice)
          const isSelected = marker.tradeId === selectedTradeId
          const opacity = dimUnselected && selectedTradeId && !isSelected ? 0.4 : 1

          return (
            <g key={`exit-${marker.tradeId}`} opacity={opacity}>
              <path
                d={`M ${x} ${y - 5} L ${x + 5} ${y} L ${x} ${y + 5} L ${x - 5} ${y} Z`}
                fill="#a78bfa"
                stroke="#020617"
                strokeWidth="1.2"
              />
              <text x={clamp(x, PLOT.left + 12, WIDTH - PLOT.right - 12)} y={y + 17} fill="#ddd6fe" textAnchor="middle" fontSize="9" fontWeight="700">
                EXIT
              </text>
            </g>
          )
        })}

        {selectedPlaybookMarker?.stopReference && (
          <g>
            <line
              x1={PLOT.left}
              x2={WIDTH - PLOT.right}
              y1={yForPrice(selectedPlaybookMarker.stopReference.price)}
              y2={yForPrice(selectedPlaybookMarker.stopReference.price)}
              stroke="#f97316"
              strokeOpacity="0.45"
              strokeDasharray="2 4"
            />
            <text
              x={WIDTH - PLOT.right - 62}
              y={yForPrice(selectedPlaybookMarker.stopReference.price) - 4}
              fill="#fdba74"
              fontSize="9"
            >
              PB Stop {formatPrice(selectedPlaybookMarker.stopReference.price)}
            </text>
          </g>
        )}

        {selectedPlaybookMarker?.targets[0] && (
          <g>
            <line
              x1={PLOT.left}
              x2={WIDTH - PLOT.right}
              y1={yForPrice(selectedPlaybookMarker.targets[0].price)}
              y2={yForPrice(selectedPlaybookMarker.targets[0].price)}
              stroke="#38bdf8"
              strokeOpacity="0.45"
              strokeDasharray="2 4"
            />
            <text
              x={WIDTH - PLOT.right - 52}
              y={yForPrice(selectedPlaybookMarker.targets[0].price) - 4}
              fill="#7dd3fc"
              fontSize="9"
            >
              PB T1 {formatPrice(selectedPlaybookMarker.targets[0].price)}
            </text>
          </g>
        )}

        {playbookMarkers.map((marker) => {
          const x = xForTime(marker.timeMs)
          const price = playbookMarkerPlotPrice(marker, closeByTime)
          if (x == null || price == null) return null
          const y = yForPrice(price)
          const isSelected = marker.id === selectedPlaybookMarkerId
          const color = PLAYBOOK_MARKER_COLORS[marker.setupStatus]
          const label = PLAYBOOK_MARKER_LABELS[marker.setupStatus]
          const opacity =
            dimUnselected && selectedPlaybookMarkerId && !isSelected ? 0.45 : 1
          const outcome =
            showPlaybookLifecycleOutcome && marker.lifecycleOutcome
              ? marker.lifecycleOutcome
              : null

          return (
            <g
              key={`playbook-${marker.id}`}
              opacity={opacity}
              style={{ cursor: onSelectPlaybookMarker ? 'pointer' : undefined }}
              onClick={() => onSelectPlaybookMarker?.(marker.id)}
            >
              <rect
                x={x - 6}
                y={y - 6}
                width="12"
                height="12"
                rx="2"
                fill={color}
                fillOpacity={isSelected ? 0.95 : 0.75}
                stroke={isSelected ? '#f8fafc' : '#020617'}
                strokeWidth={isSelected ? 1.6 : 1.2}
                transform={`rotate(45 ${x} ${y})`}
              />
              <rect
                x={clamp(x - 18, PLOT.left, WIDTH - PLOT.right - 36)}
                y={clamp(y + 8, 2, HEIGHT - 28)}
                width="36"
                height="13"
                rx="3"
                fill={color}
                fillOpacity="0.18"
                stroke={color}
                strokeOpacity="0.55"
              />
              <text
                x={clamp(x, PLOT.left + 18, WIDTH - PLOT.right - 18)}
                y={clamp(y + 18, 12, HEIGHT - 18)}
                fill="#f8fafc"
                textAnchor="middle"
                fontSize="8"
                fontWeight="700"
              >
                {label}
              </text>
              {outcome ? (
                <text
                  x={clamp(x, PLOT.left + 18, WIDTH - PLOT.right - 18)}
                  y={clamp(y + 29, 22, HEIGHT - 6)}
                  fill="#c4b5fd"
                  textAnchor="middle"
                  fontSize="7"
                  fontWeight="600"
                >
                  OUT {PLAYBOOK_MARKER_LABELS[outcome.status]}
                </text>
              ) : null}
            </g>
          )
        })}
      </svg>
      <div className="mt-1 flex flex-wrap items-center gap-2 px-1 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-success/80" /> BUY / long entry
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-danger/80" /> SELL / short entry
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rotate-45 bg-violet-400/80" /> EXIT
        </span>
        {playbookMarkers.length > 0 ? (
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rotate-45 bg-amber-400/80" /> Playbook setup
          </span>
        ) : null}
        {showPlaybookLifecycleOutcome ? (
          <span className="inline-flex items-center gap-1 text-violet-300">
            OUT = later historical outcome
          </span>
        ) : null}
      </div>
    </div>
  )
}

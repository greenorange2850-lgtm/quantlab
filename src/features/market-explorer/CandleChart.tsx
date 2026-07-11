import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useCandles } from '@/api/queries/market-data'
import type { Candle } from '@/types'

interface CandleChartProps {
  symbolId: string | null
  timeframeId: string | null
}

function toChartData(candles: Candle[]) {
  return candles.map((c) => ({
    date: c.timestamp.split('T')[0],
    range: [c.low, c.high] as [number, number],
    open: c.open,
    close: c.close,
    bullish: c.close >= c.open,
    body: Math.abs(c.close - c.open),
    wick: c.high - c.low,
  }))
}

const CustomTooltip = ({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: ReturnType<typeof toChartData>[0] }>
}) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-lg border border-border bg-card-solid/95 p-3 text-xs shadow-xl">
      <p className="text-muted-foreground mb-1">{d.date}</p>
      <p>O: <span className="font-mono">{d.open}</span></p>
      <p>H: <span className="font-mono">{d.range[1]}</span></p>
      <p>L: <span className="font-mono">{d.range[0]}</span></p>
      <p>C: <span className="font-mono">{d.close}</span></p>
    </div>
  )
}

export function CandleChart({ symbolId, timeframeId }: CandleChartProps) {
  const { data: candles, isLoading } = useCandles(symbolId, timeframeId, 100)

  if (!symbolId || !timeframeId) return null

  if (isLoading) return <Skeleton className="h-[300px] rounded-xl" />

  if (!candles?.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No candle data to display. Import data to see the chart.
        </CardContent>
      </Card>
    )
  }

  const chartData = toChartData(candles)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Price Chart</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#71717a' }}
                interval="preserveStartEnd"
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fontSize: 10, fill: '#71717a' }}
                axisLine={false}
                tickLine={false}
                width={60}
                tickFormatter={(v: number) => v.toFixed(2)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="wick"
                fill="#6366f1"
                opacity={0.3}
                barSize={6}
                animationDuration={800}
              />
              <Bar
                dataKey="body"
                fill="#22c55e"
                opacity={0.8}
                barSize={4}
                animationDuration={800}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

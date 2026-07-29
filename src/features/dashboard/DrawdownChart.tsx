import { motion } from 'framer-motion'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { TrendingDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { formatPercent } from '@/lib/utils'
import type { EquityPoint } from '@/types'

interface DrawdownChartProps {
  data: EquityPoint[]
}

interface DrawdownChartPoint {
  date: string
  drawdown: number
}

const DrawdownTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; name: string; color: string }>
  label?: string
}) => {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border border-border bg-card-solid/95 backdrop-blur-xl p-3 shadow-xl">
      <p className="text-[10px] text-muted-foreground mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-xs">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted">{entry.name}:</span>
          <span className="font-mono font-medium text-danger">
            {formatPercent(-Math.abs(entry.value))}
          </span>
        </div>
      ))}
    </div>
  )
}

function toChartData(points: EquityPoint[]): DrawdownChartPoint[] {
  return points.map((point) => ({
    date: point.date,
    // Underwater chart: store depth as negative percent for visual convention
    drawdown: -Math.abs(point.drawdown),
  }))
}

export function DrawdownChart({ data }: DrawdownChartProps) {
  const chartData = toChartData(data)
  const maxDrawdown = data.reduce((max, point) => Math.max(max, Math.abs(point.drawdown)), 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.25 }}
    >
      <Card glow className="col-span-full">
        <CardHeader className="flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="text-base">Drawdown</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Portfolio drawdown over the backtest equity curve
            </p>
          </div>
          {data.length > 0 && (
            <Badge variant="danger">Max {formatPercent(-maxDrawdown)}</Badge>
          )}
        </CardHeader>
        <CardContent className="pb-4">
          {data.length === 0 ? (
            <EmptyState
              title="No drawdown data"
              description="Run a backtest in Strategy Lab to populate the drawdown chart from equity curve results."
              icon={<TrendingDown className="h-6 w-6" />}
              className="py-16"
            />
          ) : (
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0} />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0.35} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: '#71717a' }}
                    tickFormatter={(value: string) => {
                      const date = new Date(value)
                      return date.toLocaleDateString('en-US', { month: 'short' })
                    }}
                    interval="preserveStartEnd"
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#71717a' }}
                    tickFormatter={(value: number) => `${value.toFixed(0)}%`}
                    axisLine={false}
                    tickLine={false}
                    width={45}
                    domain={['dataMin', 0]}
                  />
                  <Tooltip content={<DrawdownTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="drawdown"
                    name="Drawdown"
                    stroke="#ef4444"
                    strokeWidth={2}
                    fill="url(#drawdownGradient)"
                    animationDuration={1500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

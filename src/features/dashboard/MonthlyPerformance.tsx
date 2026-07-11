import { motion } from 'framer-motion'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import type { MonthlyProfit, DailyHeatmapCell, WeeklySummary } from '@/types'

interface MonthlyPerformanceProps {
  monthlyProfit: MonthlyProfit[]
  dailyHeatmap: DailyHeatmapCell[]
  weeklySummary: WeeklySummary[]
}

function getHeatmapColor(profit: number): string {
  if (profit > 400) return '#22c55e'
  if (profit > 100) return '#4ade80'
  if (profit > 0) return '#86efac'
  if (profit > -100) return '#fca5a5'
  if (profit > -400) return '#f87171'
  return '#ef4444'
}

export function MonthlyPerformance({
  monthlyProfit,
  dailyHeatmap,
  weeklySummary,
}: MonthlyPerformanceProps) {
  const maxWeek = Math.max(...dailyHeatmap.map((c) => c.week))
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <motion.div
      className="grid grid-cols-1 lg:grid-cols-3 gap-4"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Monthly Profit</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyProfit} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10, fill: '#71717a' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#71717a' }}
                  tickFormatter={(v: number) => `$${(v / 1000).toFixed(1)}k`}
                  axisLine={false}
                  tickLine={false}
                  width={45}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    return (
                      <div className="rounded-lg border border-border bg-card-solid/95 p-3 text-xs shadow-xl">
                        <p className="text-muted-foreground mb-1">{label}</p>
                        <p className="font-mono font-medium">
                          {formatCurrency(payload[0].value as number)}
                        </p>
                        <p className="text-muted-foreground mt-1">
                          {payload[0].payload.trades} trades
                        </p>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="profit" radius={[4, 4, 0, 0]} animationDuration={1200}>
                  {monthlyProfit.map((entry) => (
                    <Cell
                      key={entry.month}
                      fill={entry.profit >= 0 ? '#6366f1' : '#ef4444'}
                      fillOpacity={0.85}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daily Profit Heatmap</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-1 mb-2">
            {dayLabels.map((d) => (
              <div key={d} className="flex-1 text-center text-[9px] text-muted-foreground">
                {d}
              </div>
            ))}
          </div>
          <div className="space-y-1">
            {Array.from({ length: maxWeek + 1 }, (_, week) => (
              <div key={week} className="flex gap-1">
                {Array.from({ length: 7 }, (_, day) => {
                  const cell = dailyHeatmap.find((c) => c.week === week && c.day === day)
                  return (
                    <div
                      key={day}
                      className="flex-1 aspect-square rounded-sm transition-transform hover:scale-110 cursor-pointer"
                      style={{
                        backgroundColor: cell
                          ? getHeatmapColor(cell.profit)
                          : 'rgba(255,255,255,0.03)',
                        opacity: cell ? 0.85 : 0.3,
                      }}
                      title={cell ? `${cell.date}: ${formatCurrency(cell.profit)}` : ''}
                    />
                  )
                })}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-3 text-[9px] text-muted-foreground">
            <span>Loss</span>
            <div className="flex gap-0.5">
              {['#ef4444', '#f87171', '#fca5a5', '#86efac', '#4ade80', '#22c55e'].map((c) => (
                <div key={c} className="h-2 w-3 rounded-sm" style={{ backgroundColor: c }} />
              ))}
            </div>
            <span>Profit</span>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle>Weekly Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {weeklySummary.map((week) => (
              <div
                key={week.week}
                className="rounded-lg border border-border bg-white/[0.02] p-3 hover:bg-white/[0.04] transition-colors"
              >
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  {week.week}
                </p>
                <p
                  className={`text-sm font-semibold font-mono mt-1 ${
                    week.profit >= 0 ? 'text-success' : 'text-danger'
                  }`}
                >
                  {formatCurrency(week.profit)}
                </p>
                <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
                  <span>{week.trades} trades</span>
                  <span>{week.winRate}% WR</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

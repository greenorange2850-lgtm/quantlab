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
import { Disclosure } from '@/components/ui/disclosure'
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
  const maxWeek = Math.max(0, ...dailyHeatmap.map((c) => c.week))
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <motion.div
      className="min-w-0 space-y-4"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Monthly Profit</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[180px] w-full min-w-0 sm:h-[220px]">
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
                        <p className="mb-1 text-muted-foreground">{label}</p>
                        <p className="font-mono font-medium">
                          {formatCurrency(payload[0].value as number)}
                        </p>
                        <p className="mt-1 text-muted-foreground">
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

      <Disclosure title="Heatmap & weekly summary">
        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-3">
          <Card hover={false} className="border-0 bg-transparent shadow-none lg:col-span-1">
            <CardHeader className="px-0 pt-0">
              <CardTitle className="text-xs">Daily Profit Heatmap</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="mb-2 flex gap-1">
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
                          className="aspect-square flex-1 cursor-pointer rounded-sm transition-transform hover:scale-110"
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
            </CardContent>
          </Card>

          <div className="lg:col-span-2">
            <p className="mb-3 text-xs font-semibold">Weekly Summary</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {weeklySummary.map((week) => (
                <div
                  key={week.week}
                  className="rounded-lg border border-border bg-white/[0.02] p-3"
                >
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {week.week}
                  </p>
                  <p
                    className={`mt-1 font-mono text-sm font-semibold ${
                      week.profit >= 0 ? 'text-success' : 'text-danger'
                    }`}
                  >
                    {formatCurrency(week.profit)}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{week.trades} trades</span>
                    <span>{week.winRate}% WR</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Disclosure>
    </motion.div>
  )
}

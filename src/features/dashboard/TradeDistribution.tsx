import { motion } from 'framer-motion'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DistributionItem } from '@/types'

interface TradeDistributionProps {
  winLoss: DistributionItem[]
  longShort: DistributionItem[]
  session: DistributionItem[]
  timeframe: DistributionItem[]
  risk: DistributionItem[]
}

function DonutChart({
  data,
  title,
  size = 120,
}: {
  data: DistributionItem[]
  title: string
  size?: number
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        <div style={{ width: size, height: size }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={size * 0.32}
                outerRadius={size * 0.45}
                paddingAngle={3}
                dataKey="value"
                animationDuration={1200}
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const item = payload[0].payload as DistributionItem
                  return (
                    <div className="rounded-lg border border-border bg-card-solid/95 p-2 text-xs shadow-xl">
                      <span style={{ color: item.color }}>{item.name}</span>: {item.value} (
                      {((item.value / total) * 100).toFixed(1)}%)
                    </div>
                  )
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
          {data.map((item) => (
            <div key={item.name} className="flex items-center gap-1.5 text-[10px]">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-muted">{item.name}</span>
              <span className="font-mono font-medium">{item.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function TradeDistribution({
  winLoss,
  longShort,
  session,
  timeframe,
  risk,
}: TradeDistributionProps) {
  const charts = [
    { data: winLoss, title: 'Win vs Loss' },
    { data: longShort, title: 'Long vs Short' },
    { data: session, title: 'Session Distribution' },
    { data: timeframe, title: 'Timeframe Distribution' },
    { data: risk, title: 'Risk Distribution' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.35 }}
    >
      <h2 className="text-sm font-semibold mb-3">Trade Distribution</h2>
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {charts.map((chart, i) => (
          <motion.div
            key={chart.title}
            className="min-w-0"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.4 + i * 0.05 }}
          >
            <DonutChart data={chart.data} title={chart.title} />
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import type { EquityPoint } from '@/types'

interface EquityCurveChartProps {
  data: EquityPoint[]
}

const CustomTooltip = ({
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
    <div className="rounded-lg border border-border bg-card-solid/95 p-3 shadow-xl backdrop-blur-xl">
      <p className="mb-2 text-[10px] text-muted-foreground">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-xs">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted">{entry.name}:</span>
          <span className="font-mono font-medium">{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

export function EquityCurveChart({ data }: EquityCurveChartProps) {
  const [showBuyHold, setShowBuyHold] = useState(true)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <Card glow className="col-span-full min-w-0">
        <CardHeader className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Equity Curve</CardTitle>
          <Button
            variant={showBuyHold ? 'outline' : 'ghost'}
            size="sm"
            className="min-h-11 w-full sm:min-h-8 sm:w-auto"
            onClick={() => setShowBuyHold(!showBuyHold)}
          >
            {showBuyHold ? 'Hide Buy & Hold' : 'Show Buy & Hold'}
          </Button>
        </CardHeader>
        <CardContent className="min-w-0 pb-4 pt-2">
          <div className="h-[240px] w-full min-w-0 sm:h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="strategyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="buyHoldGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#71717a" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#71717a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#71717a' }}
                  tickFormatter={(v: string) => {
                    const d = new Date(v)
                    return d.toLocaleDateString('en-US', { month: 'short' })
                  }}
                  interval="preserveStartEnd"
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#71717a' }}
                  tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                  axisLine={false}
                  tickLine={false}
                  width={50}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                  iconType="circle"
                  iconSize={8}
                />
                <Area
                  type="monotone"
                  dataKey="equity"
                  name="Strategy"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#strategyGradient)"
                  animationDuration={1500}
                />
                {showBuyHold && (
                  <Area
                    type="monotone"
                    dataKey="buyHold"
                    name="Buy & Hold"
                    stroke="#71717a"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    fill="url(#buyHoldGradient)"
                    animationDuration={1500}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

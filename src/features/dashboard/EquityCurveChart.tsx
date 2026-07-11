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
import { ZoomIn, Calendar } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
    <div className="rounded-lg border border-border bg-card-solid/95 backdrop-blur-xl p-3 shadow-xl">
      <p className="text-[10px] text-muted-foreground mb-2">{label}</p>
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
      <Card glow className="col-span-full">
        <CardHeader className="flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="text-base">Equity Curve</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Strategy performance vs Buy & Hold benchmark
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={showBuyHold ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setShowBuyHold(!showBuyHold)}
            >
              Compare Buy & Hold
            </Button>
            <Button variant="ghost" size="sm">
              <Calendar className="h-3.5 w-3.5 mr-1.5" />
              Date Filter
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="flex items-center gap-3 mb-4">
            <Badge variant="accent">Strategy</Badge>
            {showBuyHold && <Badge variant="outline">Buy & Hold</Badge>}
          </div>
          <div className="h-[320px] w-full">
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
                  wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }}
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

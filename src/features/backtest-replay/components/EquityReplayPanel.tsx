import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { EquityPoint } from '@/core/backtest/BacktestResult'
import type { Trade } from '@/core/backtest/Trade'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { equityAtCursor, maxDrawdownAtCursor, realizedPnlThrough } from '../replay-window'

interface EquityReplayPanelProps {
  initialCapital: number
  finalEquity: number
  equityCurve: EquityPoint[]
  trades: Trade[]
  cursorTime: number | null
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'success' | 'danger'
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-white/[0.02] p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={tone === 'success' ? 'mt-1 font-mono text-sm text-success' : tone === 'danger' ? 'mt-1 font-mono text-sm text-danger' : 'mt-1 font-mono text-sm text-foreground'}>
        {value}
      </p>
    </div>
  )
}

export function EquityReplayPanel({
  initialCapital,
  finalEquity,
  equityCurve,
  trades,
  cursorTime,
}: EquityReplayPanelProps) {
  const currentPoint = equityAtCursor(equityCurve, cursorTime)
  const currentEquity = currentPoint?.equity ?? initialCapital
  const realized = realizedPnlThrough(trades, cursorTime)
  const drawdown = maxDrawdownAtCursor(equityCurve, cursorTime, initialCapital)
  const chartData = equityCurve.map((point) => ({
    time: point.time,
    date: new Date(point.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    equity: point.equity,
  }))

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Equity Replay</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Metric label="Initial Equity" value={formatCurrency(initialCapital)} />
          <Metric
            label="Current Equity"
            value={formatCurrency(currentEquity)}
            tone={currentEquity >= initialCapital ? 'success' : 'danger'}
          />
          <Metric
            label="Realized P&L"
            value={formatCurrency(realized)}
            tone={realized >= 0 ? 'success' : 'danger'}
          />
          <Metric
            label="Final Equity"
            value={formatCurrency(finalEquity)}
            tone={finalEquity >= initialCapital ? 'success' : 'danger'}
          />
          <Metric label="Max Drawdown" value={formatPercent(-drawdown * 100)} tone="danger" />
        </div>

        <div className="h-[180px] rounded-lg border border-border/60 bg-white/[0.02] p-2">
          {chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="replayEquityGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#71717a' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  width={46}
                  tick={{ fontSize: 10, fill: '#71717a' }}
                  tickFormatter={(value: number) => `$${(value / 1000).toFixed(0)}k`}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value))}
                  labelClassName="text-[10px] text-muted-foreground"
                  contentStyle={{
                    background: 'rgba(15, 23, 42, 0.96)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 10,
                    fontSize: 11,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="equity"
                  name="Equity"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#replayEquityGradient)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              Equity curve unavailable.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

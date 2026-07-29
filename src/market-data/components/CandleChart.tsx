import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useMdeCandles } from '../hooks/useMarketData'

interface CandleChartProps {
  symbol: string | null
  timeframe: string | null
}

export function CandleChart({ symbol, timeframe }: CandleChartProps) {
  const { data, isLoading } = useMdeCandles(symbol, timeframe, 150)

  if (!symbol || !timeframe) return null
  if (isLoading) return <Skeleton className="h-[280px] rounded-xl" />
  if (!data?.length) return null

  const chartData = data.map((c) => ({
    date: String(c.timestamp).split('T')[0],
    body: Math.abs(Number(c.close) - Number(c.open)),
    wick: Number(c.high) - Number(c.low),
    close: Number(c.close),
  }))

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Price Chart</CardTitle></CardHeader>
      <CardContent className="min-w-0">
        <div className="h-[220px] w-full min-w-0 sm:h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} width={55} />
              <Tooltip contentStyle={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="wick" fill="#6366f1" opacity={0.25} barSize={5} />
              <Bar dataKey="body" fill="#22c55e" opacity={0.7} barSize={3} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

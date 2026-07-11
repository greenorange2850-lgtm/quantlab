import { Database, Calendar, BarChart2, Shield } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { useMdeRange, useMdeQuality } from '../hooks/useMarketData'

interface DataOverviewProps {
  symbol: string | null
  timeframe: string | null
}

export function DataOverview({ symbol, timeframe }: DataOverviewProps) {
  const { data: range, isLoading: rangeLoading } = useMdeRange(symbol, timeframe)
  const { data: quality, isLoading: qualityLoading } = useMdeQuality(symbol, timeframe)

  if (!symbol || !timeframe) {
    return <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Select symbol and timeframe</CardContent></Card>
  }

  if (rangeLoading) return <Skeleton className="h-36 rounded-xl" />

  const hasData = range && range.count > 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Database className="h-4 w-4 text-accent" />
          {symbol} / {timeframe}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat icon={BarChart2} label="Candles" value={range.count.toLocaleString()} />
            <Stat icon={Calendar} label="Start" value={range.start?.split('T')[0] ?? '—'} />
            <Stat icon={Calendar} label="End" value={range.end?.split('T')[0] ?? '—'} />
            <div className="rounded-lg border border-border bg-white/[0.02] p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Shield className="h-3 w-3" /><span className="text-[10px] uppercase tracking-wider">Quality</span>
              </div>
              {qualityLoading ? <Skeleton className="h-6 w-16" /> : (
                <>
                  <p className="text-xl font-semibold font-mono text-accent">{(quality?.qualityScore as number) ?? '—'}%</p>
                  <Progress value={(quality?.qualityScore as number) ?? 0} className="mt-2 h-1" />
                </>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">No data — import to begin</p>
        )}
      </CardContent>
    </Card>
  )
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-white/[0.02] p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        <Icon className="h-3 w-3" /><span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-sm font-mono font-medium">{value}</p>
    </div>
  )
}

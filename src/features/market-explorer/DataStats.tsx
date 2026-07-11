import { Database, Calendar, BarChart2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useCandleStats } from '@/api/queries/market-data'

interface DataStatsProps {
  symbolId: string | null
  timeframeId: string | null
  symbolName?: string
  timeframeCode?: string
}

export function DataStats({ symbolId, timeframeId, symbolName, timeframeCode }: DataStatsProps) {
  const { data: stats, isLoading } = useCandleStats(symbolId, timeframeId)

  if (!symbolId || !timeframeId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Select a symbol and timeframe to view data statistics
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return <Skeleton className="h-32 rounded-xl" />
  }

  const hasData = stats && stats.count > 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Database className="h-4 w-4 text-accent" />
          Data Overview
          {symbolName && timeframeCode && (
            <span className="text-muted-foreground font-normal">
              · {symbolName} / {timeframeCode}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border border-border bg-white/[0.02] p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <BarChart2 className="h-3 w-3" />
                <span className="text-[10px] uppercase tracking-wider">Candles</span>
              </div>
              <p className="text-xl font-semibold font-mono">{stats.count.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border border-border bg-white/[0.02] p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Calendar className="h-3 w-3" />
                <span className="text-[10px] uppercase tracking-wider">Start</span>
              </div>
              <p className="text-sm font-mono">{stats.startDate?.split('T')[0] ?? '—'}</p>
            </div>
            <div className="rounded-lg border border-border bg-white/[0.02] p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Calendar className="h-3 w-3" />
                <span className="text-[10px] uppercase tracking-wider">End</span>
              </div>
              <p className="text-sm font-mono">{stats.endDate?.split('T')[0] ?? '—'}</p>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">No candle data imported yet</p>
            <p className="text-xs text-muted-foreground mt-1">Upload a file to populate this dataset</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

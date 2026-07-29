import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useMdeQuality } from '../hooks/useMarketData'
import { History } from 'lucide-react'

interface QualityReportProps {
  symbol: string | null
  timeframe: string | null
}

export function QualityReport({ symbol, timeframe }: QualityReportProps) {
  const { data, isLoading } = useMdeQuality(symbol, timeframe)

  if (!symbol || !timeframe) return null
  if (isLoading) return <Skeleton className="h-40 rounded-xl" />
  if (!data) return null

  const issues = (data.report as { issues?: Array<{ type: string; count: number; description: string }> })?.issues ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <History className="h-4 w-4" /> Validation Report
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Quality Score</span>
          <span className="text-2xl font-bold font-mono text-accent">{data.qualityScore as number}%</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
          {[
            { label: 'Missing', value: data.missingCandles },
            { label: 'Duplicates', value: data.duplicateCandles },
            { label: 'Invalid OHLC', value: data.invalidOhlc },
            { label: 'Neg. Prices', value: data.negativePrices },
            { label: 'TZ Issues', value: data.timezoneIssues },
            { label: 'Weekend Gaps', value: data.weekendGaps },
          ].map((item) => (
            <div key={item.label} className="min-w-0 rounded-md bg-white/[0.03] p-2">
              <p className="truncate text-[10px] text-muted-foreground">{item.label}</p>
              <p className="font-mono font-medium">{String(item.value)}</p>
            </div>
          ))}
        </div>
        {issues.length > 0 && (
          <div className="space-y-1">
            {issues.map((issue) => (
              <div key={issue.type} className="flex items-center justify-between text-xs py-1">
                <span className="text-muted-foreground">{issue.description}</span>
                <Badge variant="outline" className="text-[10px]">{issue.count}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

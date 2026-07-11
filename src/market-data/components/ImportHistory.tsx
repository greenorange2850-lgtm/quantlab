import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useMdeImports } from '../hooks/useMarketData'
import { Clock } from 'lucide-react'

export function ImportHistory() {
  const { data, isLoading } = useMdeImports()

  if (isLoading) return <Skeleton className="h-48 rounded-xl" />

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="h-4 w-4" /> Import History
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {!data?.length ? (
          <p className="text-sm text-muted-foreground text-center py-6">No imports yet</p>
        ) : (
          <div className="divide-y divide-border/50">
            {data.map((job) => (
              <div key={String(job.id)} className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] text-xs">
                <div>
                  <p className="font-medium">{String(job.fileName ?? job.source)}</p>
                  <p className="text-muted-foreground mt-0.5">{String(job.symbol)} / {String(job.timeframe)}</p>
                </div>
                <div className="text-right space-y-1">
                  <Badge variant={job.status === 'completed' ? 'success' : job.status === 'failed' ? 'danger' : 'accent'} className="text-[10px] capitalize">
                    {String(job.status)}
                  </Badge>
                  <p className="font-mono text-muted-foreground">
                    {String(job.rowsImported)} imported · {String(job.rowsRejected)} rejected
                  </p>
                  {job.qualityScore != null && (
                    <p className="font-mono text-accent">{String(job.qualityScore)}% quality</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { OverviewPair } from '../compare-metrics'

interface ComparisonOverviewProps {
  pairs: OverviewPair[]
  baselineLabel?: string
  optimizedLabel?: string
}

export function ComparisonOverview({
  pairs,
  baselineLabel = 'Baseline',
  optimizedLabel = 'Optimized',
}: ComparisonOverviewProps) {
  return (
    <Card hover={false}>
      <CardHeader className="gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <CardTitle className="text-base">Comparison Overview</CardTitle>
          <p className="text-pretty text-xs text-muted-foreground">
            Baseline vs optimized — values from archived BacktestReport fields only.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="text-[10px]">
            {baselineLabel}
          </Badge>
          <Badge variant="accent" className="text-[10px]">
            {optimizedLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {pairs.map((pair) => (
            <div
              key={pair.label}
              className="min-w-0 rounded-lg border border-border/70 bg-white/[0.02] px-3 py-3"
            >
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {pair.label}
              </p>
              <div className="mt-2 space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[10px] text-muted-foreground">Prev</span>
                  <span className="truncate font-mono text-xs tabular-nums text-muted-foreground">
                    {pair.baseline}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[10px] text-foreground/70">Curr</span>
                  <span className="truncate font-mono text-sm font-semibold tabular-nums text-foreground">
                    {pair.optimized}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

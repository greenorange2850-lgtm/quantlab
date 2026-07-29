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
          <CardTitle className="text-base">Baseline vs Optimized</CardTitle>
          <p className="text-pretty text-xs text-muted-foreground">
            Side-by-side overview from archived BacktestReport fields.
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
      <CardContent className="min-w-0 space-y-3">
        {/* Mobile: stacked metric cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:hidden">
          {pairs.map((pair) => (
            <div
              key={pair.label}
              className="min-w-0 rounded-lg border border-border/70 bg-white/[0.02] px-3 py-3"
            >
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {pair.label}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground">{baselineLabel}</p>
                  <p className="truncate font-mono text-xs tabular-nums text-muted-foreground">
                    {pair.baseline}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-foreground/70">{optimizedLabel}</p>
                  <p className="truncate font-mono text-sm font-semibold tabular-nums text-foreground">
                    {pair.optimized}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop: clear two-column comparison table */}
        <div className="hidden min-w-0 overflow-x-auto md:block">
          <table className="w-full min-w-[480px] text-left text-xs">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 font-medium">Metric</th>
                <th className="px-3 py-2 font-medium">{baselineLabel}</th>
                <th className="px-3 py-2 font-medium">{optimizedLabel}</th>
              </tr>
            </thead>
            <tbody>
              {pairs.map((pair) => (
                <tr key={pair.label} className="border-b border-border/50">
                  <td className="px-3 py-2.5 font-medium">{pair.label}</td>
                  <td className="px-3 py-2.5 font-mono tabular-nums text-muted-foreground">
                    {pair.baseline}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-sm font-semibold tabular-nums">
                    {pair.optimized}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

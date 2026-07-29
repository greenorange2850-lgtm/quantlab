import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { directionLabel, type MetricCompareRow } from '../compare-metrics'

interface MetricsComparisonProps {
  rows: MetricCompareRow[]
}

export function MetricsComparison({ rows }: MetricsComparisonProps) {
  return (
    <Card hover={false}>
      <CardHeader>
        <CardTitle className="text-base">Metrics Comparison</CardTitle>
        <p className="text-pretty text-xs text-muted-foreground">
          Current vs previous with simple direction indicators — no recalculated analytics.
        </p>
      </CardHeader>
      <CardContent className="min-w-0 space-y-3">
        <div className="space-y-2 md:hidden">
          {rows.map((row) => (
            <div
              key={row.label}
              className="rounded-lg border border-border/60 px-3 py-3 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium">{row.label}</p>
                <DirectionBadge direction={row.direction} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div>
                  <p className="text-muted-foreground">Previous</p>
                  <p className="font-mono tabular-nums">{row.previous}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Current</p>
                  <p className="font-mono tabular-nums">{row.current}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Difference</p>
                  <p className="font-mono tabular-nums">{row.difference}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden min-w-0 overflow-x-auto md:block">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 font-medium">Metric</th>
                <th className="px-3 py-2 font-medium">Previous</th>
                <th className="px-3 py-2 font-medium">Current</th>
                <th className="px-3 py-2 font-medium">Difference</th>
                <th className="px-3 py-2 font-medium">Change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-b border-border/50">
                  <td className="px-3 py-2.5 font-medium">{row.label}</td>
                  <td className="px-3 py-2.5 font-mono tabular-nums text-muted-foreground">
                    {row.previous}
                  </td>
                  <td className="px-3 py-2.5 font-mono tabular-nums">{row.current}</td>
                  <td className="px-3 py-2.5 font-mono tabular-nums">{row.difference}</td>
                  <td className="px-3 py-2.5">
                    <DirectionBadge direction={row.direction} />
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

function DirectionBadge({
  direction,
}: {
  direction: MetricCompareRow['direction']
}) {
  return (
    <span
      className={cn(
        'inline-flex whitespace-nowrap text-[10px] font-medium',
        direction === 'improved' && 'text-success',
        direction === 'decreased' && 'text-danger',
        direction === 'unchanged' && 'text-muted-foreground',
        direction === 'unavailable' && 'text-muted-foreground',
      )}
    >
      {directionLabel(direction)}
    </span>
  )
}

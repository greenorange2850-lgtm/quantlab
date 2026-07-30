import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Disclosure } from '@/components/ui/disclosure'
import { COMPARE_SNAPSHOT_LABELS, type OverviewPair } from '../compare-metrics'

interface ComparisonOverviewProps {
  pairs: OverviewPair[]
  baselineLabel?: string
  optimizedLabel?: string
}

function PairCard({
  pair,
  baselineLabel,
  optimizedLabel,
  emphasize,
}: {
  pair: OverviewPair
  baselineLabel: string
  optimizedLabel: string
  emphasize?: boolean
}) {
  return (
    <div
      className={
        emphasize
          ? 'min-w-0 rounded-lg border border-border/70 bg-white/[0.02] px-4 py-4'
          : 'min-w-0 rounded-lg border border-border/70 bg-white/[0.02] px-3.5 py-3.5'
      }
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
          <p
            className={
              emphasize
                ? 'truncate font-mono text-base font-semibold tabular-nums text-foreground'
                : 'truncate font-mono text-sm font-semibold tabular-nums text-foreground'
            }
          >
            {pair.optimized}
          </p>
        </div>
      </div>
    </div>
  )
}

export function ComparisonOverview({
  pairs,
  baselineLabel = 'Baseline',
  optimizedLabel = 'Optimized',
}: ComparisonOverviewProps) {
  const snapshot = pairs.filter((pair) => COMPARE_SNAPSHOT_LABELS.has(pair.label))
  const secondary = pairs.filter((pair) => !COMPARE_SNAPSHOT_LABELS.has(pair.label))

  return (
    <Card hover={false}>
      <CardHeader className="gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <CardTitle className="text-base">Baseline vs Optimized</CardTitle>
          <p className="text-pretty text-xs text-muted-foreground">
            Profit and risk first — other fields on demand.
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
      <CardContent className="min-w-0 space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {snapshot.map((pair) => (
            <PairCard
              key={pair.label}
              pair={pair}
              baselineLabel={baselineLabel}
              optimizedLabel={optimizedLabel}
              emphasize
            />
          ))}
        </div>

        {secondary.length > 0 ? (
          <Disclosure title="Session details">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {secondary.map((pair) => (
                <PairCard
                  key={pair.label}
                  pair={pair}
                  baselineLabel={baselineLabel}
                  optimizedLabel={optimizedLabel}
                />
              ))}
            </div>
          </Disclosure>
        ) : null}

        {/* Desktop table kept for full scan when expanded via disclosure above;
            snapshot remains the primary mobile/desktop first view. */}
      </CardContent>
    </Card>
  )
}

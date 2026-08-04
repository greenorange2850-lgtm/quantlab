import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MetricTile } from '@/features/research-analysis/components/MetricTile'
import { KPI_SECONDARY_GRID } from '@/layouts/layout-classes'
import type { StrategyViewModel } from '@/strategies'

interface ParametersTabProps {
  strategy: StrategyViewModel
}

export function ParametersTab({ strategy }: ParametersTabProps) {
  const params = strategy.winningParameters
  const baseline = strategy.session.baseline?.parameters ?? null

  if (!params) {
    return (
      <Card hover={false} className="border-dashed">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No winning parameters yet. Run Random Search to discover them.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card hover={false}>
        <CardHeader>
          <CardTitle className="text-base">Winning parameters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={KPI_SECONDARY_GRID}>
            <MetricTile label="Fast EMA" value={String(params.fastPeriod)} size="primary" />
            <MetricTile label="Slow EMA" value={String(params.slowPeriod)} size="primary" />
            <MetricTile label="RSI Period" value={String(params.rsiPeriod)} size="primary" />
            <MetricTile
              label="Score"
              value={strategy.bestScore === null ? '—' : strategy.bestScore.toFixed(2)}
              size="primary"
            />
          </div>
        </CardContent>
      </Card>

      {baseline ? (
        <Card hover={false}>
          <CardHeader>
            <CardTitle className="text-base">Baseline (before search)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={KPI_SECONDARY_GRID}>
              <MetricTile
                label="Fast EMA"
                value={String(baseline.fastPeriod)}
                size="secondary"
              />
              <MetricTile
                label="Slow EMA"
                value={String(baseline.slowPeriod)}
                size="secondary"
              />
              <MetricTile
                label="RSI Period"
                value={String(baseline.rsiPeriod)}
                size="secondary"
              />
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

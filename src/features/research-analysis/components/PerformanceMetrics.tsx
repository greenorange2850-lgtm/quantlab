import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatPercent } from '@/lib/utils'
import type { ResearchReport } from '@/core/research'
import { MetricTile } from './MetricTile'

interface PerformanceMetricsProps {
  report: ResearchReport
}

/** Reuses existing BacktestReport / statistics fields only — no recalculation. */
export function PerformanceMetrics({ report }: PerformanceMetricsProps) {
  const backtest = report.bestCandidate?.report
  const summary = backtest?.summary
  const averageTrade = backtest?.statistics.averageTrade
  const expectancy = summary?.expectancy

  return (
    <Card hover={false}>
      <CardHeader>
        <CardTitle className="text-base">Performance Metrics</CardTitle>
        <p className="text-pretty text-xs text-muted-foreground">
          Existing report metrics only. Sharpe is shown when present on the report.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <MetricTile
            label="Profit Factor"
            value={summary ? summary.profitFactor.toFixed(2) : '—'}
            tone={summary ? 'default' : 'muted'}
          />
          <MetricTile
            label="Sharpe Ratio"
            value="Unavailable"
            hint="Not stored on BacktestReport"
            tone="muted"
          />
          <MetricTile
            label="Max Drawdown"
            value={
              summary ? formatPercent(-summary.maxDrawdown * 100) : '—'
            }
            tone={summary ? 'negative' : 'muted'}
          />
          <MetricTile
            label="Win Rate"
            value={summary ? `${(summary.winRate * 100).toFixed(1)}%` : '—'}
            tone={summary ? 'default' : 'muted'}
          />
          <MetricTile
            label="Average Trade"
            value={
              averageTrade === undefined ? '—' : averageTrade.toFixed(2)
            }
            hint={averageTrade === undefined ? undefined : 'statistics.averageTrade'}
            tone={averageTrade === undefined ? 'muted' : 'default'}
          />
          <MetricTile
            label="Expectancy"
            value={expectancy === undefined ? '—' : expectancy.toFixed(2)}
            hint={expectancy === undefined ? undefined : 'summary.expectancy'}
            tone={expectancy === undefined ? 'muted' : 'default'}
          />
        </div>
      </CardContent>
    </Card>
  )
}

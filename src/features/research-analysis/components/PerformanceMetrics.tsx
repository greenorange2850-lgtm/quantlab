import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Disclosure } from '@/components/ui/disclosure'
import {
  formatCurrencyAbsolute,
  formatPercentUnsigned,
  formatRatio,
} from '@/lib/utils'
import {
  expectancyQuality,
  profitFactorQuality,
  qualityToTone,
} from '@/lib/metric-semantics'
import type { ResearchReport } from '@/core/research'
import { MetricTile } from './MetricTile'

interface PerformanceMetricsProps {
  report: ResearchReport
}

/** Secondary performance metrics — Max Drawdown lives in the Research Snapshot. */
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
          Secondary report fields. Sharpe when present on the report.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MetricTile
            label="Profit Factor"
            value={summary ? formatRatio(summary.profitFactor) : '—'}
            tone={summary ? qualityToTone(profitFactorQuality(summary.profitFactor)) : 'muted'}
            size="primary"
          />
          <MetricTile
            label="Win Rate"
            value={summary ? formatPercentUnsigned(summary.winRate * 100) : '—'}
            tone={summary ? 'default' : 'muted'}
            size="primary"
          />
        </div>

        <Disclosure title="More performance metrics">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <MetricTile
              label="Average Trade"
              value={
                averageTrade === undefined ? '—' : formatCurrencyAbsolute(averageTrade)
              }
              tone={averageTrade === undefined ? 'muted' : 'default'}
              size="secondary"
            />
            <MetricTile
              label="Sharpe"
              value="Unavailable"
              hint="Not stored on BacktestReport"
              tone="muted"
              size="secondary"
            />
            <MetricTile
              label="Expectancy"
              value={expectancy === undefined ? '—' : formatRatio(expectancy)}
              tone={
                expectancy === undefined
                  ? 'muted'
                  : qualityToTone(expectancyQuality(expectancy))
              }
              size="secondary"
            />
          </div>
        </Disclosure>
      </CardContent>
    </Card>
  )
}

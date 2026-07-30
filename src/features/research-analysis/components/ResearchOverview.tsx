import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Disclosure } from '@/components/ui/disclosure'
import {
  formatCurrency,
  formatCurrencyAbsolute,
  formatPercent,
} from '@/lib/utils'
import {
  drawdownQuality,
  qualityToTone,
} from '@/lib/metric-semantics'
import type { ResearchReport } from '@/core/research'
import { MetricTile } from './MetricTile'

function formatResearchPeriod(report: ResearchReport): string {
  const curve = report.bestCandidate?.report.equityCurve ?? []
  const first = curve[0]?.time
  const last = curve.at(-1)?.time
  if (first !== undefined && last !== undefined) {
    const fmt = (ms: number) =>
      new Date(ms).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    return `${fmt(first)} → ${fmt(last)}`
  }

  const start = new Date(report.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
  const end = report.completedAt
    ? new Date(report.completedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '—'
  return `${start} → ${end}`
}

interface ResearchOverviewProps {
  report: ResearchReport
}

/**
 * First screen answers: is it good (rating), how much (net profit), how risky (max DD).
 * Everything else is progressive disclosure.
 */
export function ResearchOverview({ report }: ResearchOverviewProps) {
  const backtest = report.bestCandidate?.report
  const summary = backtest?.summary
  const initialCapital = backtest?.config.initialCapital ?? report.config.initialCapital
  const finalEquity = backtest?.summary.finalBalance
  const netProfit = summary?.netProfit
  const totalTrades = summary?.totalTrades
  const maxDrawdown = summary?.maxDrawdown
  const rating = report.analysis.rating
  const roiPercent =
    backtest && initialCapital > 0 ? (backtest.summary.netProfit / initialCapital) * 100 : null

  return (
    <Card hover={false}>
      <CardHeader className="gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <CardTitle className="text-base">Research Snapshot</CardTitle>
          <p className="text-pretty text-xs text-muted-foreground">
            Quality, profit, and risk — from the archived report.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="text-[10px]">
            Validation Required
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MetricTile
            label="Research Rating"
            value={rating.charAt(0).toUpperCase() + rating.slice(1)}
            hint="Is this strategy good?"
            tone={
              rating === 'strong'
                ? 'positive'
                : rating === 'poor'
                  ? 'negative'
                  : rating === 'fair'
                    ? 'warning'
                    : 'default'
            }
            size="primary"
          />
          <MetricTile
            label="Net Profit"
            value={netProfit === undefined ? '—' : formatCurrency(netProfit)}
            hint="How much it made"
            tone={
              netProfit === undefined ? 'muted' : netProfit >= 0 ? 'positive' : 'negative'
            }
            size="primary"
          />
          <MetricTile
            label="Max Drawdown"
            value={
              maxDrawdown === undefined ? '—' : formatPercent(-maxDrawdown * 100)
            }
            hint="How risky it is"
            tone={
              maxDrawdown === undefined
                ? 'muted'
                : qualityToTone(drawdownQuality(maxDrawdown))
            }
            size="primary"
          />
        </div>

        <Disclosure title="Session details">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <MetricTile
              label="ROI"
              value={roiPercent === null ? '—' : formatPercent(roiPercent)}
              tone={
                roiPercent === null ? 'muted' : roiPercent >= 0 ? 'positive' : 'negative'
              }
              size="secondary"
            />
            <MetricTile
              label="Trades"
              value={totalTrades === undefined ? '—' : String(totalTrades)}
              tone={totalTrades === undefined ? 'muted' : 'default'}
              size="secondary"
            />
            <MetricTile
              label="Initial Capital"
              value={formatCurrencyAbsolute(initialCapital)}
              size="secondary"
            />
            <MetricTile
              label="Final Equity"
              value={
                finalEquity === undefined ? '—' : formatCurrencyAbsolute(finalEquity)
              }
              tone={finalEquity === undefined ? 'muted' : 'default'}
              size="secondary"
            />
            <MetricTile label="Market" value={report.config.symbol} size="meta" tone="muted" />
            <MetricTile
              label="Timeframe"
              value={report.config.interval.toUpperCase()}
              size="meta"
              tone="muted"
            />
            <MetricTile
              label="Research Period"
              value={formatResearchPeriod(report)}
              size="meta"
              tone="muted"
              className="col-span-2 md:col-span-1"
            />
          </div>
        </Disclosure>
      </CardContent>
    </Card>
  )
}

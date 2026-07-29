import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatPercent } from '@/lib/utils'
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

/** Answers: what was tested and what happened? Uses BacktestReport fields only. */
export function ResearchOverview({ report }: ResearchOverviewProps) {
  const backtest = report.bestCandidate?.report
  const initialCapital = backtest?.config.initialCapital ?? report.config.initialCapital
  const finalEquity = backtest?.summary.finalBalance
  const netProfit = backtest?.summary.netProfit
  const totalTrades = backtest?.summary.totalTrades
  const roiPercent =
    backtest && initialCapital > 0 ? (backtest.summary.netProfit / initialCapital) * 100 : null

  return (
    <Card hover={false}>
      <CardHeader className="gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <CardTitle className="text-base">Research Overview</CardTitle>
          <p className="text-pretty text-xs text-muted-foreground">
            What was tested and what happened — values from the archived BacktestReport.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="accent" className="text-[10px]">
            Historical Research Result
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            Validation Required
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricTile label="Market" value={report.config.symbol} />
          <MetricTile label="Timeframe" value={report.config.interval.toUpperCase()} />
          <MetricTile label="Research Period" value={formatResearchPeriod(report)} />
          <MetricTile
            label="Initial Capital"
            value={formatCurrency(initialCapital).replace(/^\+/, '')}
          />
          <MetricTile
            label="Final Equity"
            value={
              finalEquity === undefined
                ? '—'
                : formatCurrency(finalEquity).replace(/^\+/, '')
            }
            tone={finalEquity === undefined ? 'muted' : 'default'}
          />
          <MetricTile
            label="Net Profit"
            value={netProfit === undefined ? '—' : formatCurrency(netProfit)}
            tone={
              netProfit === undefined ? 'muted' : netProfit >= 0 ? 'positive' : 'negative'
            }
          />
          <MetricTile
            label="ROI"
            value={roiPercent === null ? '—' : formatPercent(roiPercent)}
            hint="netProfit ÷ initialCapital"
            tone={
              roiPercent === null ? 'muted' : roiPercent >= 0 ? 'positive' : 'negative'
            }
          />
          <MetricTile
            label="Total Trades"
            value={totalTrades === undefined ? '—' : String(totalTrades)}
            tone={totalTrades === undefined ? 'muted' : 'default'}
          />
        </div>
      </CardContent>
    </Card>
  )
}

import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import type {
  DetectorEventInspection,
  HistoricalEvaluationMeta,
  PlaybookEvaluation,
  PlaybookHistoryResult,
  PlaybookLabDataSourceKind,
} from '@/core/playbook'

interface HistorySummaryProps {
  sourceKind: PlaybookLabDataSourceKind
  evaluation: PlaybookEvaluation
  history: PlaybookHistoryResult
  meta?: HistoricalEvaluationMeta | null
  eventSupport?: DetectorEventInspection | null
  action?: ReactNode
}

export function HistorySummary({
  sourceKind,
  evaluation,
  history,
  meta,
  eventSupport,
  action,
}: HistorySummaryProps) {
  const candleCount = meta?.candleCount ?? history.evaluations.length
  const range = meta?.evaluatedRange
    ? formatRange(meta.evaluatedRange.start, meta.evaluatedRange.end)
    : formatRange(history.startTimestamp, history.endTimestamp)

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-medium text-foreground">
            {sourceKind === 'demo' ? 'Demo series' : 'Historical series'}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-mono text-[11px] text-muted-foreground">
              {evaluation.symbol} · {evaluation.timeframe}
              {range !== '—' ? ` · ${range}` : ''}
              {` · ${candleCount} candles`}
            </div>
            {action}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Metric label="Status" value={evaluation.status} />
          <Metric label="Strength" value={evaluation.strength} />
          <Metric label="Action" value={evaluation.action} />
          <Metric label="Completed" value={history.completedCount} />
          <Metric label="Invalidated" value={history.invalidatedCount} />
          <Metric label="Expired" value={history.expiredCount} />
          <Metric label="Watching" value={history.watchCount} />
          <Metric label="Waiting" value={history.waitRetestCount} />
        </div>

        {eventSupport && (
          <p
            className={
              eventSupport.blocked
                ? 'text-[11px] text-warning'
                : 'text-[11px] text-muted-foreground'
            }
          >
            {eventSupport.detail}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border/60 bg-white/[0.02] px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-sm font-semibold text-foreground">{value}</div>
    </div>
  )
}

function formatRange(start: string, end: string): string {
  if (!start || !end) return '—'
  const a = start.slice(0, 10)
  const b = end.slice(0, 10)
  return a === b ? a : `${a} → ${b}`
}

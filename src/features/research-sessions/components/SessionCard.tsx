import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatPercent } from '@/lib/utils'
import type { SessionListItem } from '../session-list-model'
import { SessionActions } from './SessionActions'

interface SessionCardProps {
  item: SessionListItem
  deleting?: boolean
  onDelete: (sessionId: string) => void
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function SessionCard({ item, deleting, onDelete }: SessionCardProps) {
  return (
    <Card hover={false} className="min-w-0">
      <CardHeader className="gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <CardTitle className="text-base">{item.strategyName}</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="font-mono text-[10px]">
              {item.market}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {item.timeframe}
            </Badge>
            <Badge variant="outline" className="capitalize text-[10px]">
              {item.status}
            </Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{formatDate(item.researchDate)}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Best Score" value={item.bestScore === null ? '—' : item.bestScore.toFixed(3)} />
          <Metric
            label="Net Profit"
            value={item.netProfit === null ? '—' : formatCurrency(item.netProfit)}
            tone={
              item.netProfit === null ? 'muted' : item.netProfit >= 0 ? 'positive' : 'negative'
            }
          />
          <Metric
            label="ROI"
            value={item.roiPercent === null ? '—' : formatPercent(item.roiPercent)}
            tone={
              item.roiPercent === null ? 'muted' : item.roiPercent >= 0 ? 'positive' : 'negative'
            }
          />
          <Metric
            label="Total Trades"
            value={item.totalTrades === null ? '—' : String(item.totalTrades)}
          />
        </div>

        <SessionActions sessionId={item.id} deleting={deleting} onDelete={onDelete} />
      </CardContent>
    </Card>
  )
}

function Metric({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'positive' | 'negative' | 'muted'
}) {
  const toneClass =
    tone === 'positive'
      ? 'text-success'
      : tone === 'negative'
        ? 'text-danger'
        : tone === 'muted'
          ? 'text-muted-foreground'
          : 'text-foreground'

  return (
    <div className="min-w-0 rounded-lg border border-border/60 bg-white/[0.02] px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 truncate font-mono text-sm font-semibold tabular-nums ${toneClass}`}>
        {value}
      </p>
    </div>
  )
}

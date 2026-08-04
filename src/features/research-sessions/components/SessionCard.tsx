import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Disclosure } from '@/components/ui/disclosure'
import { MetricTile } from '@/features/research-analysis/components/MetricTile'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils'
import { drawdownQuality, qualityToTone } from '@/lib/metric-semantics'
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MetricTile
            label="Best Score"
            value={item.bestScore === null ? '—' : formatNumber(item.bestScore, 2)}
            hint="Is this strategy good?"
            size="primary"
          />
          <MetricTile
            label="Net Profit"
            value={item.netProfit === null ? '—' : formatCurrency(item.netProfit)}
            hint="How much it made"
            tone={
              item.netProfit === null ? 'muted' : item.netProfit >= 0 ? 'positive' : 'negative'
            }
            size="primary"
          />
          <MetricTile
            label="Max Drawdown"
            value={
              item.maxDrawdown === null
                ? '—'
                : formatPercent(-item.maxDrawdown * 100)
            }
            hint="How risky it is"
            tone={
              item.maxDrawdown === null
                ? 'muted'
                : qualityToTone(drawdownQuality(item.maxDrawdown))
            }
            size="primary"
          />
        </div>

        <Disclosure title="More metrics" variant="plain">
          <div className="grid grid-cols-2 gap-3">
            <MetricTile
              label="ROI"
              value={item.roiPercent === null ? '—' : formatPercent(item.roiPercent)}
              tone={
                item.roiPercent === null
                  ? 'muted'
                  : item.roiPercent >= 0
                    ? 'positive'
                    : 'negative'
              }
              size="secondary"
            />
            <MetricTile
              label="Trades"
              value={item.totalTrades === null ? '—' : String(item.totalTrades)}
              size="secondary"
            />
          </div>
        </Disclosure>

        <SessionActions
          sessionId={item.id}
          bestBacktestId={item.bestBacktestId}
          deleting={deleting}
          onDelete={onDelete}
        />
      </CardContent>
    </Card>
  )
}

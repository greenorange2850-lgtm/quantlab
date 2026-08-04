import { Link } from 'react-router-dom'
import { Play, SlidersHorizontal } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MetricTile } from '@/features/research-analysis/components/MetricTile'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils'
import { drawdownQuality, qualityToTone } from '@/lib/metric-semantics'
import type { StrategyViewModel } from '@/strategies'

interface OverviewTabProps {
  strategy: StrategyViewModel
  onGoToTab: (tab: string) => void
}

export function OverviewTab({ strategy, onGoToTab }: OverviewTabProps) {
  return (
    <div className="space-y-4">
      <Card hover={false}>
        <CardHeader>
          <CardTitle className="text-base">Strategy overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {strategy.description ? (
            <p className="text-sm text-muted-foreground">{strategy.description}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Optimized Moving Average Cross on {strategy.market} ({strategy.timeframe}).
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="font-mono text-[10px]">
              {strategy.market}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {strategy.timeframe}
            </Badge>
            <Badge variant="outline" className="capitalize text-[10px]">
              {strategy.lifecycle}
            </Badge>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricTile
              label="Best Score"
              value={
                strategy.bestScore === null ? '—' : formatNumber(strategy.bestScore, 2)
              }
              size="primary"
            />
            <MetricTile
              label="Net Profit"
              value={
                strategy.netProfit === null ? '—' : formatCurrency(strategy.netProfit)
              }
              tone={
                strategy.netProfit === null
                  ? 'muted'
                  : strategy.netProfit >= 0
                    ? 'positive'
                    : 'negative'
              }
              size="primary"
            />
            <MetricTile
              label="Max Drawdown"
              value={
                strategy.maxDrawdown === null
                  ? '—'
                  : formatPercent(-strategy.maxDrawdown * 100)
              }
              tone={
                strategy.maxDrawdown === null
                  ? 'muted'
                  : qualityToTone(drawdownQuality(strategy.maxDrawdown))
              }
              size="primary"
            />
            <MetricTile
              label="Trades"
              value={strategy.totalTrades === null ? '—' : String(strategy.totalTrades)}
              size="primary"
            />
          </div>
        </CardContent>
      </Card>

      <Card hover={false}>
        <CardHeader>
          <CardTitle className="text-base">Next steps</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            variant="secondary"
            className="min-h-11 w-full sm:min-h-9 sm:w-auto"
            onClick={() => onGoToTab('optimization')}
          >
            Review Optimization
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full sm:min-h-9 sm:w-auto"
            onClick={() => onGoToTab('replay')}
          >
            <Play className="mr-2 h-4 w-4" />
            Validate with Trade Replay
          </Button>
          <Link to="/optimizer" className="w-full sm:w-auto">
            <Button variant="outline" className="min-h-11 w-full sm:min-h-9 sm:w-auto">
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              New Research
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}

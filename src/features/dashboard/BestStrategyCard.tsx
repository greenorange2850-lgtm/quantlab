import { motion } from 'framer-motion'
import { Trophy, Eye, GitCompare, Copy, Filter } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Disclosure } from '@/components/ui/disclosure'
import { ResearchScore } from '@/components/ui/research-score'
import { cn, formatCurrency, formatRatio } from '@/lib/utils'
import {
  drawdownQuality,
  profitFactorQuality,
  qualityTextClass,
  recoveryFactorQuality,
} from '@/lib/metric-semantics'
import type { BestStrategySummary } from '@/types'

interface BestStrategyCardProps {
  strategy: BestStrategySummary
  /** Optional net profit from the same backtest snapshot (display only). */
  netProfit?: number
}

export function BestStrategyCard({ strategy, netProfit }: BestStrategyCardProps) {
  const details = [
    {
      label: 'Research Score',
      value: `${Math.round(strategy.score)} / 100`,
    },
    {
      label: 'Net Profit',
      value: typeof netProfit === 'number' ? formatCurrency(netProfit) : '—',
      className:
        typeof netProfit === 'number'
          ? netProfit >= 0
            ? 'text-success'
            : 'text-danger'
          : undefined,
    },
    {
      label: 'Max Drawdown',
      value: `${strategy.drawdown.toFixed(2)}%`,
      className: qualityTextClass(drawdownQuality(strategy.drawdown)),
    },
    {
      label: 'Profit Factor',
      value: formatRatio(strategy.profitFactor),
      className: qualityTextClass(profitFactorQuality(strategy.profitFactor)),
    },
    { label: 'Win Rate', value: `${strategy.winRate.toFixed(2)}%` },
    { label: 'Trades', value: String(strategy.tradeCount) },
    { label: 'Average Trade', value: `$${formatRatio(strategy.expectedValue)}` },
    { label: 'Sharpe', value: formatRatio(strategy.sharpeRatio) },
    {
      label: 'Recovery Factor',
      value: formatRatio(strategy.recoveryFactor),
      className: qualityTextClass(recoveryFactorQuality(strategy.recoveryFactor)),
    },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
    >
      <Card glow className="relative overflow-hidden">
        <div className="pointer-events-none absolute right-0 top-0 h-48 w-48 rounded-bl-full bg-gradient-to-bl from-accent/10 to-transparent" />
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-warning/20 bg-warning/15">
              <Trophy className="h-5 w-5 text-warning" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Current Best Strategy
              </p>
              <CardTitle className="mt-0.5 truncate text-lg">{strategy.name}</CardTitle>
              <p className="text-xs text-muted-foreground">{strategy.version}</p>
            </div>
          </div>
          <ResearchScore score={strategy.score} size="sm" className="shrink-0" />
        </CardHeader>
        <CardContent className="min-w-0 space-y-4">
          {strategy.filtersEnabled.length > 0 ? (
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <Filter className="h-3 w-3 shrink-0 text-muted-foreground" />
              {strategy.filtersEnabled.map((filter) => (
                <Badge key={filter} variant="outline" className="text-[10px]">
                  {filter}
                </Badge>
              ))}
            </div>
          ) : null}

          <Disclosure title="Strategy metrics">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {details.map((m) => (
                <div key={m.label} className="min-w-0 space-y-1">
                  <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                    {m.label}
                  </p>
                  <p
                    className={cn(
                      'truncate font-mono text-sm font-semibold tracking-tight',
                      m.className,
                    )}
                  >
                    {m.value}
                  </p>
                </div>
              ))}
            </div>
          </Disclosure>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Button size="sm" className="min-h-11 w-full sm:min-h-8 sm:w-auto">
              <Eye className="h-3.5 w-3.5" />
              View Details
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="min-h-11 w-full sm:min-h-8 sm:w-auto"
            >
              <GitCompare className="h-3.5 w-3.5" />
              Compare
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="min-h-11 w-full sm:min-h-8 sm:w-auto"
            >
              <Copy className="h-3.5 w-3.5" />
              Duplicate
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

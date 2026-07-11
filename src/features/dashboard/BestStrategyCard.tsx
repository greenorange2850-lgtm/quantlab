import { motion } from 'framer-motion'
import { Trophy, Eye, GitCompare, Copy, Filter } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AnimatedCounter } from '@/hooks/use-animated-counter'
import type { BestStrategySummary } from '@/types'

interface BestStrategyCardProps {
  strategy: BestStrategySummary
}

export function BestStrategyCard({ strategy }: BestStrategyCardProps) {
  const metrics = [
    { label: 'Score', value: strategy.score, suffix: '/100' },
    { label: 'Win Rate', value: strategy.winRate, suffix: '%' },
    { label: 'Profit Factor', value: strategy.profitFactor, decimals: 2 },
    { label: 'Drawdown', value: strategy.drawdown, suffix: '%' },
    { label: 'Trade Count', value: strategy.tradeCount },
    { label: 'Expected Value', value: strategy.expectedValue, prefix: '$', decimals: 2 },
    { label: 'Sharpe Ratio', value: strategy.sharpeRatio, decimals: 2 },
    { label: 'Recovery Factor', value: strategy.recoveryFactor, decimals: 2 },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
    >
      <Card glow className="relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-accent/10 to-transparent rounded-bl-full pointer-events-none" />
        <CardHeader className="flex-row items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/15 border border-warning/20">
              <Trophy className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Current Best Strategy
              </p>
              <CardTitle className="text-lg mt-0.5">{strategy.name}</CardTitle>
              <p className="text-xs text-muted-foreground">{strategy.version}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Filter className="h-3 w-3 text-muted-foreground" />
            {strategy.filtersEnabled.map((filter) => (
              <Badge key={filter} variant="outline" className="text-[10px]">
                {filter}
              </Badge>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
            {metrics.map((m) => (
              <div key={m.label} className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {m.label}
                </p>
                <p className="text-lg font-semibold font-mono tracking-tight">
                  <AnimatedCounter
                    value={m.value}
                    decimals={m.decimals ?? 0}
                    prefix={m.prefix ?? ''}
                    suffix={m.suffix ?? ''}
                  />
                </p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm">
              <Eye className="h-3.5 w-3.5" />
              View Details
            </Button>
            <Button variant="secondary" size="sm">
              <GitCompare className="h-3.5 w-3.5" />
              Compare
            </Button>
            <Button variant="ghost" size="sm">
              <Copy className="h-3.5 w-3.5" />
              Duplicate
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

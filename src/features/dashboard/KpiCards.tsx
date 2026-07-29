import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { AnimatedCounter } from '@/hooks/use-animated-counter'
import { cn, formatCurrency, formatPercent } from '@/lib/utils'
import type { KpiMetric } from '@/types'

interface KpiCardsProps {
  metrics: KpiMetric[]
}

function formatKpiValue(metric: KpiMetric): string {
  if (typeof metric.value === 'string') return metric.value
  switch (metric.format) {
    case 'currency':
      return formatCurrency(metric.value)
    case 'percent':
      return formatPercent(metric.value)
    case 'number':
      return metric.value.toFixed(metric.id === 'profit-factor' || metric.id === 'avg-rr' ? 2 : 0)
    default:
      return String(metric.value)
  }
}

function KpiCard({ metric, index }: { metric: KpiMetric; index: number }) {
  const TrendIcon =
    metric.trend === 'up' ? TrendingUp : metric.trend === 'down' ? TrendingDown : Minus

  const isNumeric = typeof metric.value === 'number'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.04 }}
    >
      <Card className="group h-full">
        <CardContent className="min-w-0 p-4">
          <p className="mb-2 truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {metric.label}
          </p>
          <div className="flex min-w-0 items-end justify-between gap-2">
            <p className="min-w-0 truncate text-lg font-semibold tracking-tight font-mono">
              {isNumeric && metric.format !== 'text' ? (
                <AnimatedCounter
                  value={metric.value as number}
                  decimals={
                    metric.format === 'percent' ? 1 : metric.id === 'profit-factor' || metric.id === 'avg-rr' ? 2 : 0
                  }
                  prefix={metric.format === 'currency' ? (metric.value as number) >= 0 ? '+$' : '-$' : metric.format === 'percent' && (metric.value as number) >= 0 ? '+' : ''}
                  suffix={metric.format === 'percent' ? '%' : ''}
                />
              ) : (
                formatKpiValue(metric)
              )}
            </p>
            {metric.change !== undefined && (
              <div
                className={cn(
                  'flex shrink-0 items-center gap-0.5 text-[10px] font-medium',
                  metric.trend === 'up' ? 'text-success' : metric.trend === 'down' ? 'text-danger' : 'text-muted',
                )}
              >
                <TrendIcon className="h-3 w-3" />
                {Math.abs(metric.change)}
                {metric.format === 'percent' ? 'pp' : ''}
              </div>
            )}
            {metric.trend && metric.change === undefined && metric.id === 'status' && (
              <div className="flex shrink-0 items-center gap-0.5 text-[10px] font-medium text-success">
                <TrendingUp className="h-3 w-3" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export function KpiCards({ metrics }: KpiCardsProps) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-11">
      {metrics.map((metric, i) => (
        <KpiCard key={metric.id} metric={metric} index={i} />
      ))}
    </div>
  )
}

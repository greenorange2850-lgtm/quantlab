import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Disclosure } from '@/components/ui/disclosure'
import { ResearchScore } from '@/components/ui/research-score'
import { AnimatedCounter } from '@/hooks/use-animated-counter'
import { cn, formatCurrency, formatPercent, formatRatio } from '@/lib/utils'
import {
  drawdownQuality,
  profitFactorQuality,
  qualityTextClass,
  qualityToTone,
  type MetricQuality,
} from '@/lib/metric-semantics'
import {
  KPI_META_GRID,
  KPI_PRIMARY_GRID,
  KPI_SECONDARY_GRID,
} from '@/layouts/layout-classes'
import type { KpiMetric } from '@/types'

interface KpiCardsProps {
  metrics: KpiMetric[]
  /** Existing 0–100 health score — display only, not recalculated. */
  researchScore?: number
}

const SNAPSHOT_IDS = new Set(['net-profit', 'max-drawdown'])
const SECONDARY_IDS = new Set(['profit-factor', 'win-rate', 'total-trades', 'avg-rr'])

type KpiTier = 'snapshot' | 'secondary' | 'meta'

function tierFor(id: string): KpiTier {
  if (SNAPSHOT_IDS.has(id)) return 'snapshot'
  if (SECONDARY_IDS.has(id)) return 'secondary'
  return 'meta'
}

function formatKpiValue(metric: KpiMetric): string {
  if (typeof metric.value === 'string') return metric.value
  switch (metric.format) {
    case 'currency':
      return formatCurrency(metric.value)
    case 'percent':
      return formatPercent(metric.value)
    case 'number':
      return metric.id === 'profit-factor' || metric.id === 'avg-rr'
        ? formatRatio(metric.value)
        : String(Math.round(metric.value))
    default:
      return String(metric.value)
  }
}

function semanticQuality(metric: KpiMetric): MetricQuality | null {
  if (typeof metric.value !== 'number') return null
  if (metric.id === 'profit-factor') return profitFactorQuality(metric.value)
  if (metric.id === 'max-drawdown') return drawdownQuality(metric.value)
  return null
}

function SnapshotMetric({
  metric,
  index,
}: {
  metric: KpiMetric
  index: number
}) {
  const isNumeric = typeof metric.value === 'number'
  const quality = semanticQuality(metric)
  const valueClass = quality ? qualityTextClass(quality) : undefined

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.04 }}
      className="min-w-0"
    >
      <Card
        className={cn(
          'group h-full',
          quality && qualityToTone(quality) === 'positive' && 'border-success/20',
          quality && qualityToTone(quality) === 'warning' && 'border-warning/20',
          quality && qualityToTone(quality) === 'negative' && 'border-danger/20',
        )}
      >
        <CardContent className="min-w-0 p-5 sm:p-6">
          <p className="mb-2 truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {metric.label}
          </p>
          <p
            className={cn(
              'min-w-0 truncate font-mono text-2xl font-semibold tracking-tight sm:text-3xl',
              valueClass,
            )}
          >
            {isNumeric && metric.format !== 'text' ? (
              <AnimatedCounter
                value={metric.value as number}
                decimals={metric.format === 'percent' ? 2 : 0}
                prefix={
                  metric.format === 'currency'
                    ? (metric.value as number) >= 0
                      ? '+$'
                      : '-$'
                    : metric.format === 'percent' && (metric.value as number) >= 0
                      ? '+'
                      : ''
                }
                suffix={metric.format === 'percent' ? '%' : ''}
              />
            ) : (
              formatKpiValue(metric)
            )}
          </p>
          <p className="mt-2 text-[10px] text-muted-foreground">
            {metric.id === 'net-profit' ? 'How much it made' : 'How risky it is'}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function CompactMetric({ metric }: { metric: KpiMetric }) {
  const isNumeric = typeof metric.value === 'number'
  const quality = semanticQuality(metric)
  const valueClass = quality ? qualityTextClass(quality) : 'text-foreground'

  return (
    <div className="min-w-0 rounded-lg border border-border/60 bg-white/[0.02] px-3.5 py-3">
      <p className="truncate text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {metric.label}
      </p>
      <p className={cn('mt-1 truncate font-mono text-sm font-semibold tabular-nums', valueClass)}>
        {isNumeric && metric.format !== 'text' ? (
          <AnimatedCounter
            value={metric.value as number}
            decimals={
              metric.format === 'percent'
                ? 2
                : metric.id === 'profit-factor' || metric.id === 'avg-rr'
                  ? 2
                  : 0
            }
            prefix={
              metric.format === 'currency'
                ? (metric.value as number) >= 0
                  ? '+$'
                  : '-$'
                : metric.format === 'percent' && (metric.value as number) >= 0
                  ? '+'
                  : ''
            }
            suffix={metric.format === 'percent' ? '%' : ''}
          />
        ) : (
          formatKpiValue(metric)
        )}
      </p>
    </div>
  )
}

export function KpiCards({ metrics, researchScore }: KpiCardsProps) {
  const snapshot = metrics.filter((m) => tierFor(m.id) === 'snapshot')
  // Prefer Net Profit then Max Drawdown order
  const orderedSnapshot = [
    ...snapshot.filter((m) => m.id === 'net-profit'),
    ...snapshot.filter((m) => m.id === 'max-drawdown'),
  ]
  const secondary = metrics.filter((m) => tierFor(m.id) === 'secondary')
  const meta = metrics.filter((m) => tierFor(m.id) === 'meta')
  const moreCount = secondary.length + meta.length

  return (
    <div className="min-w-0 space-y-4">
      <div className={KPI_PRIMARY_GRID}>
        {typeof researchScore === 'number' ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="min-w-0"
          >
            <Card className="h-full">
              <CardContent className="flex h-full min-w-0 flex-col justify-center p-5 sm:p-6">
                <ResearchScore score={researchScore} size="lg" />
              </CardContent>
            </Card>
          </motion.div>
        ) : null}
        {orderedSnapshot.map((metric, index) => (
          <SnapshotMetric key={metric.id} metric={metric} index={index + 1} />
        ))}
      </div>

      {moreCount > 0 ? (
        <Disclosure title={`More metrics (${moreCount})`}>
          <div className="space-y-3">
            {secondary.length > 0 ? (
              <div className={KPI_SECONDARY_GRID}>
                {secondary.map((metric) => (
                  <CompactMetric key={metric.id} metric={metric} />
                ))}
              </div>
            ) : null}
            {meta.length > 0 ? (
              <div className={KPI_META_GRID}>
                {meta.map((metric) => (
                  <CompactMetric key={metric.id} metric={metric} />
                ))}
              </div>
            ) : null}
          </div>
        </Disclosure>
      ) : null}
    </div>
  )
}

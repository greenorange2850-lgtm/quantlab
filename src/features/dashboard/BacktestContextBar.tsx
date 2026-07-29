import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, cn } from '@/lib/utils'

export interface BacktestContextBarProps {
  strategyName: string | null
  symbol: string | null
  timeframe: string | null
  dateRange: string | null
  initialCapital: number | null
  commissionPercent: number | null
  riskPerTradePercent: number | null
}

interface ContextItem {
  label: string
  value: string | null
  emphasize?: boolean
}

function displayValue(value: string | null): { text: string; available: boolean } {
  if (value === null || value.trim() === '') {
    return { text: 'Not available', available: false }
  }
  return { text: value, available: true }
}

function formatDateRangeLabel(startMs: number, endMs: number): string {
  const start = new Date(startMs).toISOString().slice(0, 10)
  const end = new Date(endMs).toISOString().slice(0, 10)
  return start === end ? start : `${start} → ${end}`
}

/** Build a date-range label from equity curve epoch times; null if insufficient data. */
export function formatEquityDateRange(
  points: ReadonlyArray<{ time: number }> | null | undefined,
): string | null {
  if (!points || points.length === 0) return null
  const first = points[0]?.time
  const last = points.at(-1)?.time
  if (first === undefined || last === undefined) return null
  if (!Number.isFinite(first) || !Number.isFinite(last)) return null
  return formatDateRangeLabel(first, last)
}

function ContextField({ label, value, emphasize }: ContextItem) {
  const { text, available } = displayValue(value)

  return (
    <div className="min-w-0 flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span
        className={cn(
          'truncate text-sm',
          available ? 'font-medium text-foreground' : 'font-normal text-muted-foreground',
          available && !emphasize && 'font-mono',
          available && emphasize && 'text-foreground',
        )}
      >
        {text}
      </span>
    </div>
  )
}

export function BacktestContextBar({
  strategyName,
  symbol,
  timeframe,
  dateRange,
  initialCapital,
  commissionPercent,
  riskPerTradePercent,
}: BacktestContextBarProps) {
  const items: ContextItem[] = [
    { label: 'Strategy', value: strategyName, emphasize: true },
    { label: 'Symbol', value: symbol },
    { label: 'Timeframe', value: timeframe },
    { label: 'Date range', value: dateRange },
    {
      label: 'Initial capital',
      value: initialCapital === null ? null : formatCurrency(initialCapital).replace(/^\+/, ''),
    },
    {
      label: 'Commission',
      value: commissionPercent === null ? null : `${commissionPercent}%`,
    },
    {
      label: 'Risk per trade',
      value: riskPerTradePercent === null ? null : `${riskPerTradePercent}%`,
    },
  ]

  const hasAnyContext = items.some((item) => item.value !== null && item.value.trim() !== '')

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <Card className={cn(!hasAnyContext && 'border-dashed')}>
        <CardContent className="py-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Backtest context</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Research parameters for the currently displayed results
              </p>
            </div>
            <Badge variant={hasAnyContext ? 'accent' : 'outline'}>
              {hasAnyContext ? 'Loaded' : 'Awaiting backtest'}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            {items.map((item) => (
              <ContextField key={item.label} {...item} />
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

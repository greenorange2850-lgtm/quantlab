import { cn } from '@/lib/utils'
import { BACKTEST_TIMEFRAMES, type BacktestTimeframe } from '@/data/binance-exchange-info'

interface TimeframeSelectProps {
  value: string
  onChange: (timeframe: BacktestTimeframe) => void
  className?: string
  disabled?: boolean
  id?: string
}

export function TimeframeSelect({
  value,
  onChange,
  className,
  disabled = false,
  id,
}: TimeframeSelectProps) {
  return (
    <div className={cn('min-w-0 w-full', className)}>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as BacktestTimeframe)}
        className={cn(
          'flex h-11 w-full appearance-none rounded-lg border border-border bg-white/[0.03] px-3 text-sm text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
        aria-label="Timeframe"
      >
        {BACKTEST_TIMEFRAMES.map((timeframe) => (
          <option key={timeframe} value={timeframe} className="bg-card-solid text-foreground">
            {timeframe}
          </option>
        ))}
      </select>
    </div>
  )
}

import { cn } from '@/lib/utils'
import type { MetricTone } from '@/lib/metric-semantics'

export type { MetricTone }

interface MetricTileProps {
  label: string
  value: string
  hint?: string
  tone?: MetricTone
  /** Visual weight — primary KPIs read larger. */
  size?: 'primary' | 'secondary' | 'meta'
  className?: string
}

const toneValueClass: Record<MetricTone, string> = {
  default: 'text-foreground',
  positive: 'text-success',
  negative: 'text-danger',
  warning: 'text-warning',
  muted: 'text-muted-foreground',
}

const toneAccentClass: Record<MetricTone, string> = {
  default: 'border-border/70',
  positive: 'border-success/25',
  negative: 'border-danger/25',
  warning: 'border-warning/25',
  muted: 'border-border/50',
}

export function MetricTile({
  label,
  value,
  hint,
  tone = 'default',
  size = 'secondary',
  className,
}: MetricTileProps) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-lg border bg-white/[0.02]',
        toneAccentClass[tone],
        size === 'primary' && 'px-4 py-4',
        size === 'secondary' && 'px-3.5 py-3.5',
        size === 'meta' && 'px-3 py-3',
        className,
      )}
    >
      <p
        className={cn(
          'font-medium uppercase tracking-wider text-muted-foreground',
          size === 'primary' ? 'text-[11px]' : 'text-[10px]',
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          'mt-1.5 truncate font-mono font-semibold tabular-nums tracking-tight',
          size === 'primary' && 'text-xl sm:text-2xl',
          size === 'secondary' && 'text-sm sm:text-base',
          size === 'meta' && 'text-sm',
          toneValueClass[tone],
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

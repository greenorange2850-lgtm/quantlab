import { cn } from '@/lib/utils'

interface MetricTileProps {
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'positive' | 'negative' | 'muted'
}

export function MetricTile({ label, value, hint, tone = 'default' }: MetricTileProps) {
  return (
    <div className="min-w-0 rounded-lg border border-border/70 bg-white/[0.02] px-3 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          'mt-1 truncate font-mono text-sm font-semibold tabular-nums',
          tone === 'positive' && 'text-success',
          tone === 'negative' && 'text-danger',
          tone === 'muted' && 'text-muted-foreground',
          tone === 'default' && 'text-foreground',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

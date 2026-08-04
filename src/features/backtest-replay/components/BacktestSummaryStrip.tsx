import type { BacktestReplayBundle } from '@/data/replay'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency, formatPercent } from '@/lib/utils'

interface BacktestSummaryStripProps {
  summary: BacktestReplayBundle['reportSummary']
}

function formatRatio(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return 'Unavailable'
  return value.toFixed(2)
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border/50 bg-white/[0.02] p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-mono text-sm font-semibold text-foreground">{value}</p>
    </div>
  )
}

export function BacktestSummaryStrip({ summary }: BacktestSummaryStripProps) {
  return (
    <Card>
      <CardContent className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 xl:grid-cols-6">
        <Item label="Net Profit" value={summary ? formatCurrency(summary.netProfit) : 'Unavailable'} />
        <Item label="Total Trades" value={summary ? String(summary.totalTrades) : 'Unavailable'} />
        <Item
          label="Win Rate"
          value={summary ? formatPercent(summary.winRate * 100) : 'Unavailable'}
        />
        <Item label="Profit Factor" value={formatRatio(summary?.profitFactor)} />
        <Item
          label="Max DD"
          value={summary ? formatPercent(-summary.maxDrawdown * 100) : 'Unavailable'}
        />
        <Item
          label="Final Equity"
          value={summary ? formatCurrency(summary.finalBalance) : 'Unavailable'}
        />
      </CardContent>
    </Card>
  )
}

import type { Trade } from '@/core/backtest/Trade'
import type { ReplayTradeMarker } from '@/core/backtest/execution-events'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { tradeReturnPercent } from '../trade-list-model'

interface SelectedTradeCardProps {
  trade: Trade | null
  marker: ReplayTradeMarker | null
}

function formatValue(value: number | null | undefined, decimals = 2): string {
  if (value == null || !Number.isFinite(value)) return 'Unavailable'
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function formatTime(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return 'Unavailable'
  return new Date(value).toLocaleString()
}

function formatDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return 'Unavailable'
  const minutes = Math.max(0, Math.round(ms / 60_000))
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const restMinutes = minutes % 60
  if (hours < 24) return `${hours}h ${restMinutes}m`
  const days = Math.floor(hours / 24)
  return `${days}d ${hours % 24}h`
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border border-border/50 bg-white/[0.02] p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-1 min-w-0 break-words font-mono text-xs text-foreground">{value}</div>
    </div>
  )
}

export function SelectedTradeCard({ trade, marker }: SelectedTradeCardProps) {
  if (!trade) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-xs text-muted-foreground">
          Select a trade to inspect entry, exit, sizing, and verification details.
        </CardContent>
      </Card>
    )
  }

  const returnPercent = tradeReturnPercent(trade)
  const profitable = trade.pnl >= 0

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div className="min-w-0">
          <CardTitle className="text-base">Selected Trade</CardTitle>
          <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{trade.id}</p>
        </div>
        <Badge variant={trade.direction === 'LONG' ? 'success' : 'danger'} className="shrink-0">
          {trade.direction === 'LONG' ? 'BUY / LONG' : 'SELL / SHORT'}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="grid grid-cols-2 gap-2">
          <Field label="P&L" value={<span className={profitable ? 'text-success' : 'text-danger'}>{formatCurrency(trade.pnl)}</span>} />
          <Field
            label="Return"
            value={returnPercent == null ? 'Unavailable' : formatPercent(returnPercent)}
          />
          <Field label="Entry Price" value={formatValue(trade.entryPrice)} />
          <Field label="Exit Price" value={formatValue(trade.exitPrice)} />
          <Field label="Quantity" value={formatValue(trade.quantity, 6)} />
          <Field label="Commission" value={formatCurrency(-Math.abs(trade.commission))} />
          <Field label="Entry Time" value={formatTime(trade.entryTime)} />
          <Field label="Exit Time" value={formatTime(trade.exitTime)} />
          <Field label="Duration" value={formatDuration(trade.duration)} />
          <Field label="Stop Loss" value={formatValue(marker?.stopLossPrice)} />
          <Field label="Take Profit" value={formatValue(marker?.takeProfitPrice)} />
          <Field label="Exit Reason" value={marker?.exitReason ?? 'Unavailable'} />
        </div>
        <div className="rounded-lg border border-border/50 bg-white/[0.02] p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Entry Reason</p>
          <p className="mt-1 text-xs text-foreground">{marker?.entryReason ?? 'Unavailable'}</p>
        </div>
      </CardContent>
    </Card>
  )
}

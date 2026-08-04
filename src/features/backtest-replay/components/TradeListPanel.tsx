import { useMemo, useState } from 'react'
import type { Trade } from '@/core/backtest/Trade'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Disclosure } from '@/components/ui/disclosure'
import { formatCurrency, formatPercent, cn } from '@/lib/utils'
import {
  filterAndSortTrades,
  tradeReturnPercent,
  type TradeListFilter,
  type TradeListSort,
} from '../trade-list-model'

interface TradeListPanelProps {
  trades: Trade[]
  selectedTradeId: string | null
  onSelect: (trade: Trade) => void
}

const filters: Array<{ value: TradeListFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'winners', label: 'Winners' },
  { value: 'losers', label: 'Losers' },
  { value: 'buy', label: 'BUY' },
  { value: 'sell', label: 'SELL' },
]

const sorts: Array<{ value: TradeListSort; label: string }> = [
  { value: 'chronological', label: 'Chronological' },
  { value: 'highest_profit', label: 'Highest Profit' },
  { value: 'largest_loss', label: 'Largest Loss' },
]

export function TradeListPanel({ trades, selectedTradeId, onSelect }: TradeListPanelProps) {
  const [filter, setFilter] = useState<TradeListFilter>('all')
  const [sort, setSort] = useState<TradeListSort>('chronological')
  const rows = useMemo(() => filterAndSortTrades(trades, filter, sort), [filter, sort, trades])
  const indexById = useMemo(
    () => new Map(trades.map((trade, index) => [trade.id, index])),
    [trades],
  )

  return (
    <Disclosure title={`Trade List (${rows.length})`}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-muted-foreground">
            Filter
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as TradeListFilter)}
              className="mt-1 min-h-11 w-full rounded-lg border border-border bg-white/5 px-3 text-xs text-foreground"
            >
              {filters.map((item) => (
                <option key={item.value} value={item.value} className="bg-slate-950">
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            Sort
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as TradeListSort)}
              className="mt-1 min-h-11 w-full rounded-lg border border-border bg-white/5 px-3 text-xs text-foreground"
            >
              {sorts.map((item) => (
                <option key={item.value} value={item.value} className="bg-slate-950">
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="space-y-2">
          {rows.map((trade) => {
            const selected = trade.id === selectedTradeId
            const index = indexById.get(trade.id)
            const returnPercent = tradeReturnPercent(trade)

            return (
              <button
                key={trade.id}
                type="button"
                onClick={() => onSelect(trade)}
                className={cn(
                  'w-full min-w-0 rounded-lg border p-3 text-left transition-colors',
                  selected
                    ? 'border-accent/50 bg-accent/10'
                    : 'border-border/60 bg-white/[0.02] hover:border-border-hover hover:bg-white/[0.04]',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-medium text-foreground">
                      Trade {index == null ? 'Unavailable' : index + 1}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {new Date(trade.entryTime).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant={trade.direction === 'LONG' ? 'success' : 'danger'} className="shrink-0">
                    {trade.direction === 'LONG' ? 'BUY' : 'SELL'}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                  <span className={cn('font-mono', trade.pnl >= 0 ? 'text-success' : 'text-danger')}>
                    {formatCurrency(trade.pnl)}
                  </span>
                  <span className="font-mono text-muted-foreground">
                    {returnPercent == null ? 'Unavailable' : formatPercent(returnPercent)}
                  </span>
                  <span className="truncate text-right font-mono text-muted-foreground">
                    {trade.quantity.toLocaleString('en-US', { maximumFractionDigits: 6 })}
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        {rows.length === 0 && (
          <div className="rounded-lg border border-dashed border-border/70 p-5 text-center text-xs text-muted-foreground">
            No trades match this filter.
          </div>
        )}

        <Button
          type="button"
          variant="ghost"
          className="min-h-11 w-full"
          disabled={rows.length === trades.length}
          onClick={() => {
            setFilter('all')
            setSort('chronological')
          }}
        >
          Reset filters
        </Button>
      </div>
    </Disclosure>
  )
}

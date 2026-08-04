import type { Trade } from '@/core/backtest/Trade'

export type TradeListFilter = 'all' | 'winners' | 'losers' | 'buy' | 'sell'
export type TradeListSort = 'chronological' | 'highest_profit' | 'largest_loss'

export function filterAndSortTrades(
  trades: readonly Trade[],
  filter: TradeListFilter,
  sort: TradeListSort,
): Trade[] {
  let rows = [...trades]
  switch (filter) {
    case 'winners':
      rows = rows.filter((t) => t.pnl > 0)
      break
    case 'losers':
      rows = rows.filter((t) => t.pnl < 0)
      break
    case 'buy':
      rows = rows.filter((t) => t.direction === 'LONG')
      break
    case 'sell':
      rows = rows.filter((t) => t.direction === 'SHORT')
      break
    default:
      break
  }

  switch (sort) {
    case 'highest_profit':
      rows.sort((a, b) => b.pnl - a.pnl)
      break
    case 'largest_loss':
      rows.sort((a, b) => a.pnl - b.pnl)
      break
    default:
      rows.sort((a, b) => a.entryTime - b.entryTime)
      break
  }

  return rows
}

export function tradeReturnPercent(trade: Trade): number | null {
  const notional = trade.entryPrice * trade.quantity
  if (!Number.isFinite(notional) || Math.abs(notional) < 1e-12) return null
  return (trade.pnl / notional) * 100
}

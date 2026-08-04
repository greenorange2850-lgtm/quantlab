import type { Trade } from '@/core/backtest/Trade'
import type { BacktestExecutionEvent } from '@/core/backtest/execution-events'
import type { ReplayTradeMarker } from '@/core/backtest/execution-events'

/**
 * Build chart markers strictly from persisted trade records.
 * Stop-loss / take-profit / reasons come from diagnostics when present; otherwise null.
 */
export function buildTradeMarkers(
  trades: readonly Trade[],
  events: readonly BacktestExecutionEvent[] = [],
): ReplayTradeMarker[] {
  return trades.map((trade, tradeIndex) => {
    const openEvent = events.find(
      (event) =>
        event.kind === 'trade_opened' &&
        event.fillPrice != null &&
        Math.abs(event.fillPrice - trade.entryPrice) < 1e-9 &&
        event.candleTime === trade.entryTime,
    )
    const closeEvent = events.find(
      (event) => event.kind === 'trade_closed' && event.tradeId === trade.id,
    )

    return {
      tradeId: trade.id,
      tradeIndex,
      direction: trade.direction,
      entryTime: trade.entryTime,
      exitTime: trade.exitTime,
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice,
      stopLossPrice: openEvent?.stopLossPrice ?? null,
      takeProfitPrice: null,
      pnl: trade.pnl,
      commission: trade.commission,
      quantity: trade.quantity,
      duration: trade.duration,
      exitReason: closeEvent?.reason
        ? inferExitReason(closeEvent)
        : null,
      entryReason: openEvent?.reason ?? null,
    }
  })
}

function inferExitReason(event: BacktestExecutionEvent): string {
  if (event.signal === 'BUY' || event.signal === 'SELL') {
    return 'Opposite signal'
  }
  return event.reason ?? 'Unavailable'
}

export function markersVisibleAtCursor(
  markers: readonly ReplayTradeMarker[],
  cursorTime: number | null,
  mode: 'full' | 'replay',
): ReplayTradeMarker[] {
  if (mode === 'full' || cursorTime === null) return [...markers]
  return markers.filter((marker) => marker.entryTime <= cursorTime)
}

export function exitsVisibleAtCursor(
  markers: readonly ReplayTradeMarker[],
  cursorTime: number | null,
  mode: 'full' | 'replay',
): ReplayTradeMarker[] {
  if (mode === 'full' || cursorTime === null) return [...markers]
  return markers.filter((marker) => marker.exitTime <= cursorTime)
}

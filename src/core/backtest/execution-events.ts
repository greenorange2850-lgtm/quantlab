import type { TradeDirection } from './Trade.js'

/**
 * Optional execution trace recorded during a backtest.
 * Recording must never change fills, sizing, or trade outcomes.
 */
export type BacktestExecutionEventKind =
  | 'signal_evaluated'
  | 'signal_queued'
  | 'order_skipped'
  | 'fill_applied'
  | 'trade_opened'
  | 'trade_closed'

export type PositionState = 'flat' | 'long' | 'short'

export interface BacktestExecutionEvent {
  id: string
  kind: BacktestExecutionEventKind
  /** Index into the candle array used by the engine. */
  candleIndex: number
  candleTime: number
  /** Signal type string when applicable (BUY / SELL / HOLD). */
  signal: string | null
  reason: string | null
  /** Strategy-provided stop used for sizing (not an exchange stop order). */
  stopLossPrice: number | null
  takeProfitPrice: number | null
  positionBefore: PositionState
  positionAfter: PositionState
  skipReason: string | null
  tradeId: string | null
  fillPrice: number | null
  fillQuantity: number | null
  commission: number | null
  pnl: number | null
  /** True when RSI confirmation blocked a crossover (from signal reason). */
  rsiConfirmationFailed: boolean | null
}

export interface ReplayTradeMarker {
  tradeId: string
  tradeIndex: number
  direction: TradeDirection
  entryTime: number
  exitTime: number
  entryPrice: number
  exitPrice: number
  stopLossPrice: number | null
  takeProfitPrice: number | null
  pnl: number
  commission: number
  quantity: number
  duration: number
  exitReason: string | null
  entryReason: string | null
}

export const EXECUTION_ASSUMPTIONS = {
  signalTiming: 'Signal evaluated on candle close; order fills at next candle open.',
  fillModel: 'Market fill at next open ± configured slippage.',
  feeModel: 'Commission percent of notional on entry and exit fills.',
  slippageModel: 'Optional percent slippage applied by ExecutionEngine.',
  positionModel: 'Single position. Opposite signal closes; does not reverse in one step.',
  stopLossModel:
    'Stop-loss price from the strategy is used for risk-based sizing only — not as a live exit order.',
  takeProfitModel: 'Take-profit exit orders are not supported by the current engine.',
} as const

import type { Candle } from '@/data/candles'
import type { Trade } from '@/core/backtest/Trade'
import type { BacktestExecutionEvent } from '@/core/backtest/execution-events'
import {
  MovingAverageCrossStrategy,
  type MovingAverageCrossParams,
  DEFAULT_MA_CROSS_PARAMS,
} from '@/core/strategy/MovingAverageCrossStrategy'
import { SignalType } from '@/core/signals/SignalType'

export interface SignalVerificationSnapshot {
  candleTime: number
  fastEma: number | null
  slowEma: number | null
  rsi: number | null
  cross: 'Bullish' | 'Bearish' | 'None' | 'Unavailable'
  signal: string
  execution: string
  reason: string
  positionBefore: string
  rsiConfirmation: 'passed' | 'failed' | 'n/a' | 'Unavailable'
  rawSignal: string
  stopSizingValid: boolean | null
  tradeOpened: boolean
  tradeClosed: boolean
  skipped: boolean
  skipReason: string | null
}

/**
 * Build signal verification using the existing strategy indicator helpers
 * and optional persisted execution events. Does not invent stop/TP values.
 */
export function buildSignalVerification(input: {
  candles: readonly Candle[]
  candleIndex: number
  strategyParams?: MovingAverageCrossParams | null
  events?: readonly BacktestExecutionEvent[]
  trades?: readonly Trade[]
}): SignalVerificationSnapshot | null {
  const { candles, candleIndex } = input
  if (candleIndex < 0 || candleIndex >= candles.length) return null

  const candle = candles[candleIndex]
  const history = candles.slice(0, candleIndex + 1)
  const params = input.strategyParams ?? DEFAULT_MA_CROSS_PARAMS
  const strategy = new MovingAverageCrossStrategy(params)
  const indicators = strategy.getIndicators(history)
  const signal = strategy.evaluate(history, 'VERIFY')

  let cross: SignalVerificationSnapshot['cross'] = 'Unavailable'
  if (indicators) {
    const closes = history.map((c) => c.close)
    if (closes.length >= 2) {
      const prevHistory = candles.slice(0, candleIndex)
      const prevIndicators = strategy.getIndicators(prevHistory)
      if (prevIndicators && indicators) {
        const bullish =
          prevIndicators.ema20 <= prevIndicators.ema50 && indicators.ema20 > indicators.ema50
        const bearish =
          prevIndicators.ema20 >= prevIndicators.ema50 && indicators.ema20 < indicators.ema50
        cross = bullish ? 'Bullish' : bearish ? 'Bearish' : 'None'
      } else {
        cross = 'None'
      }
    }
  }

  const evaluated = input.events?.find(
    (event) => event.kind === 'signal_evaluated' && event.candleIndex === candleIndex,
  )
  const queued = input.events?.find(
    (event) => event.kind === 'signal_queued' && event.candleIndex === candleIndex,
  )
  const fillAtNext = input.events?.find(
    (event) =>
      (event.kind === 'trade_opened' || event.kind === 'trade_closed' || event.kind === 'order_skipped') &&
      event.candleIndex === candleIndex + 1,
  )

  const rsiConfirmation: SignalVerificationSnapshot['rsiConfirmation'] =
    evaluated?.rsiConfirmationFailed === true
      ? 'failed'
      : evaluated?.rsiConfirmationFailed === false &&
          (signal.signal === SignalType.BUY || signal.signal === SignalType.SELL)
        ? 'passed'
        : signal.signal === SignalType.HOLD && /RSI did not confirm/i.test(signal.reason)
          ? 'failed'
          : signal.signal === SignalType.BUY || signal.signal === SignalType.SELL
            ? 'passed'
            : 'n/a'

  let execution = 'No order'
  if (fillAtNext?.kind === 'trade_opened') {
    execution =
      fillAtNext.positionAfter === 'long' ? 'Opened long' : fillAtNext.positionAfter === 'short' ? 'Opened short' : 'Opened'
  } else if (fillAtNext?.kind === 'trade_closed') {
    execution =
      fillAtNext.positionBefore === 'long' ? 'Closed long' : fillAtNext.positionBefore === 'short' ? 'Closed short' : 'Closed'
  } else if (fillAtNext?.kind === 'order_skipped') {
    execution = `Skipped: ${fillAtNext.skipReason ?? 'Unavailable'}`
  } else if (queued) {
    execution = 'Queued for next open'
  }

  return {
    candleTime: candle.time,
    fastEma: indicators?.ema20 ?? null,
    slowEma: indicators?.ema50 ?? null,
    rsi: indicators?.rsi ?? null,
    cross,
    signal: signal.signal,
    execution,
    reason: evaluated?.reason ?? signal.reason,
    positionBefore: evaluated?.positionBefore ?? 'Unavailable',
    rsiConfirmation,
    rawSignal: evaluated?.signal ?? signal.signal,
    stopSizingValid:
      signal.signal === SignalType.HOLD
        ? null
        : signal.stopLossPrice != null && Number.isFinite(signal.stopLossPrice),
    tradeOpened: fillAtNext?.kind === 'trade_opened',
    tradeClosed: fillAtNext?.kind === 'trade_closed',
    skipped: fillAtNext?.kind === 'order_skipped',
    skipReason: fillAtNext?.skipReason ?? null,
  }
}

export function buildVerifyTradeNarrative(input: {
  trade: Trade
  candles: readonly Candle[]
  events: readonly BacktestExecutionEvent[]
  strategyParams?: MovingAverageCrossParams | null
}): { entry: string[]; exit: string[] } {
  const entryIndex = input.candles.findIndex((c) => c.time === input.trade.entryTime)
  // Signal was on previous candle; fill at entry candle open.
  const signalIndex = entryIndex > 0 ? entryIndex - 1 : entryIndex
  const verification =
    signalIndex >= 0
      ? buildSignalVerification({
          candles: input.candles,
          candleIndex: signalIndex,
          strategyParams: input.strategyParams,
          events: input.events,
          trades: [input.trade],
        })
      : null

  const openEvent = input.events.find(
    (event) =>
      event.kind === 'trade_opened' &&
      event.candleTime === input.trade.entryTime &&
      event.fillPrice != null &&
      Math.abs(event.fillPrice - input.trade.entryPrice) < 1e-9,
  )
  const closeEvent = input.events.find(
    (event) => event.kind === 'trade_closed' && event.tradeId === input.trade.id,
  )

  const entry: string[] = [
    `Candle: ${formatTs(input.trade.entryTime)}`,
    verification
      ? `${verification.cross} EMA cross / signal ${verification.signal}`
      : 'Signal details Unavailable',
    verification
      ? `RSI confirmation: ${verification.rsiConfirmation}`
      : 'RSI confirmation: Unavailable',
    openEvent
      ? `Position before: ${openEvent.positionBefore}`
      : 'Position before: Unavailable',
    `${input.trade.direction === 'LONG' ? 'BUY' : 'SELL'} opened at next candle open (${input.trade.entryPrice})`,
  ]

  const exit: string[] = [
    `Candle: ${formatTs(input.trade.exitTime)}`,
    closeEvent?.reason ?? 'Exit reason: Unavailable',
    closeEvent
      ? `Existing ${closeEvent.positionBefore} closed`
      : `${input.trade.direction === 'LONG' ? 'Long' : 'Short'} closed`,
    `Net result after fees: ${input.trade.pnl >= 0 ? '+' : ''}${input.trade.pnl.toFixed(2)}`,
    'Stop-loss / take-profit exit orders: not used by current engine',
  ]

  return { entry, exit }
}

function formatTs(ms: number): string {
  return new Date(ms).toISOString().replace('T', ' ').replace('.000Z', ' UTC')
}

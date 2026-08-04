import type { Candle } from '@/data/candles'
import type { EquityPoint } from '@/core/backtest/BacktestResult'
import type { Trade } from '@/core/backtest/Trade'

export type ReplaySpeedMultiplier = 0.5 | 1 | 2 | 5

export const REPLAY_SPEEDS: ReplaySpeedMultiplier[] = [0.5, 1, 2, 5]

/** Default half-window of candles around a selected trade. */
export const DEFAULT_CONTEXT_BARS = 48

/** Hard cap for candles rendered in the chart window. */
export const MAX_VISIBLE_CANDLES = 180

export interface CandleWindow {
  startIndex: number
  endIndex: number
  candles: Candle[]
}

export function findCandleIndex(candles: readonly Candle[], time: number): number {
  let lo = 0
  let hi = candles.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const t = candles[mid].time
    if (t === time) return mid
    if (t < time) lo = mid + 1
    else hi = mid - 1
  }
  return Math.max(0, Math.min(candles.length - 1, lo))
}

export function windowAroundTrade(
  candles: readonly Candle[],
  trade: Trade,
  contextBars = DEFAULT_CONTEXT_BARS,
  maxVisible = MAX_VISIBLE_CANDLES,
): CandleWindow {
  if (candles.length === 0) {
    return { startIndex: 0, endIndex: -1, candles: [] }
  }
  const entryIndex = findCandleIndex(candles, trade.entryTime)
  const exitIndex = findCandleIndex(candles, trade.exitTime)
  let start = Math.max(0, entryIndex - contextBars)
  let end = Math.min(candles.length - 1, exitIndex + contextBars)
  if (end - start + 1 > maxVisible) {
    const mid = Math.floor((entryIndex + exitIndex) / 2)
    const half = Math.floor(maxVisible / 2)
    start = Math.max(0, mid - half)
    end = Math.min(candles.length - 1, start + maxVisible - 1)
    start = Math.max(0, end - maxVisible + 1)
  }
  return {
    startIndex: start,
    endIndex: end,
    candles: candles.slice(start, end + 1),
  }
}

export function candlesVisibleForReplay(
  candles: readonly Candle[],
  cursorIndex: number,
): Candle[] {
  if (cursorIndex < 0) return []
  return candles.slice(0, Math.min(candles.length, cursorIndex + 1))
}

export function equityAtCursor(
  equityCurve: readonly EquityPoint[],
  cursorTime: number | null,
): EquityPoint | null {
  if (!equityCurve.length) return null
  if (cursorTime === null) return equityCurve.at(-1) ?? null
  let best: EquityPoint | null = null
  for (const point of equityCurve) {
    if (point.time <= cursorTime) best = point
    else break
  }
  return best ?? equityCurve[0] ?? null
}

export function realizedPnlThrough(
  trades: readonly Trade[],
  cursorTime: number | null,
): number {
  if (cursorTime === null) {
    return trades.reduce((sum, trade) => sum + trade.pnl, 0)
  }
  return trades
    .filter((trade) => trade.exitTime <= cursorTime)
    .reduce((sum, trade) => sum + trade.pnl, 0)
}

export function maxDrawdownAtCursor(
  equityCurve: readonly EquityPoint[],
  cursorTime: number | null,
  initialCapital: number,
): number {
  let peak = initialCapital
  let maxDd = 0
  for (const point of equityCurve) {
    if (cursorTime !== null && point.time > cursorTime) break
    peak = Math.max(peak, point.equity)
    if (peak > 0) {
      maxDd = Math.max(maxDd, (peak - point.equity) / peak)
    }
  }
  return maxDd
}

export interface ReplayControllerState {
  cursorIndex: number
  playing: boolean
  speed: ReplaySpeedMultiplier
  mode: 'full' | 'replay'
}

export function createInitialReplayState(
  candleCount: number,
  preferFull = true,
): ReplayControllerState {
  return {
    cursorIndex: preferFull ? Math.max(0, candleCount - 1) : -1,
    playing: false,
    speed: 1,
    mode: preferFull ? 'full' : 'replay',
  }
}

export function stepCursor(
  state: ReplayControllerState,
  candleCount: number,
  steps: number,
): ReplayControllerState {
  const next = Math.min(candleCount - 1, Math.max(-1, state.cursorIndex + steps))
  return {
    ...state,
    cursorIndex: next,
    mode: 'replay',
    playing: false,
  }
}

export function msPerCandle(speed: ReplaySpeedMultiplier): number {
  return 400 / speed
}

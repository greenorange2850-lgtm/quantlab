import { describe, expect, it, beforeEach } from 'vitest'
import type { Candle } from '@/data/candles'
import { BacktestEngine } from '@/core/backtest/BacktestEngine'
import type { BacktestExecutionEvent } from '@/core/backtest/execution-events'
import { TradeDirection, type Trade } from '@/core/backtest/Trade'
import { defaultRiskConfig } from '@/core/risk/config'
import { MovingAverageCrossStrategy } from '@/core/strategy/MovingAverageCrossStrategy'
import { buildBacktestReport } from '@/core/analytics/report-builder'
import {
  MemoryBacktestReplayStore,
  setBacktestReplayStoreForTests,
} from '@/data/replay'
import {
  buildTradeMarkers,
  exitsVisibleAtCursor,
  markersVisibleAtCursor,
} from '../trade-markers'
import {
  candlesVisibleForReplay,
  createInitialReplayState,
  findCandleIndex,
  maxDrawdownAtCursor,
  realizedPnlThrough,
  stepCursor,
  windowAroundTrade,
  MAX_VISIBLE_CANDLES,
} from '../replay-window'
import { buildSignalVerification } from '../signal-verification'
import { filterAndSortTrades, tradeReturnPercent } from '../trade-list-model'
import {
  canOpenReplayFromDetail,
  loadBacktestReplay,
  persistBacktestReplay,
  replayUnavailableMessage,
} from '../load-replay'
import {
  clearReplayAvailabilityIndex,
  isReplayAvailableForBacktest,
} from '../replay-availability'
import { clearBacktestDetailArchive, saveBacktestDetail } from '@/backtests/detail-archive'
import { buildPersistedDetail } from '@/backtests/restore-dashboard'

function makeCandles(count: number, start = 1_700_000_000_000): Candle[] {
  const candles: Candle[] = []
  let price = 100
  for (let i = 0; i < count; i++) {
    const open = price
    const close = price + ((i % 3) - 1) * 0.4
    candles.push({
      time: start + i * 60_000,
      open,
      high: Math.max(open, close) + 0.5,
      low: Math.min(open, close) - 0.5,
      close,
      volume: 10,
    })
    price = close
  }
  return candles
}

function makeTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: 't1',
    symbol: 'BTCUSDT',
    entryTime: 1_700_000_060_000,
    exitTime: 1_700_000_180_000,
    entryPrice: 100.5,
    exitPrice: 101.2,
    quantity: 1,
    direction: TradeDirection.LONG,
    pnl: 0.5,
    commission: 0.2,
    duration: 120_000,
    ...overrides,
  }
}

describe('trade markers', () => {
  it('maps marker timestamps and prices from trade records', () => {
    const trade = makeTrade({ direction: TradeDirection.SHORT, entryPrice: 99, exitPrice: 98 })
    const markers = buildTradeMarkers([trade], [])
    expect(markers[0].entryTime).toBe(trade.entryTime)
    expect(markers[0].exitTime).toBe(trade.exitTime)
    expect(markers[0].entryPrice).toBe(99)
    expect(markers[0].exitPrice).toBe(98)
    expect(markers[0].direction).toBe('SHORT')
    expect(markers[0].takeProfitPrice).toBeNull()
    expect(markers[0].stopLossPrice).toBeNull()
  })

  it('hides future entries and exits during replay', () => {
    const trades = [
      makeTrade({ id: 'a', entryTime: 10, exitTime: 30 }),
      makeTrade({ id: 'b', entryTime: 40, exitTime: 60 }),
    ]
    const markers = buildTradeMarkers(trades)
    expect(markersVisibleAtCursor(markers, 25, 'replay')).toHaveLength(1)
    expect(exitsVisibleAtCursor(markers, 25, 'replay')).toHaveLength(0)
    expect(exitsVisibleAtCursor(markers, 30, 'replay')).toHaveLength(1)
    expect(markersVisibleAtCursor(markers, null, 'full')).toHaveLength(2)
  })

  it('attaches stop-loss from diagnostics without inventing take-profit', () => {
    const trade = makeTrade()
    const events: BacktestExecutionEvent[] = [
      {
        id: 'e1',
        kind: 'trade_opened',
        candleIndex: 1,
        candleTime: trade.entryTime,
        signal: 'BUY',
        reason: 'cross',
        stopLossPrice: 95,
        takeProfitPrice: null,
        positionBefore: 'flat',
        positionAfter: 'long',
        skipReason: null,
        tradeId: null,
        fillPrice: trade.entryPrice,
        fillQuantity: 1,
        commission: 0.1,
        pnl: null,
        rsiConfirmationFailed: false,
      },
    ]
    const markers = buildTradeMarkers([trade], events)
    expect(markers[0].stopLossPrice).toBe(95)
    expect(markers[0].takeProfitPrice).toBeNull()
  })
})

describe('replay cursor controls', () => {
  it('steps, restarts, and hides future candles', () => {
    const candles = makeCandles(20)
    let state = createInitialReplayState(candles.length, false)
    expect(candlesVisibleForReplay(candles, state.cursorIndex)).toHaveLength(0)

    state = stepCursor(state, candles.length, 1)
    expect(state.cursorIndex).toBe(0)
    expect(candlesVisibleForReplay(candles, state.cursorIndex)).toHaveLength(1)

    state = stepCursor(state, candles.length, 10)
    expect(state.cursorIndex).toBe(10)
    expect(candlesVisibleForReplay(candles, state.cursorIndex)).toHaveLength(11)

    state = { ...state, cursorIndex: -1, playing: false, mode: 'replay' }
    expect(candlesVisibleForReplay(candles, state.cursorIndex)).toHaveLength(0)
  })

  it('centers chart window around selected trade and caps visible candles', () => {
    const candles = makeCandles(500)
    const trade = makeTrade({
      entryTime: candles[200].time,
      exitTime: candles[220].time,
    })
    const window = windowAroundTrade(candles, trade)
    expect(window.candles.length).toBeLessThanOrEqual(MAX_VISIBLE_CANDLES)
    expect(window.candles.some((c) => c.time === trade.entryTime)).toBe(true)
    expect(findCandleIndex(candles, trade.entryTime)).toBe(200)
  })
})

describe('equity from persisted trades', () => {
  it('updates realized pnl after closed trades and matches final equity math', () => {
    const trades = [
      makeTrade({ id: '1', exitTime: 10, pnl: 40 }),
      makeTrade({ id: '2', exitTime: 20, pnl: -15 }),
    ]
    expect(realizedPnlThrough(trades, 5)).toBe(0)
    expect(realizedPnlThrough(trades, 10)).toBe(40)
    expect(realizedPnlThrough(trades, null)).toBe(25)

    const equityCurve = [
      { time: 0, equity: 10_000, cash: 10_000 },
      { time: 10, equity: 10_040, cash: 10_040 },
      { time: 20, equity: 10_025, cash: 10_025 },
    ]
    expect(maxDrawdownAtCursor(equityCurve, 20, 10_000)).toBeGreaterThanOrEqual(0)
    expect(equityCurve.at(-1)!.equity).toBe(10_000 + 25)
  })
})

describe('signal verification / no look-ahead', () => {
  it('uses indicators only from candles at or before the selected index', () => {
    const candles = makeCandles(80)
    const at = 60
    const snap = buildSignalVerification({
      candles,
      candleIndex: at,
      strategyParams: { fastPeriod: 5, slowPeriod: 10, rsiPeriod: 5 },
    })
    expect(snap).not.toBeNull()
    expect(snap!.candleTime).toBe(candles[at].time)
    // Recompute with truncated history — must match (no future leakage).
    const truncated = buildSignalVerification({
      candles: candles.slice(0, at + 1),
      candleIndex: at,
      strategyParams: { fastPeriod: 5, slowPeriod: 10, rsiPeriod: 5 },
    })
    expect(truncated!.fastEma).toBe(snap!.fastEma)
    expect(truncated!.slowEma).toBe(snap!.slowEma)
    expect(truncated!.rsi).toBe(snap!.rsi)
  })
})

describe('trade list selection helpers', () => {
  it('filters winners/losers/buy/sell and sorts by profit', () => {
    const trades = [
      makeTrade({ id: '1', direction: TradeDirection.LONG, pnl: 10, entryTime: 1 }),
      makeTrade({ id: '2', direction: TradeDirection.SHORT, pnl: -5, entryTime: 2 }),
      makeTrade({ id: '3', direction: TradeDirection.LONG, pnl: 30, entryTime: 3 }),
    ]
    expect(filterAndSortTrades(trades, 'winners', 'chronological')).toHaveLength(2)
    expect(filterAndSortTrades(trades, 'losers', 'chronological')[0].id).toBe('2')
    expect(filterAndSortTrades(trades, 'buy', 'highest_profit')[0].id).toBe('3')
    expect(filterAndSortTrades(trades, 'sell', 'chronological')).toHaveLength(1)
    expect(tradeReturnPercent(trades[0])).not.toBeNull()
  })
})

describe('execution diagnostics do not change engine results', () => {
  it('produces identical trades with and without diagnostics sink', () => {
    const candles = makeCandles(120)
    const strategy = new MovingAverageCrossStrategy({
      fastPeriod: 5,
      slowPeriod: 12,
      rsiPeriod: 5,
    })
    const config = {
      initialCapital: 10_000,
      commissionPercent: 0.1,
      positionSizePercent: 100,
      symbol: 'BTCUSDT',
      riskConfig: defaultRiskConfig,
    }
    const engineA = new BacktestEngine()
    const engineB = new BacktestEngine()
    const events: BacktestExecutionEvent[] = []
    const a = engineA.run(candles, strategy, config)
    const b = engineB.run(candles, strategy, config, {
      onExecutionEvent: (event) => events.push(event),
    })
    expect(b.trades).toEqual(a.trades)
    expect(b.statistics).toEqual(a.statistics)
    expect(b.equityCurve).toEqual(a.equityCurve)
    expect(events.length).toBeGreaterThan(0)
  })
})

describe('slim archive / persistence', () => {
  beforeEach(() => {
    clearBacktestDetailArchive()
    clearReplayAvailabilityIndex()
    setBacktestReplayStoreForTests(new MemoryBacktestReplayStore())
  })

  it('reports unavailable for slim archives without candles/trades', async () => {
    expect(canOpenReplayFromDetail({ candles: [], trades: [] })).toBe(false)
    expect(isReplayAvailableForBacktest('missing-id')).toBe(false)
    expect(replayUnavailableMessage('slim_archive')).toContain('Full replay data is unavailable')

    const availability = await loadBacktestReplay('missing-id')
    expect(availability.available).toBe(false)
  })

  it('marks replay available synchronously when persistBacktestReplay runs', async () => {
    const candles = makeCandles(20)
    const strategy = new MovingAverageCrossStrategy({
      fastPeriod: 3,
      slowPeriod: 8,
      rsiPeriod: 3,
    })
    const result = new BacktestEngine().run(candles, strategy, {
      initialCapital: 10_000,
      commissionPercent: 0.1,
      positionSizePercent: 100,
      symbol: 'BTCUSDT',
      riskConfig: defaultRiskConfig,
    })
    const report = buildBacktestReport(result)

    expect(isReplayAvailableForBacktest('bt-sync-avail')).toBe(false)
    await persistBacktestReplay({
      backtestId: 'bt-sync-avail',
      candles,
      trades: report.trades,
      report,
      strategyName: 'Moving Average Cross',
      strategyVersion: 'v1',
      timeframe: '15M',
      strategyParams: strategy.params,
    })
    expect(isReplayAvailableForBacktest('bt-sync-avail')).toBe(true)
  })

  it('persists IndexedDB (memory) replay and reloads candles/trades/events', async () => {
    const candles = makeCandles(40)
    const strategy = new MovingAverageCrossStrategy({
      fastPeriod: 3,
      slowPeriod: 8,
      rsiPeriod: 3,
    })
    const events: BacktestExecutionEvent[] = []
    const result = new BacktestEngine().run(
      candles,
      strategy,
      {
        initialCapital: 10_000,
        commissionPercent: 0.1,
        positionSizePercent: 100,
        symbol: 'BTCUSDT',
        riskConfig: defaultRiskConfig,
      },
      { onExecutionEvent: (event) => events.push(event) },
    )
    const report = buildBacktestReport(result)
    await persistBacktestReplay({
      backtestId: 'bt-replay-1',
      candles,
      trades: report.trades,
      events,
      report,
      strategyName: 'Moving Average Cross',
      strategyVersion: 'v1',
      timeframe: '15M',
      strategyParams: strategy.params,
    })

    const loaded = await loadBacktestReplay('bt-replay-1')
    expect(loaded.available).toBe(true)
    if (!loaded.available) return
    expect(loaded.bundle.candles).toHaveLength(candles.length)
    expect(loaded.bundle.trades).toEqual(report.trades)
    expect(loaded.bundle.events.length).toBe(events.length)
    expect(loaded.bundle.equityCurve.at(-1)?.equity).toBe(report.summary.finalBalance)
  })

  it('falls back to detail archive candles when IndexedDB empty', async () => {
    const candles = makeCandles(30)
    const trade = makeTrade({
      entryTime: candles[5].time,
      exitTime: candles[10].time,
    })
    const report = buildBacktestReport({
      trades: [trade],
      equityCurve: candles.map((c) => ({ time: c.time, equity: 10_000, cash: 10_000 })),
      statistics: {
        totalTrades: 1,
        winningTrades: 1,
        losingTrades: 0,
        winRate: 1,
        netProfit: trade.pnl,
        grossProfit: trade.pnl,
        grossLoss: 0,
        maxDrawdown: 0,
        averageTrade: trade.pnl,
        finalBalance: 10_000 + trade.pnl,
      },
      config: {
        initialCapital: 10_000,
        commissionPercent: 0.1,
        positionSizePercent: 100,
        symbol: 'BTCUSDT',
        riskConfig: defaultRiskConfig,
      },
    })
    saveBacktestDetail(
      buildPersistedDetail({
        id: 'bt-detail-1',
        report,
        context: {
          strategyName: 'Moving Average Cross',
          strategyVersion: 'v1',
          timeframe: '15M',
          candles,
        },
      }),
    )

    const loaded = await loadBacktestReplay('bt-detail-1')
    expect(loaded.available).toBe(true)
    if (!loaded.available) return
    expect(loaded.source).toBe('detail-archive')
    expect(loaded.bundle.candles).toHaveLength(30)
  })
})

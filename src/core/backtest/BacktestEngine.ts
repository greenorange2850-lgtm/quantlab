import type { Candle } from '../../data/candles.js'
import type { Strategy } from '../strategy/Strategy.js'
import { SignalType } from '../signals/SignalType.js'
import type { Signal } from '../signals/Signal.js'
import { ExecutionEngine } from '../execution/execution-engine.js'
import { OrderManager } from '../execution/order-manager.js'
import type { ExecutionContext } from '../execution/execution-context.js'
import type { HistoricalFeed, HistoricalLoadParams } from '../market/historical-feed.js'
import { validateBacktestConfig, type BacktestConfig } from './BacktestConfig.js'
import type { BacktestResult } from './BacktestResult.js'
import { Portfolio } from './Portfolio.js'
import { computeStatistics } from './statistics.js'
import { buildOrderRequestFromSignal } from './order-sizing.js'
import { TradeDirection } from './Trade.js'
import type {
  BacktestExecutionEvent,
  PositionState,
} from './execution-events.js'

export interface BacktestRunOptions {
  /**
   * Optional sink for execution diagnostics.
   * Must not be used to alter fills, sizing, or trade outcomes.
   */
  onExecutionEvent?: (event: BacktestExecutionEvent) => void
}

function positionState(portfolio: Portfolio): PositionState {
  const position = portfolio.getPosition()
  if (!position) return 'flat'
  return position.direction === TradeDirection.LONG ? 'long' : 'short'
}

function rsiConfirmationFailed(reason: string | undefined): boolean | null {
  if (!reason) return null
  return /RSI did not confirm/i.test(reason)
}

export class BacktestEngine {
  private readonly executionEngine = new ExecutionEngine()
  private readonly orderManager = new OrderManager()
  private eventCounter = 0

  async runWithHistoricalFeed(
    feed: HistoricalFeed,
    loadParams: HistoricalLoadParams,
    strategy: Strategy,
    config: BacktestConfig,
    options?: BacktestRunOptions,
  ): Promise<BacktestResult> {
    if (!feed.getHistory(loadParams.symbol).length) {
      feed.subscribe({ symbol: loadParams.symbol, timeframe: loadParams.timeframe })
    }

    await feed.connect()
    const candles = await feed.loadHistorical(loadParams)
    await feed.disconnect()

    return this.run(candles, strategy, config, options)
  }

  run(
    candles: Candle[],
    strategy: Strategy,
    config: BacktestConfig,
    options?: BacktestRunOptions,
  ): BacktestResult {
    validateBacktestConfig(config)

    if (candles.length === 0) {
      throw new Error('candles must not be empty')
    }

    const portfolio = new Portfolio(config.initialCapital)
    const equityCurve: BacktestResult['equityCurve'] = []
    let pendingSignal: Signal | null = null
    this.eventCounter = 0

    const emit = (partial: Omit<BacktestExecutionEvent, 'id'>) => {
      options?.onExecutionEvent?.({
        id: `evt-${++this.eventCounter}`,
        ...partial,
      })
    }

    for (let index = 0; index < candles.length; index++) {
      const candle = candles[index]

      if (pendingSignal) {
        this.executeSignal(portfolio, pendingSignal, candle.open, candle.time, config, index, emit)
        pendingSignal = null
      }

      const history = candles.slice(0, index + 1)
      const signal = strategy.evaluate(history, config.symbol)
      const before = positionState(portfolio)

      emit({
        kind: 'signal_evaluated',
        candleIndex: index,
        candleTime: candle.time,
        signal: signal.signal,
        reason: signal.reason,
        stopLossPrice: signal.stopLossPrice ?? null,
        takeProfitPrice: null,
        positionBefore: before,
        positionAfter: before,
        skipReason: null,
        tradeId: null,
        fillPrice: null,
        fillQuantity: null,
        commission: null,
        pnl: null,
        rsiConfirmationFailed: rsiConfirmationFailed(signal.reason),
      })

      if (signal.signal !== SignalType.HOLD && index < candles.length - 1) {
        pendingSignal = signal
        emit({
          kind: 'signal_queued',
          candleIndex: index,
          candleTime: candle.time,
          signal: signal.signal,
          reason: signal.reason,
          stopLossPrice: signal.stopLossPrice ?? null,
          takeProfitPrice: null,
          positionBefore: before,
          positionAfter: before,
          skipReason: null,
          tradeId: null,
          fillPrice: null,
          fillQuantity: null,
          commission: null,
          pnl: null,
          rsiConfirmationFailed: rsiConfirmationFailed(signal.reason),
        })
      }

      equityCurve.push({
        time: candle.time,
        equity: portfolio.getEquity(candle.close),
        cash: portfolio.getCash(),
      })
    }

    return {
      trades: portfolio.getClosedTrades(),
      equityCurve,
      statistics: computeStatistics(
        portfolio.getClosedTrades(),
        equityCurve,
        config.initialCapital,
      ),
      config,
    }
  }

  getOrderManager(): OrderManager {
    return this.orderManager
  }

  private executeSignal(
    portfolio: Portfolio,
    signal: Signal,
    price: number,
    time: number,
    config: BacktestConfig,
    candleIndex: number,
    emit: (partial: Omit<BacktestExecutionEvent, 'id'>) => void,
  ): void {
    const positionBefore = positionState(portfolio)
    const orderRequest = buildOrderRequestFromSignal(portfolio, signal, price, config)
    if (!orderRequest) {
      emit({
        kind: 'order_skipped',
        candleIndex,
        candleTime: time,
        signal: signal.signal,
        reason: signal.reason,
        stopLossPrice: signal.stopLossPrice ?? null,
        takeProfitPrice: null,
        positionBefore,
        positionAfter: positionBefore,
        skipReason:
          positionBefore !== 'flat'
            ? 'Position already open in a direction that blocked this order'
            : 'Order sizing returned null (risk / capital / direction gate)',
        tradeId: null,
        fillPrice: null,
        fillQuantity: null,
        commission: null,
        pnl: null,
        rsiConfirmationFailed: null,
      })
      return
    }

    const context: ExecutionContext = {
      symbol: config.symbol,
      marketPrice: price,
      timestamp: time,
      commissionPercent: config.commissionPercent,
      slippagePercent: config.slippagePercent ?? 0,
    }

    const result = this.executionEngine.executeOrder(orderRequest, context)
    this.orderManager.recordExecution(orderRequest, result, time)

    if (!result.accepted || result.fills.length === 0) {
      emit({
        kind: 'order_skipped',
        candleIndex,
        candleTime: time,
        signal: signal.signal,
        reason: signal.reason,
        stopLossPrice: signal.stopLossPrice ?? null,
        takeProfitPrice: null,
        positionBefore,
        positionAfter: positionBefore,
        skipReason: result.reason ?? 'Order rejected or produced no fills',
        tradeId: null,
        fillPrice: null,
        fillQuantity: null,
        commission: null,
        pnl: null,
        rsiConfirmationFailed: null,
      })
      return
    }

    for (const fill of result.fills) {
      const closed = portfolio.applyFill(fill)
      const positionAfter = positionState(portfolio)

      emit({
        kind: 'fill_applied',
        candleIndex,
        candleTime: time,
        signal: signal.signal,
        reason: signal.reason,
        stopLossPrice: signal.stopLossPrice ?? null,
        takeProfitPrice: null,
        positionBefore,
        positionAfter,
        skipReason: null,
        tradeId: closed?.id ?? null,
        fillPrice: fill.fillPrice,
        fillQuantity: fill.fillQuantity,
        commission: fill.commission,
        pnl: closed?.pnl ?? null,
        rsiConfirmationFailed: null,
      })

      if (closed) {
        emit({
          kind: 'trade_closed',
          candleIndex,
          candleTime: time,
          signal: signal.signal,
          reason: signal.reason,
          stopLossPrice: signal.stopLossPrice ?? null,
          takeProfitPrice: null,
          positionBefore,
          positionAfter,
          skipReason: null,
          tradeId: closed.id,
          fillPrice: fill.fillPrice,
          fillQuantity: fill.fillQuantity,
          commission: closed.commission,
          pnl: closed.pnl,
          rsiConfirmationFailed: null,
        })
      } else if (positionAfter !== 'flat') {
        emit({
          kind: 'trade_opened',
          candleIndex,
          candleTime: time,
          signal: signal.signal,
          reason: signal.reason,
          stopLossPrice: signal.stopLossPrice ?? null,
          takeProfitPrice: null,
          positionBefore,
          positionAfter,
          skipReason: null,
          tradeId: null,
          fillPrice: fill.fillPrice,
          fillQuantity: fill.fillQuantity,
          commission: fill.commission,
          pnl: null,
          rsiConfirmationFailed: null,
        })
      }
    }
  }
}

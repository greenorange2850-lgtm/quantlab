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

export class BacktestEngine {
  private readonly executionEngine = new ExecutionEngine()
  private readonly orderManager = new OrderManager()

  async runWithHistoricalFeed(
    feed: HistoricalFeed,
    loadParams: HistoricalLoadParams,
    strategy: Strategy,
    config: BacktestConfig,
  ): Promise<BacktestResult> {
    if (!feed.getHistory(loadParams.symbol).length) {
      feed.subscribe({ symbol: loadParams.symbol, timeframe: loadParams.timeframe })
    }

    await feed.connect()
    const candles = await feed.loadHistorical(loadParams)
    await feed.disconnect()

    return this.run(candles, strategy, config)
  }

  run(candles: Candle[], strategy: Strategy, config: BacktestConfig): BacktestResult {
    validateBacktestConfig(config)

    if (candles.length === 0) {
      throw new Error('candles must not be empty')
    }

    const portfolio = new Portfolio(config.initialCapital)
    const equityCurve: BacktestResult['equityCurve'] = []
    let pendingSignal: Signal | null = null

    for (let index = 0; index < candles.length; index++) {
      const candle = candles[index]

      if (pendingSignal) {
        this.executeSignal(portfolio, pendingSignal, candle.open, candle.time, config)
        pendingSignal = null
      }

      const history = candles.slice(0, index + 1)
      const signal = strategy.evaluate(history, config.symbol)

      if (signal.signal !== SignalType.HOLD && index < candles.length - 1) {
        pendingSignal = signal
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
  ): void {
    const orderRequest = buildOrderRequestFromSignal(portfolio, signal, price, config)
    if (!orderRequest) {
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
      return
    }

    for (const fill of result.fills) {
      portfolio.applyFill(fill)
    }
  }
}

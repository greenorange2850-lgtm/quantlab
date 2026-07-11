import type { Candle } from '../../data/candles.js'
import type { Strategy } from '../strategy/Strategy.js'
import { SignalType } from '../signals/SignalType.js'
import type { Signal } from '../signals/Signal.js'
import { TradeDirection } from './Trade.js'
import { validateBacktestConfig, type BacktestConfig } from './BacktestConfig.js'
import type { BacktestResult } from './BacktestResult.js'
import { Portfolio } from './Portfolio.js'
import { computeStatistics } from './statistics.js'

export class BacktestEngine {
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

  private executeSignal(
    portfolio: Portfolio,
    signal: Signal,
    price: number,
    time: number,
    config: BacktestConfig,
  ): void {
    const position = portfolio.getPosition()

    if (signal.signal === SignalType.BUY) {
      if (position?.direction === TradeDirection.SHORT) {
        portfolio.close(config.symbol, price, time, config.commissionPercent)
        return
      }

      if (!position) {
        portfolio.openLong(
          config.symbol,
          price,
          time,
          config.commissionPercent,
          config.positionSizePercent,
        )
      }
      return
    }

    if (signal.signal === SignalType.SELL) {
      if (position?.direction === TradeDirection.LONG) {
        portfolio.close(config.symbol, price, time, config.commissionPercent)
        return
      }

      if (!position) {
        portfolio.openShort(
          config.symbol,
          price,
          time,
          config.commissionPercent,
          config.positionSizePercent,
        )
      }
    }
  }
}

import type { Candle } from '../../data/candles.js'
import { BinanceProvider } from '../../data/providers/BinanceProvider.js'
import { buildBacktestReport } from '../analytics/report-builder.js'
import type { BacktestReport } from '../analytics/types.js'
import { BacktestEngine } from '../backtest/BacktestEngine.js'
import { MarketDataEngine } from '../market/market-data-engine.js'
import { defaultRiskConfig } from '../risk/config.js'
import { validateRiskConfig } from '../risk/validators.js'
import {
  DEFAULT_MA_CROSS_PARAMS,
  MovingAverageCrossStrategy,
  type MovingAverageCrossParams,
} from '../strategy/MovingAverageCrossStrategy.js'
import {
  buildDashboardViewModel,
  createBacktestSummaryFromReport,
  type DashboardViewModelContext,
} from './dashboard-view-model.js'
import type { BacktestSummary } from '@trading-os/shared'

export interface RunBacktestPipelineParams {
  symbol: string
  interval: string
  limit: number
  initialCapital: number
  commissionPercent: number
  positionSizePercent: number
  strategyName?: string
  strategyVersion?: string
  /** Prefetched canonical candles (TanStack Query). When set, mock data is never used. */
  candles?: Candle[]
  /** Optional MA Cross parameters — defaults preserve original strategy behavior. */
  strategyParams?: Partial<MovingAverageCrossParams>
  /**
   * @deprecated Prefer passing live `candles`. Ignored when `candles` is provided.
   * Retained only so older call sites compiling against the type do not break.
   */
  seed?: number
}

export interface RunBacktestPipelineResult {
  report: BacktestReport
  candles: Candle[]
  context: DashboardViewModelContext
  backtestId: string
  strategyParams: MovingAverageCrossParams
}

export const defaultBacktestPipelineParams: RunBacktestPipelineParams = {
  symbol: 'BTCUSDT',
  interval: '1h',
  limit: 500,
  initialCapital: 10_000,
  commissionPercent: 0.1,
  positionSizePercent: 100,
  strategyName: 'Moving Average Cross',
  strategyVersion: 'v1.0.0',
  strategyParams: { ...DEFAULT_MA_CROSS_PARAMS },
}

function createBacktestId(): string {
  return `bt-${Date.now()}`
}

/**
 * Strategy → Backtest Engine → Risk validation → Analytics
 *
 * Candle source (never silently mocks when live data is expected):
 * 1. `params.candles` if provided (UI / TanStack Query path)
 * 2. otherwise live BinanceProvider via HistoricalFeed
 */
export async function runBacktestPipeline(
  params: RunBacktestPipelineParams = defaultBacktestPipelineParams,
): Promise<RunBacktestPipelineResult> {
  validateRiskConfig(defaultRiskConfig)

  const strategyParams: MovingAverageCrossParams = {
    ...DEFAULT_MA_CROSS_PARAMS,
    ...params.strategyParams,
  }
  const strategy = new MovingAverageCrossStrategy(strategyParams)
  const backtestEngine = new BacktestEngine()
  const backtestConfig = {
    initialCapital: params.initialCapital,
    commissionPercent: params.commissionPercent,
    positionSizePercent: params.positionSizePercent,
    symbol: params.symbol,
    riskConfig: defaultRiskConfig,
  }

  let candles: Candle[]
  let result

  if (params.candles && params.candles.length > 0) {
    candles = params.candles
    result = backtestEngine.run(candles, strategy, backtestConfig)
  } else {
    const marketDataEngine = new MarketDataEngine()
    const historicalFeed = marketDataEngine.createHistoricalFeed(new BinanceProvider())

    result = await backtestEngine.runWithHistoricalFeed(
      historicalFeed,
      {
        symbol: params.symbol,
        timeframe: params.interval,
        limit: params.limit,
      },
      strategy,
      backtestConfig,
    )

    candles = [...historicalFeed.getHistory(params.symbol)]
  }

  const report = buildBacktestReport(result)
  const context: DashboardViewModelContext = {
    strategyName: params.strategyName ?? strategy.name,
    strategyVersion: params.strategyVersion ?? 'v1.0.0',
    timeframe: params.interval.toUpperCase(),
    candles,
  }

  return {
    report,
    candles,
    context,
    backtestId: createBacktestId(),
    strategyParams,
  }
}

export function mapPipelineResultToDashboard(
  pipelineResult: RunBacktestPipelineResult,
  recentBacktests: BacktestSummary[] = [],
) {
  const summary = createBacktestSummaryFromReport(
    pipelineResult.report,
    pipelineResult.context,
    pipelineResult.backtestId,
  )

  return buildDashboardViewModel(
    pipelineResult.report,
    pipelineResult.context,
    [summary, ...recentBacktests.filter((item) => item.id !== summary.id)].slice(0, 12),
  )
}

import type { BacktestSummary } from '@trading-os/shared'
import type { CreateBacktestRequest } from '@trading-os/shared'
import type { Candle } from '../../data/candles.js'
import { MockMarketDataProvider } from '../../data/providers/MockMarketDataProvider.js'
import { buildBacktestReport } from '../analytics/report-builder.js'
import type { BacktestReport } from '../analytics/types.js'
import { BacktestEngine } from '../backtest/BacktestEngine.js'
import { MarketDataEngine } from '../market/market-data-engine.js'
import { defaultRiskConfig } from '../risk/config.js'
import { validateRiskConfig } from '../risk/validators.js'
import { MovingAverageCrossStrategy } from '../strategy/MovingAverageCrossStrategy.js'
import {
  buildDashboardViewModel,
  createBacktestSummaryFromReport,
  type DashboardViewModelContext,
} from './dashboard-view-model.js'

export interface RunBacktestPipelineParams {
  symbol: string
  interval: string
  limit: number
  initialCapital: number
  commissionPercent: number
  positionSizePercent: number
  strategyName?: string
  strategyVersion?: string
  seed?: number
}

export interface RunBacktestPipelineResult {
  report: BacktestReport
  candles: Candle[]
  context: DashboardViewModelContext
  backtestId: string
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
  seed: 42,
}

function createBacktestId(): string {
  return `bt-${Date.now()}`
}

function isoDate(time: number): string {
  return new Date(time).toISOString().split('T')[0]
}

/**
 * Strategy → Backtest Engine → Risk validation → Analytics
 */
export async function runBacktestPipeline(
  params: RunBacktestPipelineParams = defaultBacktestPipelineParams,
): Promise<RunBacktestPipelineResult> {
  validateRiskConfig(defaultRiskConfig)

  const marketDataEngine = new MarketDataEngine()
  const historicalFeed = marketDataEngine.createHistoricalFeed(
    new MockMarketDataProvider({ seed: params.seed ?? 42 }),
  )

  const strategy = new MovingAverageCrossStrategy()
  const backtestEngine = new BacktestEngine()
  const backtestConfig = {
    initialCapital: params.initialCapital,
    commissionPercent: params.commissionPercent,
    positionSizePercent: params.positionSizePercent,
    symbol: params.symbol,
    riskConfig: defaultRiskConfig,
  }

  const result = await backtestEngine.runWithHistoricalFeed(
    historicalFeed,
    {
      symbol: params.symbol,
      timeframe: params.interval,
      limit: params.limit,
    },
    strategy,
    backtestConfig,
  )

  const candles = [...historicalFeed.getHistory(params.symbol)]
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
  }
}

/** Prepend a summary and keep the dashboard history list capped. */
export function mergeRecentBacktests(
  next: BacktestSummary,
  existing: BacktestSummary[] = [],
  limit = 12,
): BacktestSummary[] {
  return [next, ...existing.filter((item) => item.id !== next.id)].slice(0, limit)
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
    mergeRecentBacktests(summary, recentBacktests),
  )
}

/** Build the POST /backtests payload from a completed client pipeline run. */
export function buildCreateBacktestRequest(
  pipelineResult: RunBacktestPipelineResult,
): CreateBacktestRequest {
  const summary = createBacktestSummaryFromReport(
    pipelineResult.report,
    pipelineResult.context,
    pipelineResult.backtestId,
  )
  const first = pipelineResult.report.equityCurve[0]?.time
  const last = pipelineResult.report.equityCurve.at(-1)?.time

  return {
    id: summary.id,
    version: summary.version,
    market: summary.market,
    timeframe: summary.timeframe,
    trades: summary.trades,
    winRate: summary.winRate,
    profitFactor: summary.profitFactor,
    maxDrawdown: summary.maxDrawdown,
    netProfit: summary.netProfit,
    status: summary.status,
    date: summary.date,
    strategyName: pipelineResult.context.strategyName,
    startDate: first !== undefined ? isoDate(first) : summary.date,
    endDate: last !== undefined ? isoDate(last) : summary.date,
    initialCapital: pipelineResult.report.config.initialCapital,
  }
}

import { describe, expect, it } from 'vitest'
import type { BacktestSummary } from '@trading-os/shared'
import { buildBacktestReport } from '../../analytics/report-builder.js'
import type { BacktestResult } from '../../backtest/BacktestResult.js'
import {
  buildCreateBacktestRequest,
  mergeRecentBacktests,
  type RunBacktestPipelineResult,
} from '../run-backtest-pipeline.js'

const sampleResult: BacktestResult = {
  trades: [
    {
      id: 'trade-1',
      symbol: 'BTCUSDT',
      entryTime: Date.parse('2024-01-02T00:00:00.000Z'),
      exitTime: Date.parse('2024-01-03T00:00:00.000Z'),
      entryPrice: 100,
      exitPrice: 110,
      quantity: 1,
      direction: 'LONG',
      pnl: 10,
      commission: 0.1,
      duration: 86_400_000,
    },
  ],
  equityCurve: [
    { time: Date.parse('2024-01-01T00:00:00.000Z'), equity: 10_000, cash: 10_000 },
    { time: Date.parse('2024-01-10T00:00:00.000Z'), equity: 10_010, cash: 10_010 },
  ],
  statistics: {
    totalTrades: 1,
    winningTrades: 1,
    losingTrades: 0,
    winRate: 1,
    netProfit: 10,
    grossProfit: 10,
    grossLoss: 0,
    maxDrawdown: 0,
    averageTrade: 10,
    finalBalance: 10_010,
  },
  config: {
    initialCapital: 10_000,
    commissionPercent: 0.1,
    positionSizePercent: 100,
    symbol: 'BTCUSDT',
  },
}

function samplePipeline(): RunBacktestPipelineResult {
  return {
    report: buildBacktestReport(sampleResult),
    candles: [],
    context: {
      strategyName: 'Moving Average Cross',
      strategyVersion: 'v1.0.0',
      timeframe: '1H',
    },
    backtestId: 'bt-test-1',
  }
}

describe('mergeRecentBacktests', () => {
  it('prepends and dedupes by id', () => {
    const existing: BacktestSummary[] = [
      {
        id: 'bt-old',
        version: 'v1',
        date: '2024-01-01',
        market: 'ETHUSDT',
        timeframe: 'H1',
        trades: 1,
        winRate: 50,
        profitFactor: 1,
        maxDrawdown: -5,
        netProfit: 10,
        status: 'completed',
      },
    ]
    const next: BacktestSummary = {
      id: 'bt-new',
      version: 'v1.0.0',
      date: '2024-01-10',
      market: 'BTCUSDT',
      timeframe: 'H1',
      trades: 4,
      winRate: 50,
      profitFactor: 2.5,
      maxDrawdown: -5,
      netProfit: 120,
      status: 'completed',
    }

    expect(mergeRecentBacktests(next, existing).map((item) => item.id)).toEqual(['bt-new', 'bt-old'])
  })
})

describe('buildCreateBacktestRequest', () => {
  it('maps pipeline result into POST /backtests payload', () => {
    const request = buildCreateBacktestRequest(samplePipeline())
    expect(request.id).toBe('bt-test-1')
    expect(request.market).toBe('BTCUSDT')
    expect(request.strategyName).toBe('Moving Average Cross')
    expect(request.trades).toBe(1)
    expect(request.startDate).toBe('2024-01-01')
    expect(request.endDate).toBe('2024-01-10')
    expect(request.initialCapital).toBe(10_000)
    expect(request.equityCurve?.length).toBe(2)
    expect(request.equityCurve?.[0]?.date).toBe('2024-01-01')
  })
})

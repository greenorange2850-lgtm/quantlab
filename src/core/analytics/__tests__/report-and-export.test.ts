import { describe, expect, it } from 'vitest'
import type { BacktestResult } from '../../backtest/BacktestResult.js'
import { buildBacktestReport } from '../report-builder.js'
import { exportBacktestReportJson, exportBacktestResultJson } from '../export-json.js'
import {
  exportEquityCsv,
  exportReportStatisticsCsv,
  exportStatisticsCsv,
  exportTradesCsv,
} from '../export-csv.js'

const sampleResult: BacktestResult = {
  config: {
    initialCapital: 10_000,
    commissionPercent: 0.1,
    positionSizePercent: 100,
    symbol: 'BTCUSDT',
  },
  trades: [
    {
      id: 'trade-1',
      symbol: 'BTCUSDT',
      entryTime: 1,
      exitTime: 2,
      entryPrice: 100,
      exitPrice: 110,
      quantity: 1,
      direction: 'LONG',
      pnl: 10,
      commission: 0.2,
      duration: 1,
    },
  ],
  equityCurve: [
    { time: 1, equity: 10_000, cash: 10_000 },
    { time: 2, equity: 10_010, cash: 10_010 },
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
}

describe('report-builder', () => {
  it('builds a structured analytics report', () => {
    const report = buildBacktestReport(sampleResult)

    expect(report.summary.totalTrades).toBe(1)
    expect(report.summary.netProfit).toBe(10)
    expect(report.equityCurve).toHaveLength(2)
    expect(report.topTrades).toHaveLength(1)
    expect(report.tradeAnalysis.profitFactor).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('export-json', () => {
  it('exports backtest result and report as json', () => {
    const report = buildBacktestReport(sampleResult)
    const resultJson = JSON.parse(exportBacktestResultJson(sampleResult)) as BacktestResult
    const reportJson = JSON.parse(exportBacktestReportJson(report)) as { summary: { totalTrades: number } }

    expect(resultJson.trades).toHaveLength(1)
    expect(reportJson.summary.totalTrades).toBe(1)
  })
})

describe('export-csv', () => {
  it('exports trades csv', () => {
    const csv = exportTradesCsv(sampleResult.trades)
    expect(csv.split('\n')).toHaveLength(2)
    expect(csv).toContain('trade-1')
  })

  it('exports equity csv', () => {
    const report = buildBacktestReport(sampleResult)
    const csv = exportEquityCsv(report.equityCurve)
    expect(csv).toContain('drawdown')
    expect(csv.split('\n')).toHaveLength(3)
  })

  it('exports statistics csv', () => {
    const csv = exportStatisticsCsv(sampleResult.statistics)
    expect(csv).toContain('netProfit')
  })

  it('exports report summary csv', () => {
    const report = buildBacktestReport(sampleResult)
    const csv = exportReportStatisticsCsv(report)
    expect(csv).toContain('profitFactor')
  })

  it('escapes csv values with commas', () => {
    const csv = exportTradesCsv([
      {
        ...sampleResult.trades[0],
        id: 'trade,1',
      },
    ])

    expect(csv).toContain('"trade,1"')
  })
})

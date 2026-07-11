import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { BinanceProvider } from '../data/providers/BinanceProvider.js'
import { MovingAverageCrossStrategy } from '../core/strategy/MovingAverageCrossStrategy.js'
import { BacktestEngine } from '../core/backtest/BacktestEngine.js'
import {
  buildBacktestReport,
  exportBacktestReportJson,
  exportEquityCsv,
  exportTradesCsv,
} from '../core/analytics/index.js'

const SYMBOL = 'BTCUSDT'
const INTERVAL = '1h'
const LIMIT = 500
const OUTPUT_DIR = process.cwd()

function formatMoney(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`
}

function formatProfitFactor(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : 'Infinity'
}

async function main(): Promise<void> {
  const provider = new BinanceProvider()
  const strategy = new MovingAverageCrossStrategy()
  const engine = new BacktestEngine()

  console.log(`Fetching ${LIMIT} ${INTERVAL} candles for ${SYMBOL}...`)

  const candles = await provider.getCandles({ symbol: SYMBOL, interval: INTERVAL, limit: LIMIT })
  const result = engine.run(candles, strategy, {
    initialCapital: 10_000,
    commissionPercent: 0.1,
    positionSizePercent: 100,
    symbol: SYMBOL,
  })

  const report = buildBacktestReport(result)
  const { summary } = report

  console.log('')
  console.log('==========================================')
  console.log('BACKTEST REPORT')
  console.log('==========================================')
  console.log(`Trades           : ${summary.totalTrades}`)
  console.log(`Win Rate         : ${formatPercent(summary.winRate)}`)
  console.log(`Net Profit       : ${formatMoney(summary.netProfit)}`)
  console.log(`Profit Factor    : ${formatProfitFactor(summary.profitFactor)}`)
  console.log(`Expectancy       : ${formatMoney(summary.expectancy)}`)
  console.log(`Average Win      : ${formatMoney(summary.averageWin)}`)
  console.log(`Average Loss     : ${formatMoney(summary.averageLoss)}`)
  console.log(`Max Drawdown     : ${formatPercent(summary.maxDrawdown)}`)
  console.log(`Largest Winner   : ${formatMoney(summary.largestWinner)}`)
  console.log(`Largest Loser    : ${formatMoney(summary.largestLoser)}`)
  console.log('==========================================')
  console.log('Top 5 Trades')
  console.log('==========================================')

  for (const [index, trade] of report.topTrades.entries()) {
    console.log(
      `${index + 1}. ${trade.direction} ${trade.symbol} | PnL ${formatMoney(trade.pnl)} | ${trade.id}`,
    )
  }

  const reportJsonPath = join(OUTPUT_DIR, 'backtest-report.json')
  const tradesCsvPath = join(OUTPUT_DIR, 'trades.csv')
  const equityCsvPath = join(OUTPUT_DIR, 'equity.csv')

  await Promise.all([
    writeFile(reportJsonPath, exportBacktestReportJson(report), 'utf8'),
    writeFile(tradesCsvPath, exportTradesCsv(result.trades), 'utf8'),
    writeFile(equityCsvPath, exportEquityCsv(report.equityCurve), 'utf8'),
  ])

  console.log('==========================================')
  console.log(`Exported JSON : ${reportJsonPath}`)
  console.log(`Exported CSV  : ${tradesCsvPath}`)
  console.log(`Exported CSV  : ${equityCsvPath}`)
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Analytics demo failed: ${message}`)
  process.exitCode = 1
})

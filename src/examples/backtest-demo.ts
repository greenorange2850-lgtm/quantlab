import { BinanceProvider } from '../data/providers/BinanceProvider.js'
import { MovingAverageCrossStrategy } from '../core/strategy/MovingAverageCrossStrategy.js'
import { BacktestEngine } from '../core/backtest/BacktestEngine.js'

const SYMBOL = 'BTCUSDT'
const INTERVAL = '1h'
const LIMIT = 500

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

  const { statistics: stats } = result

  console.log('')
  console.log('======================================')
  console.log('BACKTEST REPORT')
  console.log('======================================')
  console.log(`Strategy         : ${strategy.name}`)
  console.log(`Symbol           : ${SYMBOL}`)
  console.log(`Candles          : ${candles.length}`)
  console.log(`Trades           : ${stats.totalTrades}`)
  console.log(`Win Rate         : ${formatPercent(stats.winRate)}`)
  console.log(`Net Profit       : ${formatMoney(stats.netProfit)}`)
  console.log(`Max Drawdown     : ${formatPercent(stats.maxDrawdown)}`)
  console.log(`Final Balance    : ${formatMoney(stats.finalBalance)}`)
  console.log('======================================')
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Backtest demo failed: ${message}`)
  process.exitCode = 1
})

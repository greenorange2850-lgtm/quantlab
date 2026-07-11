import { BinanceProvider } from '../data/providers/BinanceProvider.js'
import { MovingAverageCrossStrategy } from '../core/strategy/MovingAverageCrossStrategy.js'

const SYMBOL = 'BTCUSDT'
const INTERVAL = '1h'
const LIMIT = 100

function formatNumber(value: number, digits = 2): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

async function main(): Promise<void> {
  const provider = new BinanceProvider()
  const strategy = new MovingAverageCrossStrategy()

  console.log(`Fetching ${LIMIT} ${INTERVAL} candles for ${SYMBOL}...`)

  const candles = await provider.getCandles({ symbol: SYMBOL, interval: INTERVAL, limit: LIMIT })
  const signal = strategy.evaluate(candles, SYMBOL)
  const indicators = strategy.getIndicators(candles)

  console.log('')
  console.log('─'.repeat(48))
  console.log(`  ${SYMBOL} Strategy Demo`)
  console.log('─'.repeat(48))
  console.log(`  Strategy       : ${strategy.name}`)
  console.log(`  Candles loaded : ${candles.length}`)
  console.log(`  Current Signal : ${signal.signal}`)
  console.log(`  Confidence     : ${(signal.confidence * 100).toFixed(1)}%`)
  if (indicators) {
    console.log(`  EMA20          : ${formatNumber(indicators.ema20)}`)
    console.log(`  EMA50          : ${formatNumber(indicators.ema50)}`)
    console.log(`  RSI            : ${formatNumber(indicators.rsi, 4)}`)
  } else {
    console.log('  EMA20          : n/a')
    console.log('  EMA50          : n/a')
    console.log('  RSI            : n/a')
  }
  console.log(`  Reason         : ${signal.reason}`)
  console.log('─'.repeat(48))
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Strategy demo failed: ${message}`)
  process.exitCode = 1
})

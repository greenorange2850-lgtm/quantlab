import { fetchKlines } from '../data/binance.js'
import { extractClosePrices } from '../data/candles.js'
import { calculateEMA } from '../core/indicators/ema.js'
import { calculateRSI } from '../core/indicators/rsi.js'

const SYMBOL = 'BTCUSDT'
const INTERVAL = '1h'
const LIMIT = 100
const EMA_PERIOD = 20
const RSI_PERIOD = 14

function formatPrice(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatIndicator(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })
}

async function main(): Promise<void> {
  console.log(`Fetching ${LIMIT} ${INTERVAL} candles for ${SYMBOL}...`)

  const candles = await fetchKlines(SYMBOL, INTERVAL, LIMIT)
  const closes = extractClosePrices(candles)
  const ema = calculateEMA(closes, EMA_PERIOD)
  const rsi = calculateRSI(closes, RSI_PERIOD)

  const latestClose = closes[closes.length - 1]
  const latestEma = ema[ema.length - 1]
  const latestRsi = rsi[rsi.length - 1]

  console.log('')
  console.log('─'.repeat(40))
  console.log(`  ${SYMBOL} Indicator Demo`)
  console.log('─'.repeat(40))
  console.log(`  Candles loaded : ${candles.length}`)
  console.log(`  Latest Close   : ${formatPrice(latestClose)}`)
  console.log(`  EMA(${EMA_PERIOD})         : ${formatIndicator(latestEma)}`)
  console.log(`  RSI(${RSI_PERIOD})         : ${formatIndicator(latestRsi)}`)
  console.log('─'.repeat(40))
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Demo failed: ${message}`)
  process.exitCode = 1
})

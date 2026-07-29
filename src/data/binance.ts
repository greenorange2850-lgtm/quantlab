import { BinanceProvider } from './providers/BinanceProvider.js'

export {
  BinanceProvider,
  BINANCE_BASE_URL,
  BINANCE_MARKET_DATA_BASE_URL,
  parseBinanceKlinesResponse,
  type KlineInterval,
} from './providers/BinanceProvider.js'

const defaultProvider = new BinanceProvider()

/** @deprecated Use BinanceProvider or MarketDataProvider abstraction */
export async function fetchKlines(
  symbol: string,
  interval: string,
  limit: number,
): Promise<import('./candles.js').Candle[]> {
  return defaultProvider.getCandles({ symbol, interval, limit })
}

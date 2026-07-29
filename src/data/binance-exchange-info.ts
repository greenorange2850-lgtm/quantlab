/** Quote assets exposed in the pair selector (initial set). */
export const BINANCE_QUOTE_ASSETS = ['USDT', 'USDC', 'BTC', 'ETH'] as const

export type BinanceQuoteAsset = (typeof BINANCE_QUOTE_ASSETS)[number]

export const DEFAULT_BINANCE_QUOTE: BinanceQuoteAsset = 'USDT'

/** UI timeframe options for Strategy / Backtest Lab. */
export const BACKTEST_TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'] as const

export type BacktestTimeframe = (typeof BACKTEST_TIMEFRAMES)[number]

export interface BinanceTradingPair {
  symbol: string
  baseAsset: string
  quoteAsset: BinanceQuoteAsset
  /** Display label like "BTC / USDT" */
  label: string
}

export interface BinanceExchangeSymbolRaw {
  symbol?: unknown
  status?: unknown
  baseAsset?: unknown
  quoteAsset?: unknown
  isSpotTradingAllowed?: unknown
  permissions?: unknown
}

export interface BinanceExchangeInfoRaw {
  symbols?: unknown
}

function isQuoteAsset(value: string): value is BinanceQuoteAsset {
  return (BINANCE_QUOTE_ASSETS as readonly string[]).includes(value)
}

/**
 * Maps Binance GET /api/v3/exchangeInfo into tradable spot pairs.
 * Keeps only status=TRADING, spot-allowed, and allowed quote assets.
 */
export function mapExchangeInfoToTradingPairs(raw: unknown): BinanceTradingPair[] {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid Binance exchangeInfo: expected an object')
  }

  const symbols = (raw as BinanceExchangeInfoRaw).symbols
  if (!Array.isArray(symbols)) {
    throw new Error('Invalid Binance exchangeInfo: expected symbols array')
  }

  const pairs: BinanceTradingPair[] = []

  for (const entry of symbols) {
    if (!entry || typeof entry !== 'object') continue
    const symbol = entry as BinanceExchangeSymbolRaw

    if (symbol.status !== 'TRADING') continue
    if (symbol.isSpotTradingAllowed !== true) {
      // Some payloads omit the flag but include SPOT in permissions.
      const permissions = Array.isArray(symbol.permissions)
        ? symbol.permissions.map(String)
        : []
      if (!permissions.includes('SPOT')) continue
    }

    const baseAsset = typeof symbol.baseAsset === 'string' ? symbol.baseAsset : ''
    const quoteAsset = typeof symbol.quoteAsset === 'string' ? symbol.quoteAsset : ''
    const symbolCode = typeof symbol.symbol === 'string' ? symbol.symbol : ''

    if (!baseAsset || !quoteAsset || !symbolCode) continue
    if (!isQuoteAsset(quoteAsset)) continue

    pairs.push({
      symbol: symbolCode.toUpperCase(),
      baseAsset: baseAsset.toUpperCase(),
      quoteAsset,
      label: `${baseAsset.toUpperCase()} / ${quoteAsset}`,
    })
  }

  return pairs.sort((a, b) => a.symbol.localeCompare(b.symbol))
}

export function filterTradingPairs(
  pairs: BinanceTradingPair[],
  options: { quoteAsset: BinanceQuoteAsset; search?: string },
): BinanceTradingPair[] {
  const query = options.search?.trim().toUpperCase() ?? ''

  return pairs.filter((pair) => {
    if (pair.quoteAsset !== options.quoteAsset) return false
    if (!query) return true
    return (
      pair.symbol.includes(query) ||
      pair.baseAsset.includes(query) ||
      pair.quoteAsset.includes(query) ||
      pair.label.replace(/\s/g, '').includes(query.replace(/\s/g, ''))
    )
  })
}

export type SymbolSelectViewState = 'loading' | 'error' | 'empty' | 'ready'

export function getSymbolSelectViewState(input: {
  isLoading: boolean
  isError: boolean
  filteredCount: number
}): SymbolSelectViewState {
  if (input.isLoading) return 'loading'
  if (input.isError) return 'error'
  if (input.filteredCount === 0) return 'empty'
  return 'ready'
}

export async function fetchBinanceExchangeInfo(
  baseUrl: string,
  signal?: AbortSignal,
): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(`${baseUrl}/api/v3/exchangeInfo`, { signal })
  } catch (error) {
    if (signal?.aborted) throw error
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Binance exchangeInfo request failed: ${message}`)
  }

  if (!response.ok) {
    throw new Error(`Binance exchangeInfo error: ${response.status} ${response.statusText}`)
  }

  try {
    return await response.json()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Binance exchangeInfo returned invalid JSON: ${message}`)
  }
}

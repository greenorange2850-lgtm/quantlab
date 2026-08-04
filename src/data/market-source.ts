/**
 * Shared market-source selection for Optimizer + Strategy Lab.
 * Both surfaces must use identical providers.
 */

export type MarketSourceKind = 'binance' | 'local'

export interface MarketSourceSelection {
  kind: MarketSourceKind
  /** Required when kind === 'local' */
  datasetId: string | null
}

export const DEFAULT_MARKET_SOURCE: MarketSourceSelection = {
  kind: 'binance',
  datasetId: null,
}

export const MARKET_SOURCE_OPTIONS: {
  id: MarketSourceKind
  label: string
  description: string
}[] = [
  {
    id: 'binance',
    label: 'Binance Live',
    description: 'Fetch candles from Binance public market data',
  },
  {
    id: 'local',
    label: 'Local Dataset',
    description: 'Reuse a CSV dataset from the Dataset Library',
  },
]

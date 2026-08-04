import { useBinanceKlines } from '@/api/queries/binance-market'
import { useLocalDatasetCandles } from '@/api/queries/datasets'
import type { MarketSourceKind } from '@/data/market-source'
import type { CandleInterval } from '@/data/providers/MarketDataProvider'

/**
 * Unified candle loader for Optimizer + Strategy Lab.
 * Dispatches to BinanceProvider or LocalDatasetProvider — engines stay unchanged.
 */
export function useResearchCandles(input: {
  sourceKind: MarketSourceKind
  datasetId: string | null
  symbol: string
  interval: CandleInterval | string
  startTime: number | null
  endTime: number | null
}) {
  const binanceQuery = useBinanceKlines(
    input.sourceKind === 'binance' ? input.symbol : null,
    input.sourceKind === 'binance' ? input.interval : null,
    {
      startTime: input.startTime,
      endTime: input.endTime,
    },
  )

  const localQuery = useLocalDatasetCandles(
    input.sourceKind === 'local' ? input.datasetId : null,
    input.sourceKind === 'local' ? input.interval : null,
    {
      startTime: input.startTime,
      endTime: input.endTime,
      symbol: input.symbol,
    },
  )

  if (input.sourceKind === 'local') {
    return {
      ...localQuery,
      providerLabel: 'LocalDatasetProvider' as const,
    }
  }

  return {
    ...binanceQuery,
    providerLabel: 'BinanceProvider' as const,
  }
}

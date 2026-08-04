import type { Candle } from '../candles.js'
import {
  clipCandlesToRange,
  RESEARCH_PERIOD_MAX_CANDLES,
} from '../research-period.js'
import type { GetCandlesParams, MarketDataProvider } from '../providers/MarketDataProvider.js'
import type { DatasetStore } from './store.js'
import { getDatasetStore } from './indexeddb-store.js'

/** Local history can be multi-year; allow larger windows than live Binance fetches. */
export const LOCAL_DATASET_MAX_CANDLES = 500_000

export interface LocalDatasetProviderOptions {
  datasetId: string
  store?: DatasetStore
}

/**
 * MarketDataProvider backed by a persisted local dataset.
 * BacktestEngine / research never learn that candles came from IndexedDB.
 */
export class LocalDatasetProvider implements MarketDataProvider {
  private readonly datasetId: string
  private readonly store: DatasetStore

  constructor(options: LocalDatasetProviderOptions) {
    if (!options.datasetId.trim()) {
      throw new Error('LocalDatasetProvider requires a datasetId')
    }
    this.datasetId = options.datasetId
    this.store = options.store ?? getDatasetStore()
  }

  async getCandles(params: GetCandlesParams): Promise<Candle[]> {
    const { symbol, interval, limit, startTime, endTime, maxCandles, signal } = params

    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    if (!interval.trim()) {
      throw new Error('interval must be a non-empty string')
    }

    const meta = await this.store.getMetadata(this.datasetId)
    if (!meta) {
      throw new Error(`Local dataset not found: ${this.datasetId}`)
    }
    if (meta.status === 'error') {
      throw new Error(meta.errorMessage ?? `Local dataset "${meta.name}" is in an error state`)
    }
    if (!meta.timeframes.includes(interval)) {
      throw new Error(
        `Timeframe ${interval} is not available in dataset "${meta.name}". Available: ${meta.timeframes.join(', ')}`,
      )
    }

    const requestedSymbol = symbol.trim().toUpperCase()
    if (
      requestedSymbol &&
      requestedSymbol !== 'LOCAL' &&
      meta.symbol &&
      requestedSymbol !== meta.symbol.toUpperCase()
    ) {
      throw new Error(
        `Symbol mismatch: requested ${symbol}, dataset is ${meta.symbol}`,
      )
    }

    // Load ONLY the selected timeframe — never the whole library.
    const loaded = await this.store.getCandles(this.datasetId, interval)
    if (!loaded || loaded.length === 0) {
      throw new Error(
        `No candles for timeframe ${interval} in dataset "${meta.name}"`,
      )
    }

    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    const hasRange =
      startTime !== undefined &&
      endTime !== undefined &&
      Number.isFinite(startTime) &&
      Number.isFinite(endTime)

    if (hasRange) {
      if (endTime! < startTime!) {
        throw new Error('endTime must be on or after startTime')
      }
      const candles = clipCandlesToRange(loaded, startTime!, endTime!)
      if (candles.length === 0) {
        throw new Error(
          `Local dataset "${meta.name}" has no ${interval} candles in the selected research period`,
        )
      }
      const ceiling = maxCandles ?? Math.max(RESEARCH_PERIOD_MAX_CANDLES, LOCAL_DATASET_MAX_CANDLES)
      if (candles.length > ceiling) {
        throw new Error(
          `Requested research period requires more than ${ceiling} candles. Narrow the calendar range or use a higher timeframe.`,
        )
      }
      return candles
    }

    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error('limit must be a positive integer')
    }

    // Legacy latest-N path: return the most recent `limit` candles.
    return loaded.slice(-limit)
  }
}

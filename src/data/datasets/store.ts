import type { Candle } from '../candles.js'
import type { CandleInterval } from '../providers/MarketDataProvider.js'
import type { DatasetMetadata } from './types.js'

/**
 * Persistence contract for the Dataset Library.
 * IndexedDB is the browser default; MemoryDatasetStore powers unit tests.
 * Future remote providers (Dukascopy, Polygon, …) can feed the same contract.
 */
export interface DatasetStore {
  listMetadata(): Promise<DatasetMetadata[]>
  getMetadata(id: string): Promise<DatasetMetadata | null>
  putDataset(
    metadata: DatasetMetadata,
    candlesByTimeframe: Record<string, Candle[]>,
  ): Promise<void>
  getCandles(id: string, timeframe: CandleInterval | string): Promise<Candle[] | null>
  updateMetadata(id: string, patch: Partial<DatasetMetadata>): Promise<DatasetMetadata>
  deleteDataset(id: string): Promise<void>
  /** Refresh aggregate metadata from stored candle slices. */
  refreshMetadata(id: string): Promise<DatasetMetadata>
}

export class MemoryDatasetStore implements DatasetStore {
  private readonly metadata = new Map<string, DatasetMetadata>()
  private readonly candles = new Map<string, Map<string, Candle[]>>()

  async listMetadata(): Promise<DatasetMetadata[]> {
    return [...this.metadata.values()].sort((a, b) => b.importedAt - a.importedAt)
  }

  async getMetadata(id: string): Promise<DatasetMetadata | null> {
    return this.metadata.get(id) ?? null
  }

  async putDataset(
    metadata: DatasetMetadata,
    candlesByTimeframe: Record<string, Candle[]>,
  ): Promise<void> {
    this.metadata.set(metadata.id, { ...metadata })
    const slices = new Map<string, Candle[]>()
    for (const [tf, candles] of Object.entries(candlesByTimeframe)) {
      slices.set(tf, candles.map((c) => ({ ...c })))
    }
    this.candles.set(metadata.id, slices)
  }

  async getCandles(id: string, timeframe: string): Promise<Candle[] | null> {
    const slices = this.candles.get(id)
    if (!slices) return null
    const candles = slices.get(timeframe)
    return candles ? candles.map((c) => ({ ...c })) : null
  }

  async updateMetadata(
    id: string,
    patch: Partial<DatasetMetadata>,
  ): Promise<DatasetMetadata> {
    const current = this.metadata.get(id)
    if (!current) throw new Error(`Dataset not found: ${id}`)
    const next = { ...current, ...patch, id: current.id }
    this.metadata.set(id, next)
    return { ...next }
  }

  async deleteDataset(id: string): Promise<void> {
    this.metadata.delete(id)
    this.candles.delete(id)
  }

  async refreshMetadata(id: string): Promise<DatasetMetadata> {
    const current = this.metadata.get(id)
    if (!current) throw new Error(`Dataset not found: ${id}`)
    const slices = this.candles.get(id)
    if (!slices) throw new Error(`Dataset candles missing: ${id}`)

    const candleCounts: Record<string, number> = {}
    let total = 0
    let startDate = Number.POSITIVE_INFINITY
    let endDate = Number.NEGATIVE_INFINITY
    const timeframes: string[] = []

    for (const [tf, candles] of slices.entries()) {
      timeframes.push(tf)
      candleCounts[tf] = candles.length
      total += candles.length
      if (candles.length > 0) {
        startDate = Math.min(startDate, candles[0]!.time)
        endDate = Math.max(endDate, candles[candles.length - 1]!.time)
      }
    }

    const next: DatasetMetadata = {
      ...current,
      timeframes: timeframes.sort(),
      candleCounts,
      candles: total,
      startDate: Number.isFinite(startDate) ? startDate : current.startDate,
      endDate: Number.isFinite(endDate) ? endDate : current.endDate,
      status: 'ready',
      errorMessage: undefined,
    }
    this.metadata.set(id, next)
    return { ...next }
  }
}

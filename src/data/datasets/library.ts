import type { Candle } from '../candles.js'
import type { CandleInterval } from '../providers/MarketDataProvider.js'
import type {
  DatasetMetadata,
  DatasetMetadataExport,
  ImportDatasetInput,
} from './types.js'
import type { DatasetStore } from './store.js'
import { getDatasetStore } from './indexeddb-store.js'

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `ds_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function sortTimeframes(timeframes: string[]): CandleInterval[] {
  const order = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M']
  return [...timeframes].sort((a, b) => {
    const ai = order.indexOf(a)
    const bi = order.indexOf(b)
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  }) as CandleInterval[]
}

export function generateDatasetMetadata(
  input: ImportDatasetInput,
  id: string = createId(),
  importedAt: number = Date.now(),
): { metadata: DatasetMetadata; candlesByTimeframe: Record<string, Candle[]> } {
  const candlesByTimeframe: Record<string, Candle[]> = {}
  const candleCounts: Record<string, number> = {}
  let total = 0
  let startDate = Number.POSITIVE_INFINITY
  let endDate = Number.NEGATIVE_INFINITY
  let fileSize = 0

  for (const file of input.files) {
    candlesByTimeframe[file.timeframe] = file.candles
    candleCounts[file.timeframe] = file.candles.length
    total += file.candles.length
    fileSize += file.fileSize
    if (file.candles.length > 0) {
      startDate = Math.min(startDate, file.startDate)
      endDate = Math.max(endDate, file.endDate)
    }
  }

  const metadata: DatasetMetadata = {
    id,
    name: input.name.trim() || `${input.symbol}`,
    symbol: input.symbol.trim().toUpperCase(),
    marketType: input.marketType,
    provider: input.provider ?? 'local',
    timeframes: sortTimeframes(Object.keys(candlesByTimeframe)),
    startDate: Number.isFinite(startDate) ? startDate : importedAt,
    endDate: Number.isFinite(endDate) ? endDate : importedAt,
    candles: total,
    candleCounts,
    fileSize,
    importedAt,
    status: 'ready',
  }

  return { metadata, candlesByTimeframe }
}

export class DatasetLibrary {
  private readonly store: DatasetStore

  constructor(store: DatasetStore = getDatasetStore()) {
    this.store = store
  }

  list(): Promise<DatasetMetadata[]> {
    return this.store.listMetadata()
  }

  get(id: string): Promise<DatasetMetadata | null> {
    return this.store.getMetadata(id)
  }

  async importDataset(input: ImportDatasetInput): Promise<DatasetMetadata> {
    if (!input.files.length) {
      throw new Error('Import requires at least one validated CSV file')
    }
    if (!input.name.trim()) {
      throw new Error('Dataset name is required')
    }
    if (!input.symbol.trim()) {
      throw new Error('Dataset symbol is required')
    }

    const { metadata, candlesByTimeframe } = generateDatasetMetadata(input)
    await this.store.putDataset(metadata, candlesByTimeframe)
    return metadata
  }

  async rename(id: string, name: string): Promise<DatasetMetadata> {
    const trimmed = name.trim()
    if (!trimmed) throw new Error('Dataset name cannot be empty')
    return this.store.updateMetadata(id, { name: trimmed })
  }

  async delete(id: string): Promise<void> {
    await this.store.deleteDataset(id)
  }

  refreshMetadata(id: string): Promise<DatasetMetadata> {
    return this.store.refreshMetadata(id)
  }

  async exportMetadata(id: string): Promise<DatasetMetadataExport> {
    const meta = await this.store.getMetadata(id)
    if (!meta) throw new Error(`Dataset not found: ${id}`)
    const { status: _status, errorMessage: _error, ...rest } = meta
    return {
      ...rest,
      exportedAt: Date.now(),
    }
  }

  /** Load a single timeframe — never the full library. */
  getCandles(id: string, timeframe: string): Promise<Candle[] | null> {
    return this.store.getCandles(id, timeframe)
  }
}

let defaultLibrary: DatasetLibrary | null = null

export function getDatasetLibrary(): DatasetLibrary {
  if (!defaultLibrary) {
    defaultLibrary = new DatasetLibrary()
  }
  return defaultLibrary
}

export function setDatasetLibraryForTests(library: DatasetLibrary | null): void {
  defaultLibrary = library
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function formatCoverageDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

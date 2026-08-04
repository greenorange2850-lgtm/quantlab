import type { Candle } from '../candles.js'
import type { DatasetMetadata } from './types.js'
import type { DatasetStore } from './store.js'

const DB_NAME = 'quantlab-datasets'
const DB_VERSION = 1
const META_STORE = 'metadata'
const CANDLE_STORE = 'candles'

interface CandleRecord {
  /** `${datasetId}::${timeframe}` */
  key: string
  datasetId: string
  timeframe: string
  candles: Candle[]
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const factory = globalThis.indexedDB
    if (!factory) {
      reject(new Error('IndexedDB is not available in this environment'))
      return
    }

    const request = factory.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(CANDLE_STORE)) {
        const store = db.createObjectStore(CANDLE_STORE, { keyPath: 'key' })
        store.createIndex('datasetId', 'datasetId', { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(request.error ?? new Error('Failed to open IndexedDB'))
  })
}

function candleKey(datasetId: string, timeframe: string): string {
  return `${datasetId}::${timeframe}`
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
  })
}

/**
 * Browser persistence for Dataset Library metadata + candle slices.
 *
 * Schema:
 * - metadata: DatasetMetadata keyed by id
 * - candles: { key, datasetId, timeframe, candles[] } keyed by `${id}::${timeframe}`
 *
 * Only the selected timeframe is loaded at research time.
 */
export class IndexedDBDatasetStore implements DatasetStore {
  private dbPromise: Promise<IDBDatabase> | null = null

  private db(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = openDatabase().catch((error) => {
        this.dbPromise = null
        throw error
      })
    }
    return this.dbPromise
  }

  async listMetadata(): Promise<DatasetMetadata[]> {
    const db = await this.db()
    const tx = db.transaction(META_STORE, 'readonly')
    const done = transactionDone(tx)
    const store = tx.objectStore(META_STORE)
    const rows = await requestToPromise(store.getAll() as IDBRequest<DatasetMetadata[]>)
    await done
    return rows.sort((a, b) => b.importedAt - a.importedAt)
  }

  async getMetadata(id: string): Promise<DatasetMetadata | null> {
    const db = await this.db()
    const tx = db.transaction(META_STORE, 'readonly')
    const done = transactionDone(tx)
    const row = await requestToPromise(
      tx.objectStore(META_STORE).get(id) as IDBRequest<DatasetMetadata | undefined>,
    )
    await done
    return row ?? null
  }

  async putDataset(
    metadata: DatasetMetadata,
    candlesByTimeframe: Record<string, Candle[]>,
  ): Promise<void> {
    const db = await this.db()
    const tx = db.transaction([META_STORE, CANDLE_STORE], 'readwrite')
    const done = transactionDone(tx)
    const metaStore = tx.objectStore(META_STORE)
    const candleStore = tx.objectStore(CANDLE_STORE)

    metaStore.put(metadata)

    for (const [timeframe, candles] of Object.entries(candlesByTimeframe)) {
      const record: CandleRecord = {
        key: candleKey(metadata.id, timeframe),
        datasetId: metadata.id,
        timeframe,
        candles,
      }
      candleStore.put(record)
    }

    await done
  }

  async getCandles(id: string, timeframe: string): Promise<Candle[] | null> {
    const db = await this.db()
    const tx = db.transaction(CANDLE_STORE, 'readonly')
    const done = transactionDone(tx)
    const record = await requestToPromise(
      tx.objectStore(CANDLE_STORE).get(candleKey(id, timeframe)) as IDBRequest<
        CandleRecord | undefined
      >,
    )
    await done
    return record?.candles ?? null
  }

  async updateMetadata(
    id: string,
    patch: Partial<DatasetMetadata>,
  ): Promise<DatasetMetadata> {
    const current = await this.getMetadata(id)
    if (!current) throw new Error(`Dataset not found: ${id}`)
    const next: DatasetMetadata = { ...current, ...patch, id: current.id }
    const db = await this.db()
    const tx = db.transaction(META_STORE, 'readwrite')
    const done = transactionDone(tx)
    tx.objectStore(META_STORE).put(next)
    await done
    return next
  }

  async deleteDataset(id: string): Promise<void> {
    const db = await this.db()
    const tx = db.transaction([META_STORE, CANDLE_STORE], 'readwrite')
    const done = transactionDone(tx)
    tx.objectStore(META_STORE).delete(id)

    const candleStore = tx.objectStore(CANDLE_STORE)
    const index = candleStore.index('datasetId')
    const keys = await requestToPromise(index.getAllKeys(id) as IDBRequest<IDBValidKey[]>)
    for (const key of keys) {
      candleStore.delete(key)
    }

    await done
  }

  async refreshMetadata(id: string): Promise<DatasetMetadata> {
    const current = await this.getMetadata(id)
    if (!current) throw new Error(`Dataset not found: ${id}`)

    const db = await this.db()
    const tx = db.transaction([META_STORE, CANDLE_STORE], 'readwrite')
    const done = transactionDone(tx)
    const candleStore = tx.objectStore(CANDLE_STORE)
    const index = candleStore.index('datasetId')
    const records = await requestToPromise(
      index.getAll(id) as IDBRequest<CandleRecord[]>,
    )

    const candleCounts: Record<string, number> = {}
    let total = 0
    let startDate = Number.POSITIVE_INFINITY
    let endDate = Number.NEGATIVE_INFINITY
    const timeframes: string[] = []

    for (const record of records) {
      timeframes.push(record.timeframe)
      candleCounts[record.timeframe] = record.candles.length
      total += record.candles.length
      if (record.candles.length > 0) {
        startDate = Math.min(startDate, record.candles[0]!.time)
        endDate = Math.max(endDate, record.candles[record.candles.length - 1]!.time)
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

    tx.objectStore(META_STORE).put(next)
    await done
    return next
  }
}

let defaultStore: DatasetStore | null = null

/** Singleton IndexedDB store for the browser Dataset Library. */
export function getDatasetStore(): DatasetStore {
  if (!defaultStore) {
    defaultStore = new IndexedDBDatasetStore()
  }
  return defaultStore
}

/** Test helper — inject an in-memory store. */
export function setDatasetStoreForTests(store: DatasetStore | null): void {
  defaultStore = store
}

export const DATASET_DB = {
  name: DB_NAME,
  version: DB_VERSION,
  stores: { metadata: META_STORE, candles: CANDLE_STORE },
} as const
